import express from 'express';
import cors from 'cors';
import path from 'node:path';

import { authRouter } from './routes/auth.routes.js';
import { tenantsRouter } from './routes/tenants.routes.js';
import { pricingRouter } from './routes/pricing.routes.js';
import { billingRouter, paddleWebhookHandler } from './routes/billing.routes.js';
import { onboardingRouter } from './routes/onboarding.routes.js';
import { checklistsRouter } from './routes/checklists.routes.js';
import { submissionsRouter } from './routes/submissions.routes.js';
import { dashboardRouter } from './routes/dashboard.routes.js';

export function createApp() {
  const app = express();

  app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' }));

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
    console.error(err);
    res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
  });

  return app;
}
