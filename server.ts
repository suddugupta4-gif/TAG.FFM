import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import session from 'express-session';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import dotenv from 'dotenv';
import { initDb, ensureDbReady } from './config/db.js';
import { TournamentService } from './services/tournamentService.js';
import publicRoutes from './routes/publicRoutes.js';
import adminRoutes from './routes/adminRoutes.js';

dotenv.config();

const app = express();
const PORT = 3000;

// Trust reverse proxy for Cloud Run and iframe hosting
app.set('trust proxy', 1);

// Body & Cookie Parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(cors({ origin: true, credentials: true }));

// Session Middleware
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'tagfreefiremax_secret_session_key_2026',
    resave: true,
    saveUninitialized: true,
    cookie: {
      secure: false, // compatible with Cloud Run proxy & iframe
      sameSite: 'lax',
      maxAge: 1000 * 60 * 60 * 24 * 30 // 30 days
    }
  })
);

// EJS View Engine Setup
app.set('view engine', 'ejs');
app.set('views', path.join(process.cwd(), 'views'));

// Static Assets
app.use(express.static(path.join(process.cwd(), 'public')));

// Global Request Logger, Site Context & Session Helper injection (Runs for ALL routes including /admin)
app.use(async (req: Request, res: Response, next: NextFunction) => {
  try {
    await ensureDbReady();
    const settings = await TournamentService.getSiteSettings();
    res.locals.settings = settings || {};
  } catch (e) {
    res.locals.settings = {
      site_background_url: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=2070&auto=format&fit=crop',
      site_title: 'TAGFREEFIREMAX',
      site_tagline: 'Premier Free Fire MAX Esports Hub'
    };
  }

  // Multi-tier admin verification (Session + Cookie token + Query token for seamless iframe compatibility)
  const ADMIN_TOKEN = 'tag_admin_authorized_sujal_2026';
  const hasAdminSession = Boolean(req.session && (req.session as any).isAdmin);
  const hasAdminCookie = req.cookies?.tag_admin_token === ADMIN_TOKEN || req.cookies?.tag_admin_session === '1';
  const hasAdminQuery = req.query?.auth_token === ADMIN_TOKEN;
  const hasAdminHeader = req.headers['x-admin-token'] === ADMIN_TOKEN;

  if (hasAdminCookie || hasAdminQuery || hasAdminHeader) {
    if (req.session) {
      (req.session as any).isAdmin = true;
    }
  }

  res.locals.currentPath = req.path || '/';
  res.locals.isAdmin = Boolean(req.session && (req.session as any).isAdmin) || hasAdminCookie || hasAdminQuery || hasAdminHeader;
  res.locals.success = (req.query.success as string) || null;
  res.locals.error = (req.query.error as string) || null;
  next();
});

// Mount Routes
app.use('/admin', adminRoutes);
app.use('/', publicRoutes);

// 404 Handler
app.use((req: Request, res: Response) => {
  res.status(404).render('error', {
    title: '404 - Page Not Found — TAGFREEFIREMAX',
    message: `The requested page "${req.originalUrl}" does not exist in the tournament registry.`
  });
});

// Global Error Handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('Server error:', err);
  res.status(500).render('error', {
    title: '500 - Server Error — TAGFREEFIREMAX',
    message: err?.message || 'An unexpected error occurred.'
  });
});

// Initialize database and start listening
async function start() {
  try {
    await initDb();
  } catch (e) {
    console.warn('Database initialization warning:', e);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 TAGFREEFIREMAX Esports Platform running on http://localhost:${PORT}`);
  });
}

start();

export default app;
