import { Router } from 'express';
import { query } from '../db.js';
import { requireAuth, requireRole } from '../auth/middleware.js';
import { calculatePricing, clampPlanCount, PLAN_LIMITS } from '../../../shared/pricing.js';
import { createCheckoutTransaction, updateSubscriptionQuantities, cancelSubscription, createCreditDiscount } from '../paddle/client.js';
import { creditForPayment, availableCreditKind, spendCreditOnCheckout, grantReferralReward, renewalPaid } from '../credits.js';
import { verifyPaddleSignature } from '../paddle/webhook.js';

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
    const { rows: existingPending } = await query(
      "SELECT id FROM subscriptions WHERE tenant_id = $1 AND status = 'pending' ORDER BY created_at DESC LIMIT 1",
      [tenant.id]
    );
    if (existingPending[0]) {
      await query(
        `UPDATE subscriptions SET branch_count = $1, user_count = $2, branch_rate = $3, user_rate = $4,
                                   monthly_total = $5, paddle_transaction_id = $6, credit_applied = $7, updated_at = now()
         WHERE id = $8`,
        [pricing.branchCount, pricing.userCount, pricing.branchBlendedRate, pricing.userBlendedRate, pricing.monthlyTotal, transaction.id, creditApplied, existingPending[0].id]
      );
    } else {
      await query(
        `INSERT INTO subscriptions (tenant_id, branch_count, user_count, branch_rate, user_rate, monthly_total, status, paddle_transaction_id, credit_applied)
         VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7, $8)`,
        [tenant.id, pricing.branchCount, pricing.userCount, pricing.branchBlendedRate, pricing.userBlendedRate, pricing.monthlyTotal, transaction.id, creditApplied]
      );
    }

    res.json({
      transactionId: transaction.id,
      pricing,
      creditApplied,
      creditKind,
      dueToday: Math.round((pricing.monthlyTotal - creditApplied) * 100) / 100,
      mock: !process.env.PADDLE_API_KEY,
    });
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

billingRouter.get('/subscription', requireAuth, async (req, res) => {
  const { rows } = await query(
    'SELECT * FROM subscriptions WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 1',
    [req.auth.tenantId]
  );
  res.json({ subscription: rows[0] || null });
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
  res.status(204).end();
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
        const { rows: activated } = await query(
          `UPDATE subscriptions SET status = 'active', paddle_customer_id = $1, updated_at = now()
           WHERE tenant_id = $2 AND paddle_transaction_id = $3 AND status = 'pending' RETURNING *`,
          [data.customer_id, tenantId, data.id]
        );
        if (activated[0]) {
          await advancePastCheckout(tenantId);
          await paymentConfirmed(tenantId, activated[0]);
        } else if (data.origin === 'subscription_recurring') {
          // A renewal was paid (a scheduled credit discount, if any, is now spent).
          await renewalPaid(tenantId);
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
      break;
    }
    default:
      break;
  }

  res.status(200).json({ received: true });
}
