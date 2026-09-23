import crypto from 'node:crypto';

// Verifies the Paddle-Signature header against the raw request body.
// Format: "ts=<timestamp>;h1=<hmac>" — see
// https://developer.paddle.com/webhooks/signature-verification
export function verifyPaddleSignature(rawBody, signatureHeader) {
  const secret = process.env.PADDLE_WEBHOOK_SECRET;
  if (!secret) throw new Error('PADDLE_WEBHOOK_SECRET is not set');
  if (!signatureHeader) return false;

  const parts = Object.fromEntries(
    signatureHeader.split(';').map((p) => p.split('='))
  );
  const { ts, h1 } = parts;
  if (!ts || !h1) return false;

  // Reject stale signatures so a captured webhook can't be replayed later
  // (e.g. an old "transaction.completed" re-activating a canceled plan).
  const ageSeconds = Math.abs(Date.now() / 1000 - Number(ts));
  if (!Number.isFinite(ageSeconds) || ageSeconds > MAX_AGE_SECONDS) return false;

  const signedPayload = `${ts}:${rawBody}`;
  const expected = crypto.createHmac('sha256', secret).update(signedPayload).digest('hex');

  const a = Buffer.from(expected, 'hex');
  const b = Buffer.from(h1, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Paddle retries failed deliveries with a fresh signature, so a short
// window doesn't lose events.
const MAX_AGE_SECONDS = 5 * 60;
