import { Router } from 'express';
import { query } from '../db.js';
import { requireAuth, requireRole } from '../auth/middleware.js';
import { ensureReferralCode, creditSummary } from '../credits.js';
import { REFERRAL_REWARD_USD, REFERRAL_WELCOME_USD } from '../../../shared/referrals.js';

// The Profile page's referral section: this business's link, how its
// referrals are doing, and its account credit. Owner-only — the credit
// belongs to the business and comes off the owner's payments.
export const referralsRouter = Router();

referralsRouter.get('/', requireAuth, requireRole('business_owner'), async (req, res) => {
  const code = await ensureReferralCode(req.auth.tenantId);

  const { rows: counts } = await query(
    `SELECT
       (SELECT count(*)::int FROM tenants WHERE referred_by_tenant_id = $1) AS signed_up,
       (SELECT count(*)::int FROM account_credits WHERE tenant_id = $1 AND referred_tenant_id IS NOT NULL) AS paid`,
    [req.auth.tenantId]
  );

  // Earned rewards, newest first. The referred business is named so the
  // owner can tell which referral paid off.
  const { rows: rewards } = await query(
    `SELECT c.id, c.amount, c.created_at, t.restaurant_name AS referred_restaurant
     FROM account_credits c
     LEFT JOIN tenants t ON t.id = c.referred_tenant_id
     WHERE c.tenant_id = $1 AND c.referred_tenant_id IS NOT NULL
     ORDER BY c.created_at DESC LIMIT 20`,
    [req.auth.tenantId]
  );

  res.json({
    code,
    path: `/get-started?ref=${code}`,
    rewardAmount: REFERRAL_REWARD_USD,
    welcomeAmount: REFERRAL_WELCOME_USD,
    signedUp: counts[0].signed_up,
    paid: counts[0].paid,
    credit: await creditSummary(req.auth.tenantId),
    rewards: rewards.map((r) => ({ ...r, amount: Number(r.amount) })),
  });
});
