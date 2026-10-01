import { query } from '../db.js';
import { requireAuth } from './middleware.js';

// A canceled subscription keeps working until the end of the period the
// business paid for — the Account page says so — and then stops. Before
// this, nothing ever stopped: a canceled business kept full use of the
// app for free, indefinitely.
//
// Deliberately narrow: only a canceled plan whose paid period is over
// counts as ended. Pending, past-due (Paddle is still retrying the card)
// and businesses with no subscription row at all are left alone, so a
// delayed webhook can't lock anyone out.
//
// A Paymob plan (Egypt) is paid a month at a time and never renews by
// itself, so it also ends when the month paid for runs out without the
// next one being paid, after PAYMOB_GRACE_DAYS.
export const PAYMOB_GRACE_DAYS = 3;

export async function planEnded(tenantId) {
  const { rows } = await query(
    `SELECT status, current_period_end, provider FROM subscriptions
     WHERE tenant_id = $1 AND status IN ('active', 'past_due', 'canceled')
     ORDER BY created_at DESC LIMIT 1`,
    [tenantId]
  );
  const sub = rows[0];
  if (!sub?.current_period_end) return false;
  const over = (graceDays) => new Date(sub.current_period_end).getTime() + graceDays * 86_400_000 < Date.now();
  return (sub.status === 'canceled' && over(0)) || (sub.provider === 'paymob' && sub.status === 'active' && over(PAYMOB_GRACE_DAYS));
}

export const PLAN_ENDED_MESSAGE = 'Your SOPY subscription has ended. Past reports stay available; subscribe again in Profile & billing to continue.';

// Mounted in front of the routers whose writes are the product itself.
// Reads stay open (history, reports, the dashboard), and so does sharing
// an existing report as a PDF. `allow` lists [method, path] pairs that
// stay writable, relative to the mount point.
export function blockWritesWhenPlanEnded(allow = []) {
  return (req, res, next) => {
    if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return next();
    if (allow.some(([method, pattern]) => method === req.method && pattern.test(req.path))) return next();
    // Resolve the session here; the route will run requireAuth again, which
    // is a cheap indexed lookup.
    return requireAuth(req, res, async () => {
      try {
        if (await planEnded(req.auth.tenantId)) {
          return res.status(402).json({ error: PLAN_ENDED_MESSAGE, code: 'plan_ended' });
        }
        next();
      } catch (err) {
        next(err);
      }
    });
  };
}
