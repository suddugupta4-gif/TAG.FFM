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

// Live Visitors Counter JSON Endpoint & Recording Endpoint
const recordedVisitors = new Set<string>();

app.get(['/api/visitors', '/api/views'], async (req: Request, res: Response) => {
  try {
    const visitors = await TournamentService.getVisitorsCount();
    res.json({
      success: true,
      visitors: visitors,
      formattedVisitors: visitors.toLocaleString('en-US')
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Dedicated endpoint to record genuinely unique visitors only once per device/browser
app.post(['/api/visitors/record', '/api/visitors'], async (req: Request, res: Response) => {
  try {
    const visitorId = req.body?.visitorId;
    if (visitorId && typeof visitorId === 'string' && visitorId.length >= 5) {
      if (!recordedVisitors.has(visitorId)) {
        recordedVisitors.add(visitorId);
        if (recordedVisitors.size > 50000) recordedVisitors.clear();
        const newCount = await TournamentService.recordVisitor(true);
        return res.json({
          success: true,
          isNew: true,
          visitors: newCount,
          formattedVisitors: newCount.toLocaleString('en-US')
        });
      }
    }
    const current = await TournamentService.getVisitorsCount();
    return res.json({
      success: true,
      isNew: false,
      visitors: current,
      formattedVisitors: current.toLocaleString('en-US')
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
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

// Google Search Console Site Verification file routes
app.get([
  '/googleXwwKp8c9rGEIboQUHE_AQeP7sw0L_3nSAVgnuSLAG7I.html',
  '/XwwKp8c9rGEIboQUHE_AQeP7sw0L_3nSAVgnuSLAG7I.html',
  '/googleXwwKp8c9rGEIboQUHE_AQeP7sw0L_3nSAVgnuSLAG7I'
], (req: Request, res: Response) => {
  res.type('text/html').send('google-site-verification: googleXwwKp8c9rGEIboQUHE_AQeP7sw0L_3nSAVgnuSLAG7I.html');
});

app.get([
  '/google_kWbwASv7kgV_SDw6Z8ds7zVk-DEAYeHBeUzh2qhWNs.html',
  '/_kWbwASv7kgV_SDw6Z8ds7zVk-DEAYeHBeUzh2qhWNs.html',
  '/google_kWbwASv7kgV_SDw6Z8ds7zVk-DEAYeHBeUzh2qhWNs'
], (req: Request, res: Response) => {
  res.type('text/html').send('google-site-verification: google_kWbwASv7kgV_SDw6Z8ds7zVk-DEAYeHBeUzh2qhWNs.html');
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

  // Visitor Telemetry (Read current count for SSR views without mutating on refresh)
  try {
    const visitors = await TournamentService.getVisitorsCount();
    res.locals.visitorsCount = visitors;
    res.locals.formattedVisitors = visitors.toLocaleString('en-US');
  } catch (err) {
    res.locals.visitorsCount = 0;
    res.locals.formattedVisitors = '0';
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
