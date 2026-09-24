// First: .env must be loaded before any module reads process.env (the
// JWT_SECRET boot check in auth/jwt.js, for one). It happened to work
// only because db.js pulled dotenv in first.
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'node:path';
import './asyncErrors.js';

import { authRouter } from './routes/auth.routes.js';
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
import { requireSignedUpload } from './uploads.js';
import { blockWritesWhenPlanEnded } from './auth/plan.js';

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
  // Photos are only served through signed, expiring links (see uploads.js).
  app.use('/uploads', requireSignedUpload, express.static(path.resolve('uploads')));

  app.get('/api/health', (req, res) => res.json({ ok: true }));

  app.use('/api/auth', authRouter);
  // After a plan ends, adding stores or people is blocked; shrinking
  // (plan counts, disabling users, removing stores) stays open so an owner
  // can tidy up before subscribing again.
  app.use('/api/tenants', blockWritesWhenPlanEnded([
    ['PATCH', /^\/current$/],
    ['PATCH', /^\/users\/[^/]+$/],
    ['POST', /^\/users\/[^/]+\/reset-link$/],
    ['DELETE', /^\/branches\/[^/]+$/],
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
  }

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    // Malformed ids (e.g. /submissions/abc) are a client mistake, not a crash.
    if (err.code === '22P02') return res.status(400).json({ error: 'Invalid id' });
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
