// First: .env must be loaded before any module reads process.env (the
// JWT_SECRET boot check in auth/jwt.js, for one). It happened to work
// only because db.js pulled dotenv in first.
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'node:path';
import './asyncErrors.js';

import { authRouter } from './routes/auth.routes.js';
import { forgotRouter } from './routes/forgot.routes.js';
import { tenantsRouter } from './routes/tenants.routes.js';
import { pricingRouter } from './routes/pricing.routes.js';
import { billingRouter, paddleWebhookHandler } from './routes/billing.routes.js';
import { onboardingRouter } from './routes/onboarding.routes.js';
import { checklistsRouter } from './routes/checklists.routes.js';
import { submissionsRouter } from './routes/submissions.routes.js';
import { dashboardRouter } from './routes/dashboard.routes.js';
import { feedbackRouter } from './routes/feedback.routes.js';
import { sharedRouter } from './routes/shared.routes.js';
import { referralsRouter } from './routes/referrals.routes.js';
import { inboxRouter, notificationsRouter } from './routes/inbox.routes.js';
import { pushRouter } from './routes/push.routes.js';
import { requireSignedUpload } from './uploads.js';
import { blockWritesWhenPlanEnded } from './auth/plan.js';
import { translateErrorResponses } from './i18n/errorMessages.js';
import { noteDatabaseAwake } from './reminders.js';
import { UPLOAD_ROOT } from './storage.js';

// Paddle's checkout (Paddle.js) loads from cdn.paddle.com and opens its
// overlay from buy.paddle.com / sandbox-buy.paddle.com; Paymob is a full
// page redirect, which this doesn't restrict. Fonts come from Google Fonts.
export const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self' https://*.paddle.com https://*.profitwell.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://*.paddle.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob: https:",
  "connect-src 'self' https://*.paddle.com https://*.profitwell.com",
  "frame-src 'self' https://*.paddle.com",
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
].join('; ');

