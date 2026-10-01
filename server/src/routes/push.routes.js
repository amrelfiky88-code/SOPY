import { Router } from 'express';
import { query } from '../db.js';
import { requireAuth } from '../auth/middleware.js';
import { pushPublicKey, isPushEndpoint } from '../push.js';

// Turning phone notifications on and off for this browser (push.js sends).
export const pushRouter = Router();

// null when this server has no VAPID keys: the app then hides the option.
pushRouter.get('/config', requireAuth, (req, res) => {
  res.json({ publicKey: pushPublicKey() });
});

const KEY_RE = /^[A-Za-z0-9_-]{8,200}={0,2}$/;

pushRouter.post('/subscribe', requireAuth, async (req, res) => {
  if (!pushPublicKey()) return res.status(503).json({ error: "Phone notifications aren't set up on this server" });
  const { endpoint, keys } = req.body;
  if (typeof endpoint !== 'string' || endpoint.length > 1000 || !isPushEndpoint(endpoint)) {
    return res.status(400).json({ error: 'This browser’s notification address isn’t supported' });
  }
  if (!keys || typeof keys !== 'object' || typeof keys.p256dh !== 'string' || typeof keys.auth !== 'string'
      || !KEY_RE.test(keys.p256dh) || !KEY_RE.test(keys.auth)) {
    return res.status(400).json({ error: 'This browser’s notification address isn’t supported' });
  }
  // A browser belongs to whoever signed in last on it.
  await query(
    `INSERT INTO push_subscriptions (tenant_id, user_id, endpoint, p256dh, auth) VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (endpoint) DO UPDATE SET tenant_id = EXCLUDED.tenant_id, user_id = EXCLUDED.user_id,
       p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth, created_at = now()`,
    [req.auth.tenantId, req.auth.userId, endpoint, keys.p256dh, keys.auth]
  );
  res.status(201).json({ ok: true });
});

pushRouter.post('/unsubscribe', requireAuth, async (req, res) => {
  const { endpoint } = req.body;
  if (typeof endpoint !== 'string') return res.status(400).json({ error: 'Missing fields' });
  await query('DELETE FROM push_subscriptions WHERE endpoint = $1 AND user_id = $2', [endpoint, req.auth.userId]);
  res.status(204).end();
});
