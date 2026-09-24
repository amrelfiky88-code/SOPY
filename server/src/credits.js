import crypto from 'node:crypto';
import { query, withTransaction } from './db.js';
import { REFERRAL_REWARD_USD, REFERRAL_CODE_ALPHABET, REFERRAL_CODE_LENGTH, isReferralCodeShape } from '../../shared/referrals.js';
import { createCreditDiscount, applyDiscountToNextRenewal } from './paddle/client.js';

// Referral codes and account credit (the referral "cash back").
// Money rules live here in one place:
//  - a business earns REFERRAL_REWARD_USD once per referred business, when
//    that business pays for the first time;
//  - credit is spent oldest-first and never more than the payment it's
//    taken off; any remainder stays available for the next one.

const round2 = (n) => Math.round(Number(n) * 100) / 100;

function newCode() {
  const bytes = crypto.randomBytes(REFERRAL_CODE_LENGTH);
  return [...bytes].map((b) => REFERRAL_CODE_ALPHABET[b % REFERRAL_CODE_ALPHABET.length]).join('');
}

export async function ensureReferralCode(tenantId) {
  const { rows } = await query('SELECT referral_code FROM tenants WHERE id = $1', [tenantId]);
  if (rows[0]?.referral_code) return rows[0].referral_code;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const { rows: set } = await query(
        'UPDATE tenants SET referral_code = COALESCE(referral_code, $1) WHERE id = $2 RETURNING referral_code',
        [newCode(), tenantId]
      );
      return set[0].referral_code;
    } catch (err) {
      if (err.code !== '23505') throw err; // code already taken — try another
    }
  }
  throw new Error('Could not create a referral code');
}

export async function tenantForReferralCode(code) {
  const clean = typeof code === 'string' ? code.trim().toUpperCase() : '';
  if (!isReferralCodeShape(clean)) return null;
  const { rows } = await query('SELECT id FROM tenants WHERE referral_code = $1', [clean]);
  return rows[0]?.id || null;
}

export async function creditSummary(tenantId) {
  const { rows } = await query(
    `SELECT
       COALESCE(sum(amount) FILTER (WHERE status = 'available'), 0) AS available,
       COALESCE(sum(amount) FILTER (WHERE status = 'scheduled'), 0) AS scheduled,
       COALESCE(sum(amount) FILTER (WHERE status = 'used'), 0) AS used,
       COALESCE(sum(amount), 0) AS earned
     FROM account_credits WHERE tenant_id = $1`,
    [tenantId]
  );
  const r = rows[0];
  return { available: round2(r.available), scheduled: round2(r.scheduled), used: round2(r.used), earned: round2(r.earned) };
}

// What kind of credit a checkout is using, for its label: a new
// restaurant's welcome discount, referral rewards, or both.
export async function availableCreditKind(tenantId) {
  const { rows } = await query(
    "SELECT DISTINCT source FROM account_credits WHERE tenant_id = $1 AND status = 'available'",
    [tenantId]
  );
  const sources = rows.map((r) => (r.source.startsWith('welcome') ? 'welcome' : 'referral'));
  const unique = [...new Set(sources)];
  return unique.length === 1 ? unique[0] : unique.length ? 'mixed' : null;
}

// How much credit would come off a payment of `total` right now.
export async function creditForPayment(tenantId, total) {
  const { available } = await creditSummary(tenantId);
  return round2(Math.min(available, Math.max(0, Number(total) || 0)));
}