export function createApp() {
  const app = express();
  app.disable('x-powered-by');

  // Baseline security headers (no dependency needed for these few).
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    // No embedding in other sites' frames (clickjacking); same-origin only.
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    // Invite, reset and share links carry secret tokens in the path —
    // never send the full address to another site.
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    // Camera (evidence photos) and location (report GPS) are used by this
    // site only; nothing else is needed.
    res.setHeader('Permissions-Policy', 'camera=(self), geolocation=(self), microphone=()');
    // What a page may load, as a second line of defence should any text ever
    // reach the page as markup: scripts only from this site and Paddle's
    // checkout, no plugins, no <base> tricks, forms post here only. Inline
    // styles stay allowed (React style props, the small server pages).
    res.setHeader('Content-Security-Policy', CONTENT_SECURITY_POLICY);
    if (process.env.NODE_ENV === 'production' && (req.secure || req.headers['x-forwarded-proto'] === 'https')) {
      res.setHeader('Strict-Transport-Security', 'max-age=15552000');
    }
    next();
  });

  // In production, lock CORS to the configured client origin. In dev,
  // reflect whatever origin asked — this is what lets the Vite dev
  // server's proxy work when it's reached via a LAN IP from a phone
  // (the browser's same-origin request to Vite still forwards with that
  // LAN-IP origin once proxied through to this API), not just localhost.
  app.use(cors({ origin: process.env.NODE_ENV === 'production' ? (process.env.CLIENT_ORIGIN || 'http://localhost:5173') : true }));

  // Paddle webhook needs the raw body for signature verification, so it's
  // mounted before the global express.json() middleware.
  app.post('/api/billing/webhook', express.raw({ type: 'application/json' }), paddleWebhookHandler);

  app.use(express.json({ limit: '1mb' }));
  // Error messages go out in the language the app is shown in.
  app.use('/api', translateErrorResponses);
  // Nothing the API returns belongs in the browser's cache: the same
  // address answers differently for each account, and phones are shared
  // between shifts, so a cached reply could reach the next person to sign in.
  app.use('/api', (req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  // The database is awake after a request: a good moment for the reminder
  // job to refresh its list of due times (reminders.js) without waking it.
  app.use('/api', (req, res, next) => { res.on('finish', noteDatabaseAwake); next(); });
  // Photos are only served through signed, expiring links (see uploads.js).
  app.use('/uploads', requireSignedUpload, express.static(UPLOAD_ROOT));

  app.get('/api/health', (req, res) => res.json({ ok: true }));

  app.use('/api/auth/forgot', forgotRouter);
  app.use('/api/auth', authRouter);
  // After a plan ends, adding stores or people is blocked; shrinking
  // (plan counts, disabling users, removing stores) stays open so an owner
  // can tidy up before subscribing again.
  app.use('/api/tenants', blockWritesWhenPlanEnded([
    ['PATCH', /^\/current$/],
    ['PATCH', /^\/users\/[^/]+$/],
    ['POST', /^\/users\/[^/]+\/reset-link$/],
    ['DELETE', /^\/branches\/[^/]+$/],
    ['PATCH', /^\/branches\/[^/]+$/],
  ]), tenantsRouter);
  app.use('/api/pricing', pricingRouter);
  app.use('/api/billing', billingRouter);
  app.use('/api/onboarding', onboardingRouter);
  app.use('/api/checklists', blockWritesWhenPlanEnded(), checklistsRouter);
  // Sharing an existing report stays allowed after a plan ends.
  app.use('/api/submissions', blockWritesWhenPlanEnded([['POST', /^\/[^/]+\/share$/]]), submissionsRouter);
  app.use('/api/dashboard', dashboardRouter);
  app.use('/api/feedback', feedbackRouter);
  app.use('/api/shared', sharedRouter);
  app.use('/api/referrals', referralsRouter);
  app.use('/api/inbox', inboxRouter);
  app.use('/api/notifications', notificationsRouter);
  app.use('/api/push', pushRouter);

  // Unknown API address: answer in JSON. Express's default HTML 404 made
  // the app think the connection had failed ("Couldn't reach SOPY") and
  // retry, instead of reporting a real "not found".
  app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

  // In production this one Node process serves the built React app too, so
  // the whole thing runs as a single Hostinger "Node.js app" alongside
  // managed PostgreSQL — no separate static host needed.
  if (process.env.NODE_ENV === 'production') {
    const webDist = path.resolve('../web/dist');
    app.use(express.static(webDist, {
      // Hashed build assets never change, so phones can keep them; the
      // HTML, sw.js and manifest must be revalidated or updates stall.
      setHeaders: (res, filePath) => {
        const hashed = filePath.includes(`${path.sep}assets${path.sep}`);
        res.setHeader('Cache-Control', hashed ? 'public, max-age=31536000, immutable' : 'no-cache');
      },
    }));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) return next();
      res.sendFile(path.join(webDist, 'index.html'));
    });
  } else {
    // In development the pages come from Vite on :5173, not from here, so
    // opening this server's address in a browser just said "Not found",
    // which looked like the app was down. Send the browser to the app
    // instead, on the same host (localhost, or a LAN IP from a phone).
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api') || req.path.startsWith('/uploads') || !req.get('accept')?.includes('text/html')) return next();
      res.redirect(302, `${req.protocol}://${req.hostname}:5173${req.originalUrl}`);
    });
  }

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    // Malformed ids (e.g. /submissions/abc) are a client mistake, not a crash.
    if (err.code === '22P02') return res.status(400).json({ error: 'Invalid id' });
    // A date filter like ?from=yesterday, a number past Postgres' range, or
    // text past a column's limit: also the client's mistake.
    if (err.code === '22007' || err.code === '22008') return res.status(400).json({ error: 'Invalid date' });
    if (err.code === '22003') return res.status(400).json({ error: 'That number is out of range' });
    if (err.code === '22001') return res.status(400).json({ error: 'That text is too long' });
    // Deleting something other records still point at (e.g. a checklist
    // that has been run) — refuse cleanly rather than a 500.
    if (err.code === '23503') return res.status(409).json({ error: 'This is still in use and can’t be removed' });
    if (err.code === '23505') return res.status(409).json({ error: 'That already exists' });
    const status = err.status || err.statusCode || (err.name === 'MulterError' || err.expose ? 400 : 500);
    if (status >= 500) console.error(err);
    // Don't echo database internals back on unexpected failures.
    res.status(status).json({ error: status >= 500 ? 'Internal server error' : err.message });
  });

  return app;
}
