import crypto from 'node:crypto';
import { Router } from 'express';
import { query } from '../db.js';
import { requireAuth, requireRole } from '../auth/middleware.js';
import { calculatePricing, clampPlanCount, PLAN_LIMITS } from '../../../shared/pricing.js';
import { createCheckoutTransaction, updateSubscriptionQuantities, cancelSubscription, resumeSubscription, createCreditDiscount } from '../paddle/client.js';
import { creditForPayment, availableCreditKind, spendCreditOnCheckout, grantReferralReward, renewalPaid, releaseScheduledCredit } from '../credits.js';
import { verifyPaddleSignature } from '../paddle/webhook.js';
import {
  paymobConfigured, egpCents, egpPerUsd, createIntention, checkoutUrl,
  transactionFromCallback, transactionFromRedirect, verifyPaymobHmac, isPaid,
} from '../paymob/client.js';

export const billingRouter = Router();

// Step 5: create a Paddle transaction for the current tenant's plan.
// Frontend opens this transaction in the Paddle.js checkout overlay.
billingRouter.post('/checkout', requireAuth, requireRole('business_owner'), async (req, res) => {
  const { rows: tenantRows } = await query('SELECT * FROM tenants WHERE id = $1', [req.auth.tenantId]);
  const tenant = tenantRows[0];
  const { rows: userRows } = await query('SELECT email FROM users WHERE id = $1', [req.auth.userId]);

  // Never start a second checkout for a tenant that has already paid.
  // Without this, simply re-opening /checkout (back button, bookmark,
  // refresh after paying) inserted a fresh 'pending' row — and since
  // GET /subscription returns the newest row, that pending row masked
  // the customer's active subscription. With real Paddle keys it would
  // also mint a second transaction the customer could pay a second time.
  const { rows: activeRows } = await query(
    "SELECT * FROM subscriptions WHERE tenant_id = $1 AND status IN ('active', 'past_due') ORDER BY created_at DESC LIMIT 1",
    [req.auth.tenantId]
  );
  if (activeRows[0]) {
    const active = activeRows[0];
    return res.json({
      alreadyActive: true,
      subscription: active,
      pricing: calculatePricing({ branches: active.branch_count, users: active.user_count }),
      mock: !process.env.PADDLE_API_KEY,
    });
  }

  // Canceled, but the month is paid and still running: that plan can simply
  // be kept (POST /subscription/resume). A new checkout here charged a second
  // month on top of it, and its pending row hid the paid plan on Account.
  const resumable = await resumableSubscription(req.auth.tenantId);
  if (resumable) {
    return res.json({
      canResume: true,
      subscription: resumable,
      pricing: calculatePricing({ branches: resumable.branch_count, users: resumable.user_count }),
      mock: !process.env.PADDLE_API_KEY,
    });
  }

  // A plan needs at least one branch and one user. The tapered schedule
  // happily returns $0.00 for zero of each, which would provision a free
  // account — the Pricing page guards this too, but it's the server's
  // call to make, not the browser's.
  if (!(tenant.branch_count >= 1) || !(tenant.user_count >= 1)) {
    return res.status(400).json({ error: 'Your plan needs at least 1 branch and 1 user before checkout.' });
  }

  const pricing = calculatePricing({ branches: tenant.branch_count, users: tenant.user_count });
  // Account credit (referral cash back) comes off this first payment.
  // Recorded on the checkout row and only spent once the payment is
  // confirmed, so an abandoned checkout doesn't eat the credit.
  const creditApplied = await creditForPayment(tenant.id, pricing.monthlyTotal);
  const creditKind = creditApplied > 0 ? await availableCreditKind(tenant.id) : null;
  const respond = (transactionId) => res.json({
    transactionId,
    pricing,
    creditApplied,
    creditKind,
    dueToday: Math.round((pricing.monthlyTotal - creditApplied) * 100) / 100,
    mock: !process.env.PADDLE_API_KEY,
  });

  // A device in Egypt (or a business registered there, when the phone
  // won't say where it is) pays in EGP through Paymob. The browser
  // decides; without Paymob set up, everyone gets the card checkout.
  if (req.body?.method === 'paymob' && paymobConfigured()) {
    try {
      const { rows: pendingPaymob } = await query(
        "SELECT id FROM subscriptions WHERE tenant_id = $1 AND status = 'pending' ORDER BY created_at DESC LIMIT 1",
        [tenant.id]
      );
      const values = [pricing.branchCount, pricing.userCount, pricing.branchBlendedRate, pricing.userBlendedRate, pricing.monthlyTotal, creditApplied];
      const { rows: row } = pendingPaymob[0]
        ? await query(
          `UPDATE subscriptions SET branch_count = $1, user_count = $2, branch_rate = $3, user_rate = $4, monthly_total = $5,
                  credit_applied = $6, provider = 'paymob', paddle_transaction_id = NULL, updated_at = now()
           WHERE id = $7 RETURNING id`,
          [...values, pendingPaymob[0].id]
        )
        : await query(
          `INSERT INTO subscriptions (tenant_id, branch_count, user_count, branch_rate, user_rate, monthly_total, credit_applied, status, provider)
           VALUES ($7, $1, $2, $3, $4, $5, $6, 'pending', 'paymob') RETURNING id`,
          [...values, tenant.id]
        );
      const dueToday = round2(pricing.monthlyTotal - creditApplied);
      const started = await startPaymobPayment(req, {
        subscriptionId: row[0].id, purpose: 'checkout', branchCount: pricing.branchCount, userCount: pricing.userCount,
        amountUsd: dueToday, creditApplied, returnPath: '/checkout',
      });
      return res.json({
        provider: 'paymob', pricing, creditApplied, creditKind, dueToday,
        ...(started.settled ? { settled: true } : { paymob: paymobView(started.payment, started.checkoutUrl) }),
      });
    } catch (err) {
      return res.status(502).json({ error: err.message });
    }
  }

  // Nothing about the order changed since the last call (a refresh, the
  // back button, reopening the page while a payment is being confirmed):
  // hand back the same transaction. Minting a new one each time replaced
  // the id the customer had just paid, so that payment's webhook matched
  // no row and they were offered a second transaction to pay again.
  const { rows: pendingRows } = await query(
    "SELECT * FROM subscriptions WHERE tenant_id = $1 AND status = 'pending' ORDER BY created_at DESC LIMIT 1",
    [tenant.id]
  );
  const pending = pendingRows[0];
  const isMockTxn = (id) => String(id || '').startsWith('mock_txn_');
  if (
    pending?.paddle_transaction_id &&
    isMockTxn(pending.paddle_transaction_id) === !process.env.PADDLE_API_KEY &&
    pending.branch_count === pricing.branchCount &&
    pending.user_count === pricing.userCount &&
    Number(pending.monthly_total) === Number(pricing.monthlyTotal) &&
    Number(pending.credit_applied || 0) === Number(creditApplied)
  ) {
    return respond(pending.paddle_transaction_id);
  }

  try {
    let transaction;
    if (process.env.PADDLE_API_KEY) {
      const discount = creditApplied > 0 ? await createCreditDiscount({ amount: creditApplied, tenantId: tenant.id }) : null;
      transaction = await createCheckoutTransaction({ customerEmail: userRows[0].email, pricing, tenantId: tenant.id, discountId: discount?.id });
    } else {
      transaction = mockTransaction(pricing); // lets the flow run end-to-end without real Paddle keys in dev
    }

    // Idempotent: reuse the tenant's existing pending subscription row
    // instead of inserting a new one each time /checkout is called — the
    // checkout page can legitimately re-fire this (React StrictMode's
    // double-invoked effects in dev, a refresh, back/forward navigation),
    // and each call would otherwise leave behind an orphaned Paddle
    // transaction and a duplicate pending row.
    if (pending) {
      await query(
        `UPDATE subscriptions SET branch_count = $1, user_count = $2, branch_rate = $3, user_rate = $4,
                                   monthly_total = $5, paddle_transaction_id = $6, credit_applied = $7, provider = 'paddle', updated_at = now()
         WHERE id = $8`,
        [pricing.branchCount, pricing.userCount, pricing.branchBlendedRate, pricing.userBlendedRate, pricing.monthlyTotal, transaction.id, creditApplied, pending.id]
      );
    } else {
      await query(
        `INSERT INTO subscriptions (tenant_id, branch_count, user_count, branch_rate, user_rate, monthly_total, status, paddle_transaction_id, credit_applied)
         VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7, $8)`,
        [tenant.id, pricing.branchCount, pricing.userCount, pricing.branchBlendedRate, pricing.userBlendedRate, pricing.monthlyTotal, transaction.id, creditApplied]
      );
    }

    respond(transaction.id);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// Paying moves a new signup on to the setup wizard. A business that
// already finished setup (resubscribing from the Account page after a
// cancel, or never having had a subscription) must stay where it is —
// unconditionally setting 'onboarding' sent it back through the wizard.
function advancePastCheckout(tenantId) {
  return query(
    "UPDATE tenants SET onboarding_step = 'onboarding' WHERE id = $1 AND onboarding_step IN ('configure_data', 'pricing', 'checkout')",
    [tenantId]
  );
}

// A checkout was paid: spend the credit that was taken off it, and — if
// this business signed up through someone's referral link — reward them
// (once, on the first payment only).
async function paymentConfirmed(tenantId, subscription) {
  await spendCreditOnCheckout(tenantId, subscription.id, subscription.credit_applied);
  await grantReferralReward(tenantId);
}

// --- Paymob (Egypt) ---------------------------------------------------
// Paymob charges once rather than monthly, so a Paymob plan is paid a
// month at a time: checkout pays the first month, "Pay for next month"
// each one after (see auth/plan.js for what happens when one is missed),
// and growing the plan pays the difference for the rest of the month.

const MONTH_MS = 30 * 24 * 60 * 60 * 1000;
const round2 = (n) => Math.round(Number(n) * 100) / 100;

// Where Paymob sends the customer back to and posts its result.
function appBaseUrl(req) {
  return (process.env.APP_URL || req.get('origin') || `${req.protocol}://${req.get('host')}`).replace(/\/+$/, '');
}

const paymobView = (payment, url) => ({ checkoutUrl: url, amountEgp: Number(payment.amount_egp_cents) / 100, egpPerUsd: egpPerUsd() });

// Starts a Paymob payment, or hands back the same one if it's still
// waiting to be paid (a refresh, the back button), as Paddle checkout
// does. Under 1 EGP left to pay (credit covered it, or a plan change at
// the very end of a month) there's nothing to charge: it's settled at once.
async function startPaymobPayment(req, { subscriptionId, purpose, branchCount, userCount, amountUsd, creditApplied = 0, returnPath }) {
  let amountCents = egpCents(amountUsd);
  if (amountCents < 100) amountCents = 0;
  const { rows: same } = await query(
    `SELECT * FROM paymob_payments
     WHERE subscription_id = $1 AND purpose = $2 AND status = 'pending' AND branch_count = $3 AND user_count = $4
       AND amount_egp_cents = $5 AND credit_applied = $6 AND client_secret IS NOT NULL AND created_at > now() - interval '12 hours'
     ORDER BY created_at DESC LIMIT 1`,
    [subscriptionId, purpose, branchCount, userCount, amountCents, creditApplied]
  );
  if (same[0]) return { payment: same[0], checkoutUrl: checkoutUrl(same[0].client_secret) };

  const reference = `sopy-${purpose}-${crypto.randomUUID()}`;
  let intention = { clientSecret: null, orderId: null };
  if (amountCents > 0) {
    const { rows: owner } = await query('SELECT full_name, email, phone FROM users WHERE id = $1', [req.auth.userId]);
    const base = appBaseUrl(req);
    intention = await createIntention({
      amountCents,
      reference,
      description: `SOPY: ${branchCount} store(s), ${userCount} user(s), ${purpose === 'upgrade' ? 'bigger plan for the time already paid' : '1 month'}`,
      customer: { fullName: owner[0].full_name, email: owner[0].email, phone: owner[0].phone },
      notificationUrl: `${base}/api/billing/paymob/webhook`,
      redirectionUrl: `${base}${returnPath}`,
    });
  }
  const { rows } = await query(
    `INSERT INTO paymob_payments (tenant_id, subscription_id, purpose, branch_count, user_count, amount_usd, credit_applied,
                                  amount_egp_cents, reference, paymob_order_id, client_secret)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
    [req.auth.tenantId, subscriptionId, purpose, branchCount, userCount, round2(amountUsd), creditApplied, amountCents, reference, intention.orderId, intention.clientSecret]
  );
  if (amountCents === 0) {
    await confirmPaymobPayment(rows[0], null);
    return { payment: rows[0], settled: true };
  }
  return { payment: rows[0], checkoutUrl: checkoutUrl(intention.clientSecret) };
}

// A Paymob payment went through: apply it, once. Paymob retries its
// callback, and the customer's browser reports the same payment on its
// way back, so only the first report (pending → paid) does anything.
async function confirmPaymobPayment(payment, transactionId) {
  const { rows } = await query(
    "UPDATE paymob_payments SET status = 'paid', paid_at = now(), paymob_transaction_id = $2 WHERE id = $1 AND status = 'pending' RETURNING *",
    [payment.id, transactionId == null ? null : String(transactionId)]
  );
  const paid = rows[0];
  if (!paid) return false;
  const pricing = calculatePricing({ branches: paid.branch_count, users: paid.user_count });

  if (paid.purpose === 'checkout') {
    const { rows: activated } = await query(
      `UPDATE subscriptions SET status = 'active', provider = 'paymob', branch_count = $2, user_count = $3, branch_rate = $4,
              user_rate = $5, monthly_total = $6, credit_applied = $7, current_period_end = now() + interval '30 days', updated_at = now()
       WHERE id = $1 AND status = 'pending'
         AND NOT EXISTS (SELECT 1 FROM subscriptions WHERE tenant_id = $8 AND status IN ('active', 'past_due'))
       RETURNING *`,
      [paid.subscription_id, pricing.branchCount, pricing.userCount, pricing.branchBlendedRate, pricing.userBlendedRate,
        pricing.monthlyTotal, paid.credit_applied, paid.tenant_id]
    );
    if (activated[0]) {
      await query('UPDATE tenants SET branch_count = $1, user_count = $2 WHERE id = $3', [pricing.branchCount, pricing.userCount, paid.tenant_id]);
      await advancePastCheckout(paid.tenant_id);
      await paymentConfirmed(paid.tenant_id, activated[0]);
    } else {
      console.warn(`Paymob payment ${paid.reference} was paid, but tenant ${paid.tenant_id} has no checkout waiting for it (already active?)`);
    }
  } else if (paid.purpose === 'renewal') {
    // Paying early adds the month after the one already paid for.
    await query(
      `UPDATE subscriptions SET status = 'active', current_period_end = GREATEST(now(), COALESCE(current_period_end, now())) + interval '30 days', updated_at = now()
       WHERE id = $1`,
      [paid.subscription_id]
    );
    await spendCreditOnCheckout(paid.tenant_id, paid.subscription_id, paid.credit_applied);
  } else if (paid.purpose === 'upgrade') {
    await query(
      `UPDATE subscriptions SET branch_count = $2, user_count = $3, branch_rate = $4, user_rate = $5, monthly_total = $6, updated_at = now()
       WHERE id = $1`,
      [paid.subscription_id, pricing.branchCount, pricing.userCount, pricing.branchBlendedRate, pricing.userBlendedRate, pricing.monthlyTotal]
    );
    await query('UPDATE tenants SET branch_count = $1, user_count = $2 WHERE id = $3', [pricing.branchCount, pricing.userCount, paid.tenant_id]);
  }
  return true;
}

// A signed Paymob transaction: find the payment it's for and apply it if
// it was paid in full, for the amount we asked.
async function applyPaymobTransaction(txn, tenantId = null) {
  if (!isPaid(txn.fields)) return { applied: false, paid: false };
  const { rows } = await query(
    `SELECT * FROM paymob_payments
     WHERE (reference = $1 OR paymob_order_id = $2) AND ($3::uuid IS NULL OR tenant_id = $3)
     ORDER BY (reference = $1) DESC LIMIT 1`,
    [String(txn.merchantOrderId ?? ''), String(txn.orderId ?? ''), tenantId]
  );
  const payment = rows[0];
  if (!payment) return { applied: false, paid: true, unknown: true };
  if (String(txn.fields.currency) !== 'EGP' || Number(txn.fields.amount_cents) !== Number(payment.amount_egp_cents)) {
    console.warn(`Paymob payment ${payment.reference}: paid ${txn.fields.amount_cents} ${txn.fields.currency}, expected ${payment.amount_egp_cents} EGP; not applied`);
    return { applied: false, paid: true, mismatch: true };
  }
  return { applied: await confirmPaymobPayment(payment, txn.fields.id), paid: true };
}

// Paymob's server-to-server result ("transaction processed callback").
// No session: the HMAC signature is the proof it came from Paymob.
billingRouter.post('/paymob/webhook', async (req, res) => {
  if (!paymobConfigured()) return res.status(503).json({ error: 'Paymob is not set up' });
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  if (body.type !== 'TRANSACTION') return res.json({ received: true });
  const txn = transactionFromCallback(body.obj);
  const hmac = typeof req.query.hmac === 'string' ? req.query.hmac : body.hmac;
  if (!verifyPaymobHmac(txn, hmac)) return res.status(401).json({ error: 'Invalid signature' });
  await applyPaymobTransaction(txn);
  res.json({ received: true });
});

// The customer's browser coming back from Paymob, with the signed result
// in its address. Applying it here too means a payment still counts when
// Paymob's callback can't reach the server.
billingRouter.post('/paymob/return', requireAuth, requireRole('business_owner'), async (req, res) => {
  if (!paymobConfigured()) return res.status(503).json({ error: 'Paymob is not set up' });
  const q = req.body && typeof req.body === 'object' ? req.body : {};
  const txn = transactionFromRedirect(q);
  if (!verifyPaymobHmac(txn, q.hmac)) return res.status(400).json({ error: 'This payment result could not be checked' });
  const result = await applyPaymobTransaction(txn, req.auth.tenantId);
  res.json({ paid: result.paid, applied: result.applied });
});

// Pay for the next month of a Paymob plan.
billingRouter.post('/paymob/renew', requireAuth, requireRole('business_owner'), async (req, res) => {
  if (!paymobConfigured()) return res.status(409).json({ error: 'Paying in EGP is not available right now' });
  const { rows } = await query(
    "SELECT * FROM subscriptions WHERE tenant_id = $1 AND provider = 'paymob' AND status IN ('active', 'past_due') ORDER BY created_at DESC LIMIT 1",
    [req.auth.tenantId]
  );
  const sub = rows[0];
  if (!sub) return res.status(404).json({ error: 'No active subscription' });
  const credit = await creditForPayment(req.auth.tenantId, sub.monthly_total);
  try {
    const started = await startPaymobPayment(req, {
      subscriptionId: sub.id, purpose: 'renewal', branchCount: sub.branch_count, userCount: sub.user_count,
      amountUsd: round2(Number(sub.monthly_total) - credit), creditApplied: credit, returnPath: '/app/account',
    });
    res.json(started.settled ? { settled: true } : { paymob: paymobView(started.payment, started.checkoutUrl) });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// The newest canceled plan whose paid period hasn't ended yet, if any.
async function resumableSubscription(tenantId) {
  const { rows } = await query(
    "SELECT * FROM subscriptions WHERE tenant_id = $1 AND status = 'canceled' AND current_period_end > now() ORDER BY created_at DESC LIMIT 1",
    [tenantId]
  );
  return rows[0] || null;
}

function mockTransaction(pricing) {
  return { id: `mock_txn_${Date.now()}`, pricing };
}

// Dev-mode helper: marks the pending subscription active without a real
// Paddle webhook, so the onboarding flow can be exercised without keys.
billingRouter.post('/mock-complete', requireAuth, requireRole('business_owner'), async (req, res) => {
  if (process.env.PADDLE_API_KEY) return res.status(400).json({ error: 'Paddle is configured — use real checkout' });
  const { rows } = await query(
    `UPDATE subscriptions SET status = 'active', current_period_end = now() + interval '30 days', updated_at = now()
     WHERE id = (
       SELECT id FROM subscriptions WHERE tenant_id = $1 AND status = 'pending' ORDER BY created_at DESC LIMIT 1
     )
     RETURNING *`,
    [req.auth.tenantId]
  );
  if (!rows[0]) return res.status(409).json({ error: 'No checkout in progress' });
  await advancePastCheckout(req.auth.tenantId);
  await paymentConfirmed(req.auth.tenantId, rows[0]);
  res.json({ subscription: rows[0] });
});

// The subscription that describes the business's plan: a live one first,
// then a canceled one whose paid period is still running, and only then
// the newest row (an unpaid checkout, or a plan that has ended). Plain
// "newest row" let an abandoned checkout hide a plan that was still paid.
billingRouter.get('/subscription', requireAuth, async (req, res) => {
  const { rows } = await query(
    `SELECT * FROM subscriptions WHERE tenant_id = $1
     ORDER BY (status IN ('active', 'past_due')) DESC,
              (status = 'canceled' AND current_period_end > now()) DESC NULLS LAST,
              created_at DESC
     LIMIT 1`,
    [req.auth.tenantId]
  );
  const sub = rows[0] || null;
  // A Paymob plan is paid month by month: what the next month costs in EGP.
  if (sub?.provider === 'paymob' && paymobConfigured()) {
    const credit = await creditForPayment(req.auth.tenantId, sub.monthly_total);
    sub.paymob = { renewalEgp: egpCents(round2(Number(sub.monthly_total) - credit)) / 100, egpPerUsd: egpPerUsd() };
  }
  res.json({ subscription: sub });
});

// Called when a business owner changes branch/user counts after go-live —
// updates Paddle so the next invoice is prorated automatically.
billingRouter.patch('/subscription/quantities', requireAuth, requireRole('business_owner'), async (req, res) => {
  const branchCount = clampPlanCount(req.body.branchCount, PLAN_LIMITS.branches);
  const userCount = clampPlanCount(req.body.userCount, PLAN_LIMITS.users);
  if (branchCount === null || userCount === null) {
    return res.status(400).json({ error: 'Branch and user counts must be numbers' });
  }
  const pricing = calculatePricing({ branches: branchCount, users: userCount });

  const { rows } = await query(
    "SELECT * FROM subscriptions WHERE tenant_id = $1 AND status IN ('active', 'past_due') ORDER BY created_at DESC LIMIT 1",
    [req.auth.tenantId]
  );
  const sub = rows[0];
  if (!sub) return res.status(404).json({ error: 'No active subscription' });

  // Can't pay for fewer stores/users than are in use — the seats would
  // stay usable while the bill went down.
  const { rows: usage } = await query(
    `SELECT (SELECT count(*)::int FROM branches WHERE tenant_id = $1 AND is_active) AS branches,
            (SELECT count(*)::int FROM users WHERE tenant_id = $1 AND status != 'disabled') AS users`,
    [req.auth.tenantId]
  );
  if (pricing.branchCount < usage[0].branches) {
    return res.status(409).json({ error: `You have ${usage[0].branches} active stores. Remove stores in Team & stores before lowering the plan to ${pricing.branchCount}.` });
  }
  if (pricing.userCount < usage[0].users) {
    return res.status(409).json({ error: `You have ${usage[0].users} users (including pending invites). Disable users in Team & stores before lowering the plan to ${pricing.userCount}.` });
  }

  // A bigger Paymob plan: the difference for all the time already paid for
  // (months paid ahead included) is paid first, as Paddle prorates on its
  // next invoice. The plan only grows once Paymob confirms it. A smaller one applies at once
  // and the next month costs less.
  if (sub.provider === 'paymob' && pricing.monthlyTotal > Number(sub.monthly_total)) {
    if (!paymobConfigured()) return res.status(409).json({ error: 'Paying in EGP is not available right now' });
    const left = sub.current_period_end ? Math.max(0, new Date(sub.current_period_end).getTime() - Date.now()) : 0;
    try {
      const started = await startPaymobPayment(req, {
        subscriptionId: sub.id, purpose: 'upgrade', branchCount: pricing.branchCount, userCount: pricing.userCount,
        amountUsd: round2((pricing.monthlyTotal - Number(sub.monthly_total)) * (left / MONTH_MS)), returnPath: '/app/account',
      });
      if (!started.settled) return res.json({ paymentRequired: true, paymob: paymobView(started.payment, started.checkoutUrl), subscription: sub });
      const { rows: fresh } = await query('SELECT * FROM subscriptions WHERE id = $1', [sub.id]);
      return res.json({ subscription: fresh[0] });
    } catch (err) {
      return res.status(502).json({ error: err.message });
    }
  }

  if (sub.paddle_subscription_id && process.env.PADDLE_API_KEY) {
    await updateSubscriptionQuantities({ subscriptionId: sub.paddle_subscription_id, pricing });
  }

  const { rows: updated } = await query(
    `UPDATE subscriptions SET branch_count = $1, user_count = $2, branch_rate = $3, user_rate = $4, monthly_total = $5, updated_at = now()
     WHERE id = $6 RETURNING *`,
    [pricing.branchCount, pricing.userCount, pricing.branchBlendedRate, pricing.userBlendedRate, pricing.monthlyTotal, sub.id]
  );
  await query('UPDATE tenants SET branch_count = $1, user_count = $2 WHERE id = $3', [pricing.branchCount, pricing.userCount, req.auth.tenantId]);

  res.json({ subscription: updated[0] });
});

billingRouter.post('/subscription/cancel', requireAuth, requireRole('business_owner'), async (req, res) => {
  const { rows } = await query(
    "SELECT * FROM subscriptions WHERE tenant_id = $1 AND status IN ('active', 'past_due') ORDER BY created_at DESC LIMIT 1",
    [req.auth.tenantId]
  );
  const sub = rows[0];
  if (!sub) return res.status(404).json({ error: 'No active subscription' });

  if (sub.paddle_subscription_id && process.env.PADDLE_API_KEY) {
    await cancelSubscription(sub.paddle_subscription_id);
  }
  await query("UPDATE subscriptions SET status = 'canceled', updated_at = now() WHERE id = $1", [sub.id]);
  await releaseScheduledCredit(req.auth.tenantId);
  res.status(204).end();
});

// Changing your mind after canceling. Until the paid period ends the plan
// is still running, so this takes the cancel back rather than sending the
// owner through checkout, which charged a whole new month on top of the
// one already paid for. Once the period is over there's nothing left to
// resume and a new checkout is the way back.
billingRouter.post('/subscription/resume', requireAuth, requireRole('business_owner'), async (req, res) => {
  const { rows: live } = await query(
    "SELECT 1 FROM subscriptions WHERE tenant_id = $1 AND status IN ('active', 'past_due')",
    [req.auth.tenantId]
  );
  if (live[0]) return res.status(409).json({ error: 'There is no canceled plan to resume' });
  const sub = await resumableSubscription(req.auth.tenantId);
  if (!sub) return res.status(409).json({ error: 'Your plan has ended — subscribe again to continue' });

  if (sub.paddle_subscription_id && process.env.PADDLE_API_KEY) {
    try {
      await resumeSubscription(sub.paddle_subscription_id);
    } catch {
      // Canceled outright in Paddle (not just scheduled): it can't come back.
      return res.status(409).json({ error: 'Your plan has ended — subscribe again to continue' });
    }
  }
  const { rows: updated } = await query(
    "UPDATE subscriptions SET status = 'active', updated_at = now() WHERE id = $1 RETURNING *",
    [sub.id]
  );
  // Back to the plan that's paid for, in case a different one was priced
  // up after the cancel.
  await query('UPDATE tenants SET branch_count = $1, user_count = $2 WHERE id = $3', [sub.branch_count, sub.user_count, req.auth.tenantId]);
  // A checkout opened after the cancel is no longer needed. Dropping it also
  // means paying it later can't start a second plan (the webhook fallback
  // only activates a checkout when nothing else is live).
  await query("DELETE FROM subscriptions WHERE tenant_id = $1 AND status = 'pending'", [req.auth.tenantId]);
  res.json({ subscription: updated[0] });
});

// Paddle webhook — mounted with express.raw() in index.js so we have the
// exact bytes for signature verification. Handles the events needed to
// keep `subscriptions` in sync with what Paddle actually billed.
export async function paddleWebhookHandler(req, res) {
  const signature = req.headers['paddle-signature'];
  let valid;
  try {
    valid = verifyPaddleSignature(req.body.toString('utf8'), signature);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
  if (!valid) return res.status(401).json({ error: 'Invalid signature' });

  let event;
  try {
    event = JSON.parse(req.body.toString('utf8'));
  } catch {
    return res.status(400).json({ error: 'Malformed payload' });
  }
  const tenantId = event.data?.custom_data?.tenantId;
  const data = event.data || {};

  switch (event.event_type) {
    case 'transaction.completed': {
      if (tenantId) {
        // Only a pending checkout row activates, so Paddle retrying the
        // same event can't spend credit or reward a referrer twice.
        let { rows: activated } = await query(
          `UPDATE subscriptions SET status = 'active', paddle_customer_id = $1, updated_at = now()
           WHERE tenant_id = $2 AND paddle_transaction_id = $3 AND status = 'pending' RETURNING *`,
          [data.customer_id, tenantId, data.id]
        );
        // A checkout transaction we no longer have on file (the pending row
        // was re-priced after this one was opened) was still paid: activate
        // the business's checkout rather than leave a paying customer out.
        if (!activated[0] && data.origin !== 'subscription_recurring') {
          ({ rows: activated } = await query(
            `UPDATE subscriptions SET status = 'active', paddle_customer_id = $1, paddle_transaction_id = $3, updated_at = now()
             WHERE id = (SELECT id FROM subscriptions WHERE tenant_id = $2 AND status = 'pending' ORDER BY created_at DESC LIMIT 1)
               AND NOT EXISTS (SELECT 1 FROM subscriptions WHERE tenant_id = $2 AND status IN ('active', 'past_due'))
             RETURNING *`,
            [data.customer_id, tenantId, data.id]
          ));
          if (activated[0]) console.warn(`Paddle payment ${data.id} matched no checkout on file; activated tenant ${tenantId}'s pending checkout`);
        }
        if (activated[0]) {
          await advancePastCheckout(tenantId);
          await paymentConfirmed(tenantId, activated[0]);
        } else if (data.origin === 'subscription_recurring') {
          // A renewal was paid (a scheduled credit discount, if any, is now spent).
          await renewalPaid(tenantId, data.discount_id || null);
        }
      }
      break;
    }
    case 'subscription.created':
    case 'subscription.updated':
    case 'subscription.canceled': {
      if (!tenantId || !data.id) break;
      // A cancellation scheduled for the end of the period arrives as an
      // "active" subscription with scheduled_change.action = 'cancel'.
      // Our own cancel already marked the row canceled (the UI says access
      // continues until the period ends); taking Paddle's "active" at face
      // value flipped it back to Active on the next update.
      const status = event.event_type === 'subscription.canceled' || data.scheduled_change?.action === 'cancel'
        ? 'canceled'
        : data.status;
      const periodEnd = data.current_billing_period?.ends_at || data.scheduled_change?.effective_at || null;
      // Target the row for *this* subscription: by its Paddle id, or — the
      // first time we hear of it — the checkout row whose transaction
      // created it. This used to update "the newest row", so an update
      // about an old subscription overwrote a newer pending checkout, and
      // a cancel canceled every row the business had, new ones included.
      await query(
        `UPDATE subscriptions SET paddle_subscription_id = $1, status = $2,
                current_period_end = COALESCE($3::timestamptz, current_period_end), updated_at = now()
         WHERE id = (
           SELECT id FROM subscriptions
           WHERE tenant_id = $4
             AND (paddle_subscription_id = $1
                  OR (paddle_subscription_id IS NULL AND paddle_transaction_id = $5))
           ORDER BY (paddle_subscription_id = $1) DESC NULLS LAST, created_at DESC
           LIMIT 1
         )`,
        [data.id, status, periodEnd, tenantId, data.transaction_id || null]
      );
      if (status === 'canceled') await releaseScheduledCredit(tenantId);
      break;
    }
    default:
      break;
  }

  res.status(200).json({ received: true });
}
