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

const cents = (amount) => String(Math.round(Number(amount) * 100));

// Non-catalog prices must belong to a product. Use a catalog product when
// one is configured; otherwise describe one inline (Paddle creates it).
// Without either, Paddle rejects the transaction outright.
function productFields() {
  return process.env.PADDLE_PRODUCT_ID
    ? { product_id: process.env.PADDLE_PRODUCT_ID }
    : { product: { name: 'SOPY subscription', tax_category: process.env.PADDLE_TAX_CATEGORY || 'standard' } };
}

// One line per resource, charged as quantity 1 at that resource's exact
// tapered subtotal. The previous version sent quantity × blended rate
// rounded to cents, which drifts from the tapered total (2 branches:
// 2 × $9.83 = $19.66, while the pricing page and our records said
// $19.67), so the customer was billed a different amount than shown.
// `pricing` is calculatePricing()'s result from shared/pricing.js.
export function buildLineItems(pricing) {
  const line = (name, count, subtotal) => ({
    quantity: 1,
    price: {
      name,
      description: `SOPY — ${count} ${name.toLowerCase()}`,
      billing_cycle: { interval: 'month', frequency: 1 },
      unit_price: { amount: cents(subtotal), currency_code: 'USD' },
      ...productFields(),
    },
  });
  return [
    line('Branches', pricing.branchCount, pricing.branchSubtotal),
    line('Users', pricing.userCount, pricing.userSubtotal),
  ];
}

export async function createCheckoutTransaction({ customerEmail, pricing, tenantId, discountId }) {
  return paddleRequest('/transactions', {
    method: 'POST',
    body: {
      items: buildLineItems(pricing),
      custom_data: { tenantId },
      customer: customerEmail ? { email: customerEmail } : undefined,
      collection_mode: 'automatic',
      ...(discountId ? { discount_id: discountId } : {}),
    },
  });
}

// A single-use, non-recurring flat discount — how account credit
// (referral cash back) is taken off one payment.
export async function createCreditDiscount({ amount, tenantId }) {
  return paddleRequest('/discounts', {
    method: 'POST',
    body: {
      description: 'SOPY account credit',
      type: 'flat',
      amount: cents(amount),
      currency_code: 'USD',
      enabled_for_checkout: false,
      recur: false,
      usage_limit: 1,
      custom_data: { tenantId },
    },
  });
}

// Puts a discount on the subscription's next renewal only.
export async function applyDiscountToNextRenewal({ subscriptionId, discountId }) {
  return paddleRequest(`/subscriptions/${subscriptionId}`, {
    method: 'PATCH',
    body: { discount: { id: discountId, effective_from: 'next_billing_period' } },
  });
}

// Replaces the subscription's items with the new plan. Paddle prorates
// automatically with 'prorated_immediately'.
export async function updateSubscriptionQuantities({ subscriptionId, pricing }) {
  return paddleRequest(`/subscriptions/${subscriptionId}`, {
    method: 'PATCH',
    body: {
      proration_billing_mode: 'prorated_immediately',
      items: buildLineItems(pricing),
    },
  });
}

export async function cancelSubscription(subscriptionId) {
  return paddleRequest(`/subscriptions/${subscriptionId}/cancel`, { method: 'POST', body: { effective_from: 'next_billing_period' } });
}

// Undoes a cancel that was scheduled for the end of the billing period.
// Paddle removes a scheduled change when it's set to null.
export async function resumeSubscription(subscriptionId) {
  return paddleRequest(`/subscriptions/${subscriptionId}`, { method: 'PATCH', body: { scheduled_change: null } });
}
