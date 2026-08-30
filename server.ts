import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import session from 'express-session';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import dotenv from 'dotenv';
import { initDb, ensureDbReady } from './config/db.js';
import { TournamentService } from './services/tournamentService.js';
import publicRoutes from './routes/publicRoutes.js';
import adminRoutes, { validateAdminRequest } from './routes/adminRoutes.js';

dotenv.config();

const app = express();
const PORT = 3000;

// Disable fingerprinting header
app.disable('x-powered-by');

// Trust reverse proxy for Cloud Run and iframe hosting
app.set('trust proxy', 1);

// Security Headers Middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// Body & Cookie Parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(cors({ origin: true, credentials: true }));

// Session Middleware (Configured for Cloud Run HTTPS & cross-origin iframes)
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'tagfreefiremax_secret_session_key_2026',
    resave: false,
    saveUninitialized: false,
    proxy: true,
    cookie: {
      secure: 'auto',
      sameSite: 'none',
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24 * 7 // 7 days
    }
  })
);

// EJS View Engine Setup
app.set('view engine', 'ejs');
app.set('views', path.join(process.cwd(), 'views'));

// Static Assets
app.use(express.static(path.join(process.cwd(), 'public')));

// Health check endpoint
app.get(['/api/health', '/health'], (req: Request, res: Response) => {
  res.json({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() });
});

// Favicon & Robots Handlers to prevent 404 logs on Vercel
app.get(['/favicon.ico', '/favicon.png', '/favicon.svg'], (req: Request, res: Response) => {
  res.sendFile(path.join(process.cwd(), 'public', 'favicon.svg'), {
    headers: { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'public, max-age=86400' }
  });
});

app.get('/robots.txt', (req: Request, res: Response) => {
  res.type('text/plain').send('User-agent: *\nAllow: /\nDisallow: /admin\n');
});

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

  // Admin verification check (Explicit password-authenticated session or active dynamic token)
  const auth = validateAdminRequest(req);
  const isUserAdmin = auth.isValid;

  res.locals.currentPath = req.path || '/';
  res.locals.isAdmin = isUserAdmin;
  res.locals.activeAdminToken = auth.token || '';
  res.locals.adminHref = (url: string) => {
    if (!auth.token) return url;
    if (url.includes('tk=')) return url;
    const sep = url.includes('?') ? '&' : '?';
    return `${url}${sep}tk=${auth.token}`;
  };
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