// Moves up to `amount` of 'available' credit to `toStatus`, oldest first.
// A row only partly needed is split: the used part becomes its own row and
// the remainder stays available. Returns the amount actually moved.
async function moveCredit(client, tenantId, amount, toStatus, { subscriptionId = null, discountId = null } = {}) {
  let remaining = round2(amount);
  if (remaining <= 0) return 0;
  const { rows } = await client.query(
    "SELECT id, amount, source FROM account_credits WHERE tenant_id = $1 AND status = 'available' ORDER BY created_at, id FOR UPDATE",
    [tenantId]
  );
  let moved = 0;
  for (const row of rows) {
    if (remaining <= 0) break;
    const rowAmount = round2(row.amount);
    const take = round2(Math.min(rowAmount, remaining));
    if (take === rowAmount) {
      await client.query(
        `UPDATE account_credits SET status = $1, used_on_subscription_id = $2, paddle_discount_id = $3,
                used_at = CASE WHEN $1 = 'used' THEN now() ELSE used_at END WHERE id = $4`,
        [toStatus, subscriptionId, discountId, row.id]
      );
    } else {
      await client.query('UPDATE account_credits SET amount = $1 WHERE id = $2', [round2(rowAmount - take), row.id]);
      // The split-off part keeps its origin; a welcome discount's part gets
      // its own label because only one 'welcome' row may exist.
      await client.query(
        `INSERT INTO account_credits (tenant_id, amount, source, status, used_on_subscription_id, paddle_discount_id, used_at)
         VALUES ($1, $2, $6, $3, $4, $5, CASE WHEN $3 = 'used' THEN now() ELSE NULL END)`,
        [tenantId, take, toStatus, subscriptionId, discountId, row.source === 'welcome' ? 'welcome_part' : row.source]
      );
    }
    remaining = round2(remaining - take);
    moved = round2(moved + take);
  }
  return moved;
}

// A checkout that had credit taken off it has been paid.
export async function spendCreditOnCheckout(tenantId, subscriptionId, amount) {
  if (!(Number(amount) > 0)) return 0;
  return withTransaction((client) => moveCredit(client, tenantId, amount, 'used', { subscriptionId }));
}

// Called whenever a business's payment is confirmed. If it signed up with
// someone's link and this is its first payment, the referrer earns the
// reward — once, guaranteed by the UNIQUE on referred_tenant_id.
export async function grantReferralReward(refereeTenantId) {
  const { rows } = await query('SELECT referred_by_tenant_id FROM tenants WHERE id = $1', [refereeTenantId]);
  const referrerId = rows[0]?.referred_by_tenant_id;
  if (!referrerId || referrerId === refereeTenantId) return null;
  const { rows: inserted } = await query(
    `INSERT INTO account_credits (tenant_id, amount, source, referred_tenant_id)
     VALUES ($1, $2, 'referral', $3)
     ON CONFLICT (referred_tenant_id) DO NOTHING RETURNING *`,
    [referrerId, REFERRAL_REWARD_USD, refereeTenantId]
  );
  if (!inserted[0]) return null;
  await scheduleCreditOnRenewal(referrerId);
  return inserted[0];
}

// For a business already paying through Paddle, credit goes on its next
// renewal as a one-time discount. One discount at a time: while one is
// scheduled, new credit waits until that renewal is paid (see
// renewalPaid below). Best-effort — a Paddle error leaves the credit
// available, to be applied at the next opportunity.
export async function scheduleCreditOnRenewal(tenantId) {
  if (!process.env.PADDLE_API_KEY) return 0;
  const { rows: subs } = await query(
    `SELECT id, paddle_subscription_id, monthly_total FROM subscriptions
     WHERE tenant_id = $1 AND status = 'active' AND paddle_subscription_id IS NOT NULL
     ORDER BY created_at DESC LIMIT 1`,
    [tenantId]
  );
  const sub = subs[0];
  if (!sub) return 0;
  const { rows: pending } = await query(
    "SELECT 1 FROM account_credits WHERE tenant_id = $1 AND status = 'scheduled' LIMIT 1",
    [tenantId]
  );
  if (pending[0]) return 0;
  const amount = await creditForPayment(tenantId, sub.monthly_total);
  if (amount <= 0) return 0;
  try {
    const discount = await createCreditDiscount({ amount, tenantId });
    await applyDiscountToNextRenewal({ subscriptionId: sub.paddle_subscription_id, discountId: discount.id });
    return withTransaction((client) => moveCredit(client, tenantId, amount, 'scheduled', { subscriptionId: sub.id, discountId: discount.id }));
  } catch (err) {
    console.error('Could not schedule account credit on Paddle renewal:', err.message);
    return 0;
  }
}

// A renewal carrying our discount was paid: the scheduled credit is spent,
// and any credit that arrived meanwhile goes on the following renewal.
export async function renewalPaid(tenantId) {
  await query(
    "UPDATE account_credits SET status = 'used', used_at = now() WHERE tenant_id = $1 AND status = 'scheduled'",
    [tenantId]
  );
  await scheduleCreditOnRenewal(tenantId);
}
