// Thin wrapper around the Paddle Billing REST API.
// Docs: https://developer.paddle.com/api-reference/overview
const BASE_URL = process.env.PADDLE_ENV === 'production'
  ? 'https://api.paddle.com'
  : 'https://sandbox-api.paddle.com';

function apiKey() {
  const key = process.env.PADDLE_API_KEY;
  if (!key) throw new Error('PADDLE_API_KEY is not set — see server/.env.example');
  return key;
}

async function paddleRequest(pathname, { method = 'GET', body } = {}) {
  const res = await fetch(`${BASE_URL}${pathname}`, {
    method,
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = data?.error?.detail || `Paddle API error (${res.status})`;
    throw new Error(message);
  }
  return data.data;
}

// Creates a transaction with two custom (non-catalog) line items so the
// exact tapered total from the pricing calculator is what the customer is
// charged — Paddle supports inline custom prices for this.
// branchRate/userRate are the blended per-unit rates from shared/pricing.js.
export async function createCheckoutTransaction({ customerEmail, branchCount, userCount, branchRate, userRate, tenantId }) {
  return paddleRequest('/transactions', {
    method: 'POST',
    body: {
      items: [
        {
          quantity: branchCount,
          price: {
            description: 'SOPY — Branches',
            name: 'Branches',
            billing_cycle: { interval: 'month', frequency: 1 },
            unit_price: { amount: String(Math.round(branchRate * 100)), currency_code: 'USD' },
            product_id: process.env.PADDLE_PRODUCT_ID || undefined,
          },
        },
        {
          quantity: userCount,
          price: {
            description: 'SOPY — Users',
            name: 'Users',
            billing_cycle: { interval: 'month', frequency: 1 },
            unit_price: { amount: String(Math.round(userRate * 100)), currency_code: 'USD' },
            product_id: process.env.PADDLE_PRODUCT_ID || undefined,
          },
        },
      ],
      custom_data: { tenantId },
      customer: customerEmail ? { email: customerEmail } : undefined,
      collection_mode: 'automatic',
    },
  });
}

// Updates an existing subscription's quantities. Paddle prorates
// automatically when proration_billing_mode is 'prorated_immediately'.
export async function updateSubscriptionQuantities({ subscriptionId, branchCount, userCount, branchRate, userRate }) {
  return paddleRequest(`/subscriptions/${subscriptionId}`, {
    method: 'PATCH',
    body: {
      proration_billing_mode: 'prorated_immediately',
      items: [
        {
          quantity: branchCount,
          price: {
            description: 'SOPY — Branches',
            name: 'Branches',
            billing_cycle: { interval: 'month', frequency: 1 },
            unit_price: { amount: String(Math.round(branchRate * 100)), currency_code: 'USD' },
          },
        },
        {
          quantity: userCount,
          price: {
            description: 'SOPY — Users',
            name: 'Users',
            billing_cycle: { interval: 'month', frequency: 1 },
            unit_price: { amount: String(Math.round(userRate * 100)), currency_code: 'USD' },
          },
        },
      ],
    },
  });
}

export async function cancelSubscription(subscriptionId) {
  return paddleRequest(`/subscriptions/${subscriptionId}/cancel`, { method: 'POST', body: { effective_from: 'next_billing_period' } });
}
