import { Router } from 'express';
import { query } from '../db.js';
import { requireAuth, requireRole } from '../auth/middleware.js';
import { calculatePricing } from '../../../shared/pricing.js';
import { createCheckoutTransaction, updateSubscriptionQuantities, cancelSubscription } from '../paddle/client.js';
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
    "SELECT * FROM subscriptions WHERE tenant_id = $1 AND status = 'active' ORDER BY created_at DESC LIMIT 1",
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

  try {
    const transaction = process.env.PADDLE_API_KEY
      ? await createCheckoutTransaction({
          customerEmail: userRows[0].email,
          branchCount: pricing.branchCount,
          userCount: pricing.userCount,
          branchRate: pricing.branchBlendedRate,
          userRate: pricing.userBlendedRate,
          tenantId: tenant.id,
        })
      : mockTransaction(pricing); // lets the flow run end-to-end without real Paddle keys in dev

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
                                   monthly_total = $5, paddle_transaction_id = $6, updated_at = now()
         WHERE id = $7`,
        [pricing.branchCount, pricing.userCount, pricing.branchBlendedRate, pricing.userBlendedRate, pricing.monthlyTotal, transaction.id, existingPending[0].id]
      );
    } else {
      await query(
        `INSERT INTO subscriptions (tenant_id, branch_count, user_count, branch_rate, user_rate, monthly_total, status, paddle_transaction_id)
         VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7)`,
        [tenant.id, pricing.branchCount, pricing.userCount, pricing.branchBlendedRate, pricing.userBlendedRate, pricing.monthlyTotal, transaction.id]
      );
    }

    res.json({ transactionId: transaction.id, pricing, mock: !process.env.PADDLE_API_KEY });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

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
  await query("UPDATE tenants SET onboarding_step = 'onboarding' WHERE id = $1", [req.auth.tenantId]);
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
  const { branchCount, userCount } = req.body;
  const pricing = calculatePricing({ branches: branchCount, users: userCount });

  const { rows } = await query(
    "SELECT * FROM subscriptions WHERE tenant_id = $1 AND status = 'active' ORDER BY created_at DESC LIMIT 1",
    [req.auth.tenantId]
  );
  const sub = rows[0];
  if (!sub) return res.status(404).json({ error: 'No active subscription' });

  if (sub.paddle_subscription_id && process.env.PADDLE_API_KEY) {
    await updateSubscriptionQuantities({
      subscriptionId: sub.paddle_subscription_id,
      branchCount: pricing.branchCount,
      userCount: pricing.userCount,
      branchRate: pricing.branchBlendedRate,
      userRate: pricing.userBlendedRate,
    });
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
    "SELECT * FROM subscriptions WHERE tenant_id = $1 AND status = 'active' ORDER BY created_at DESC LIMIT 1",
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

  const event = JSON.parse(req.body.toString('utf8'));
  const tenantId = event.data?.custom_data?.tenantId;

  switch (event.event_type) {
    case 'transaction.completed': {
      if (tenantId) {
        await query(
          "UPDATE subscriptions SET status = 'active', paddle_customer_id = $1 WHERE tenant_id = $2 AND paddle_transaction_id = $3",
          [event.data.customer_id, tenantId, event.data.id]
        );
        await query("UPDATE tenants SET onboarding_step = 'onboarding' WHERE id = $1", [tenantId]);
      }
      break;
    }
    case 'subscription.created':
    case 'subscription.updated': {
      if (tenantId) {
        await query(
          `UPDATE subscriptions SET paddle_subscription_id = $1, status = $2, current_period_end = $3, updated_at = now()
           WHERE id = (SELECT id FROM subscriptions WHERE tenant_id = $4 ORDER BY created_at DESC LIMIT 1)`,
          [event.data.id, event.data.status === 'active' ? 'active' : event.data.status, event.data.current_billing_period?.ends_at || null, tenantId]
        );
      }
      break;
    }
    case 'subscription.canceled': {
      if (tenantId) {
        await query("UPDATE subscriptions SET status = 'canceled', updated_at = now() WHERE tenant_id = $1", [tenantId]);
      }
      break;
    }
    default:
      break;
  }

  res.status(200).json({ received: true });
}
