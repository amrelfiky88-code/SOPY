import crypto from 'node:crypto';

// Paymob (Egypt) through its Intention API: SOPY creates a payment for
// the exact amount, sends the customer to Paymob's checkout page, and
// Paymob reports the result to /api/billing/paymob/webhook, signed with
// the HMAC secret. Docs: https://developers.paymob.com
//
// Settings (server/.env):
//   PAYMOB_SECRET_KEY       Dashboard > Settings > Account info: Secret key
//   PAYMOB_PUBLIC_KEY       same page: Public key
//   PAYMOB_INTEGRATION_IDS  Developers > Payment integrations, comma separated (card, wallet...)
//   PAYMOB_HMAC_SECRET      same Account info page: HMAC
//   PAYMOB_EGP_PER_USD      exchange rate used to turn USD prices into EGP
//   PAYMOB_BASE_URL         optional, default https://accept.paymob.com

const baseUrl = () => (process.env.PAYMOB_BASE_URL || 'https://accept.paymob.com').replace(/\/+$/, '');

export function egpPerUsd() {
  const rate = Number(process.env.PAYMOB_EGP_PER_USD);
  return Number.isFinite(rate) && rate > 0 ? rate : null;
}

export function paymobConfigured() {
  return !!(process.env.PAYMOB_SECRET_KEY && process.env.PAYMOB_PUBLIC_KEY && process.env.PAYMOB_HMAC_SECRET
    && integrationIds().length && egpPerUsd());
}

function integrationIds() {
  return String(process.env.PAYMOB_INTEGRATION_IDS || '')
    .split(',').map((s) => Number(s.trim())).filter((n) => Number.isInteger(n) && n > 0);
}

// USD → EGP piasters at the configured rate.
export function egpCents(usd) {
  return Math.max(0, Math.round(Number(usd) * egpPerUsd() * 100));
}

export function checkoutUrl(clientSecret) {
  return `${baseUrl()}/unifiedcheckout/?publicKey=${encodeURIComponent(process.env.PAYMOB_PUBLIC_KEY)}&clientSecret=${encodeURIComponent(clientSecret)}`;
}

// Paymob wants a full billing address; SOPY only has a name, email and
// maybe a phone, and Paymob accepts "NA" for the rest.
function billingData({ fullName, email, phone }) {
  const [first, ...rest] = String(fullName || 'SOPY customer').trim().split(/\s+/);
  return {
    first_name: first || 'SOPY', last_name: rest.join(' ') || first || 'Customer',
    email, phone_number: String(phone || '').replace(/[^\d+]/g, '') || 'NA', country: 'EG',
    apartment: 'NA', floor: 'NA', street: 'NA', building: 'NA', city: 'NA', state: 'NA',
  };
}

export async function createIntention({ amountCents, reference, description, customer, notificationUrl, redirectionUrl }) {
  const billing = billingData(customer);
  const res = await fetch(`${baseUrl()}/v1/intention/`, {
    method: 'POST',
    headers: { Authorization: `Token ${process.env.PAYMOB_SECRET_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      amount: amountCents,
      currency: 'EGP',
      payment_methods: integrationIds(),
      items: [{ name: 'SOPY subscription', amount: amountCents, description: description.slice(0, 255), quantity: 1 }],
      billing_data: billing,
      customer: { first_name: billing.first_name, last_name: billing.last_name, email: billing.email },
      special_reference: reference,
      notification_url: notificationUrl,
      redirection_url: redirectionUrl,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.client_secret) {
    console.error('Paymob intention failed:', res.status, JSON.stringify(data).slice(0, 500));
    throw new Error('Paymob could not start the payment. Try again in a moment.');
  }
  return { clientSecret: data.client_secret, orderId: data.intention_order_id != null ? String(data.intention_order_id) : null };
}

// The fields Paymob signs, in its order. The server-to-server callback
// sends them nested (obj.order.id, obj.source_data.pan); the browser
// redirect sends them flat (order, source_data.pan) in the query string.
const HMAC_FIELDS = [
  'amount_cents', 'created_at', 'currency', 'error_occured', 'has_parent_transaction', 'id', 'integration_id',
  'is_3d_secure', 'is_auth', 'is_capture', 'is_refunded', 'is_standalone_payment', 'is_voided', 'order.id', 'owner',
  'pending', 'source_data.pan', 'source_data.sub_type', 'source_data.type', 'success',
];

// One flat shape for both: what was paid and how it's signed.
export function transactionFromCallback(obj) {
  if (!obj || typeof obj !== 'object') return null;
  const get = (path) => path.split('.').reduce((v, k) => (v && typeof v === 'object' ? v[k] : undefined), obj);
  const fields = Object.fromEntries(HMAC_FIELDS.map((f) => [f, get(f)]));
  return { fields, orderId: get('order.id'), merchantOrderId: get('order.merchant_order_id') };
}

export function transactionFromRedirect(q) {
  if (!q || typeof q !== 'object') return null;
  const fields = Object.fromEntries(HMAC_FIELDS.map((f) => [f, f === 'order.id' ? q.order : q[f]]));
  return { fields, orderId: q.order, merchantOrderId: q.merchant_order_id };
}

export function verifyPaymobHmac(transaction, hmac) {
  if (!transaction || typeof hmac !== 'string' || !/^[0-9a-f]{128}$/i.test(hmac)) return false;
  const text = HMAC_FIELDS.map((f) => {
    const v = transaction.fields[f];
    return v === undefined || v === null ? '' : String(v);
  }).join('');
  const expected = crypto.createHmac('sha512', process.env.PAYMOB_HMAC_SECRET || '').update(text).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(hmac.toLowerCase()));
}

// Paid in full and final: not pending, voided or refunded.
export function isPaid(fields) {
  const yes = (v) => v === true || v === 'true';
  return yes(fields.success) && !yes(fields.pending) && !yes(fields.is_voided) && !yes(fields.is_refunded);
}
