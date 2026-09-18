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

export function createApp() {
  const app = express();

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
  app.use('/uploads', express.static(path.resolve('uploads')));

  app.get('/api/health', (req, res) => res.json({ ok: true }));

  app.use('/api/auth', authRouter);
  app.use('/api/tenants', tenantsRouter);
  app.use('/api/pricing', pricingRouter);
  app.use('/api/billing', billingRouter);
  app.use('/api/onboarding', onboardingRouter);
  app.use('/api/checklists', checklistsRouter);
  app.use('/api/submissions', submissionsRouter);
  app.use('/api/dashboard', dashboardRouter);
  app.use('/api/feedback', feedbackRouter);

  // In production this one Node process serves the built React app too, so
  // the whole thing runs as a single Hostinger "Node.js app" alongside
  // managed PostgreSQL — no separate static host needed.
  if (process.env.NODE_ENV === 'production') {
    const webDist = path.resolve('../web/dist');
    app.use(express.static(webDist));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) return next();
      res.sendFile(path.join(webDist, 'index.html'));
    });
  }

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    // Malformed ids (e.g. /submissions/abc) are a client mistake, not a crash.
    if (err.code === '22P02') return res.status(400).json({ error: 'Invalid id' });
    console.error(err);
    const status = err.status || err.statusCode || (err.name === 'MulterError' || err.expose ? 400 : 500);
    // Don't echo database internals back on unexpected failures.
    res.status(status).json({ error: status >= 500 ? 'Internal server error' : err.message });
  });

  return app;
}
