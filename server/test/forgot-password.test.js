import { before, after, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { resetTestDb, closeDb } from '../test-utils/db.js';
import { startTestServer, makeClient } from '../test-utils/server.js';
import { pool } from '../src/db.js';
import { setMessageSender } from '../src/delivery.js';
import { resetForgotLimits } from '../src/routes/forgot.routes.js';

let close, api;
let sent = [];
const codeIn = (message) => (message.channel === 'email' ? message.subject : message.text).match(/\d{6}/)[0];

async function signup(email, extra = {}) {
  const res = await api('POST', '/api/auth/signup', {
    body: { fullName: 'Mona Owner', email, password: 'OldPass123', restaurantName: `R ${email}`, country: 'Egypt', branchCount: 1, userCount: 5, ...extra },
  });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  return { token: res.body.token, userId: res.body.user.id };
}

before(async () => {
  await resetTestDb();
  const server = await startTestServer();
  close = server.close;
  api = makeClient(server.baseUrl);
});

beforeEach(() => {
  sent = [];
  setMessageSender((message) => { sent.push(message); });
  resetForgotLimits();
});

after(async () => {
  setMessageSender(null);
  await close();
  await closeDb();
});

test('a code by email resets the password, signs in, and signs out other devices', async () => {
  const owner = await signup('mona@example.com');
  // Sessions are stamped to the second, with a second's grace: make this
  // one strictly older than the reset.
  await new Promise((r) => setTimeout(r, 1100));
  assert.equal((await api('GET', '/api/auth/forgot/options')).body.email, true);

  const asked = await api('POST', '/api/auth/forgot', { body: { email: ' Mona@Example.com ', language: 'ar' } });
  assert.equal(asked.status, 200);
  assert.deepEqual(asked.body, { sent: true });
  assert.equal(sent.length, 1);
  assert.equal(sent[0].channel, 'email');
  assert.equal(sent[0].to, 'mona@example.com');
  // In the language of the page they asked from.
  assert.match(sent[0].subject, /رمز/);
  assert.match(sent[0].html, /dir="rtl"/);
  const code = codeIn(sent[0]);
  assert.match(sent[0].text, new RegExp(code));

  const wrong = await api('POST', '/api/auth/forgot/verify', { body: { email: 'mona@example.com', code: code === '000000' ? '111111' : '000000' } });
  assert.equal(wrong.status, 400);

  const ok = await api('POST', '/api/auth/forgot/verify', { body: { email: 'mona@example.com', code } });
  assert.equal(ok.status, 200, JSON.stringify(ok.body));
  assert.match(ok.body.resetToken, /^[0-9a-f]{48}$/);
  // The code is spent.
  assert.equal((await api('POST', '/api/auth/forgot/verify', { body: { email: 'mona@example.com', code } })).status, 400);

  const link = await api('GET', `/api/auth/invite/${ok.body.resetToken}`);
  assert.equal(link.body.kind, 'reset');
  const reset = await api('POST', '/api/auth/accept-invite', { body: { inviteToken: ok.body.resetToken, password: 'NewPass456' } });
  assert.equal(reset.status, 200);
  assert.ok(reset.body.token);

  assert.equal((await api('POST', '/api/auth/login', { body: { email: 'mona@example.com', password: 'OldPass123' } })).status, 401);
  assert.equal((await api('POST', '/api/auth/login', { body: { email: 'mona@example.com', password: 'NewPass456' } })).status, 200);
  assert.equal((await api('GET', '/api/auth/me', { token: owner.token })).status, 401, 'the old session is signed out');
});

test('a code by text message goes to the number in the profile, saved with or without its country code', async () => {
  const owner = await signup('sms-owner@example.com');
  // Saved before country codes: takes the business's country (Egypt).
  await pool.query("UPDATE users SET phone = '0100 123 4567' WHERE id = $1", [owner.userId]);

  const asked = await api('POST', '/api/auth/forgot', { body: { phone: '+20 1001234567' } });
  assert.equal(asked.status, 200);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].channel, 'sms');
  assert.equal(sent[0].to, '+201001234567');
  assert.match(sent[0].text, /^SOPY: /);

  const ok = await api('POST', '/api/auth/forgot/verify', { body: { phone: '+20 1001234567', code: codeIn(sent[0]) } });
  assert.equal(ok.status, 200, JSON.stringify(ok.body));

  // And a number saved the new way.
  await pool.query("UPDATE users SET phone = '+44 7700900123' WHERE id = $1", [owner.userId]);
  resetForgotLimits();
  await api('POST', '/api/auth/forgot', { body: { phone: '+44 07700 900123' } });
  assert.equal(sent.length, 2);
  assert.equal(sent[1].to, '+447700900123');
});

test('the reply is the same when no account matches, and nothing is sent', async () => {
  const owner = await signup('quiet@example.com');
  const nobody = await api('POST', '/api/auth/forgot', { body: { email: 'nobody@example.com' } });
  assert.equal(nobody.status, 200);
  assert.deepEqual(nobody.body, { sent: true });

  // Disabled people, and invites never accepted, get nothing either.
  await pool.query("UPDATE users SET status = 'disabled' WHERE id = $1", [owner.userId]);
  assert.equal((await api('POST', '/api/auth/forgot', { body: { email: 'quiet@example.com' } })).status, 200);
  await pool.query("UPDATE users SET status = 'invited' WHERE id = $1", [owner.userId]);
  resetForgotLimits();
  assert.equal((await api('POST', '/api/auth/forgot', { body: { email: 'quiet@example.com' } })).status, 200);

  // A number on two accounts can't say which to reset.
  const a = await signup('shared-a@example.com');
  const b = await signup('shared-b@example.com');
  await pool.query("UPDATE users SET phone = '+20 1112223334' WHERE id = ANY($1::uuid[])", [[a.userId, b.userId]]);
  assert.equal((await api('POST', '/api/auth/forgot', { body: { phone: '+20 1112223334' } })).status, 200);
  assert.equal(sent.length, 0);

  // Verifying for nobody is just a wrong code.
  assert.equal((await api('POST', '/api/auth/forgot/verify', { body: { email: 'nobody@example.com', code: '123456' } })).status, 400);
});

test('codes are limited: one a minute, five wrong tries, ten minutes', async () => {
  await signup('limits@example.com');
  const body = { email: 'limits@example.com' };
  assert.equal((await api('POST', '/api/auth/forgot', { body })).status, 200);
  const again = await api('POST', '/api/auth/forgot', { body });
  assert.equal(again.status, 429);
  assert.equal(again.body.error, 'Wait a minute before asking for another code.');
  // Unknown addresses are limited the same way.
  assert.equal((await api('POST', '/api/auth/forgot', { body: { email: 'ghost@example.com' } })).status, 200);
  assert.equal((await api('POST', '/api/auth/forgot', { body: { email: 'ghost@example.com' } })).status, 429);

  const code = codeIn(sent[0]);
  const wrongCode = code === '999999' ? '888888' : '999999';
  for (let i = 0; i < 5; i++) {
    assert.equal((await api('POST', '/api/auth/forgot/verify', { body: { ...body, code: wrongCode } })).status, 400);
  }
  const tooLate = await api('POST', '/api/auth/forgot/verify', { body: { ...body, code } });
  assert.equal(tooLate.status, 400, 'five wrong tries spend the code');

  resetForgotLimits();
  await api('POST', '/api/auth/forgot', { body });
  const fresh = codeIn(sent[1]);
  await pool.query("UPDATE password_reset_codes SET expires_at = now() - interval '1 second' WHERE used_at IS NULL");
  assert.equal((await api('POST', '/api/auth/forgot/verify', { body: { ...body, code: fresh } })).status, 400, 'an expired code is refused');
});

test('an earlier code still works when a second one was asked for', async () => {
  await signup('twice@example.com');
  const body = { email: 'twice@example.com' };
  await api('POST', '/api/auth/forgot', { body });
  resetForgotLimits();
  await api('POST', '/api/auth/forgot', { body });
  assert.equal(sent.length, 2);
  const ok = await api('POST', '/api/auth/forgot/verify', { body: { ...body, code: codeIn(sent[0]) } });
  assert.equal(ok.status, 200);
  // Both are spent once one has worked.
  assert.equal((await api('POST', '/api/auth/forgot/verify', { body: { ...body, code: codeIn(sent[1]) } })).status, 400);
});

test('wrong shapes are refused, and a failed send says so', async () => {
  assert.equal((await api('POST', '/api/auth/forgot', { body: {} })).body.error, 'Enter your email or mobile number');
  assert.equal((await api('POST', '/api/auth/forgot', { body: { email: 5 } })).status, 400);
  assert.equal((await api('POST', '/api/auth/forgot', { body: { email: 'not-an-email' } })).body.error, 'Enter a valid email address');
  assert.equal((await api('POST', '/api/auth/forgot', { body: { phone: '12' } })).body.error, 'Enter your mobile number with its country code');
  assert.equal((await api('POST', '/api/auth/forgot', { body: { phone: ['+20 100'] } })).status, 400);
  assert.equal((await api('POST', '/api/auth/forgot/verify', { body: { email: 'a@example.com', code: 'abc' } })).body.error, 'Enter the 6-digit code');
  assert.equal((await api('POST', '/api/auth/forgot/verify', { body: { email: 'a@example.com', code: 123456 } })).status, 400);

  await signup('outage@example.com');
  setMessageSender(() => { throw new Error('SMTP down'); });
  const failed = await api('POST', '/api/auth/forgot', { body: { email: 'outage@example.com' } });
  assert.equal(failed.status, 502);
  assert.equal(failed.body.error, "We couldn't send the code. Try again in a few minutes.");
});

test('in production, a way of sending that is not set up is not offered', async () => {
  setMessageSender(null);
  const saved = { NODE_ENV: process.env.NODE_ENV, SMTP_HOST: process.env.SMTP_HOST, TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID };
  process.env.NODE_ENV = 'production';
  delete process.env.SMTP_HOST;
  delete process.env.TWILIO_ACCOUNT_SID;
  try {
    assert.deepEqual((await api('GET', '/api/auth/forgot/options')).body, { email: false, sms: false });
    const off = await api('POST', '/api/auth/forgot', { body: { email: 'anyone@example.com' }, headers: { 'Accept-Language': 'fr' } });
    assert.equal(off.status, 503);
    assert.match(off.body.error, /indisponible/); // in French, and no longer sends anyone to a manager
    assert.doesNotMatch(off.body.error, /manager/i);
  } finally {
    for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
  }
});

test('with Twilio set up, the text goes to Twilio’s API in its format', async () => {
  const owner = await signup('twilio@example.com');
  await pool.query("UPDATE users SET phone = '+20 1234567890' WHERE id = $1", [owner.userId]);
  setMessageSender(null);
  const realFetch = globalThis.fetch;
  const saved = { TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN, TWILIO_FROM: process.env.TWILIO_FROM };
  Object.assign(process.env, { TWILIO_ACCOUNT_SID: 'AC123', TWILIO_AUTH_TOKEN: 'secret', TWILIO_FROM: 'SOPY' });
  const calls = [];
  globalThis.fetch = async (url, init) => {
    if (String(url).startsWith('https://api.twilio.com/')) {
      calls.push({ url: String(url), init });
      return new Response(JSON.stringify({ sid: 'SM1' }), { status: 201, headers: { 'Content-Type': 'application/json' } });
    }
    return realFetch(url, init);
  };
  try {
    const res = await api('POST', '/api/auth/forgot', { body: { phone: '+20 01234567890' } });
    assert.equal(res.status, 200);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, 'https://api.twilio.com/2010-04-01/Accounts/AC123/Messages.json');
    assert.equal(calls[0].init.headers.Authorization, `Basic ${Buffer.from('AC123:secret').toString('base64')}`);
    const form = new URLSearchParams(String(calls[0].init.body));
    assert.equal(form.get('To'), '+201234567890');
    assert.equal(form.get('From'), 'SOPY');
    assert.match(form.get('Body'), /\d{6}/);

    // Twilio refusing (say, an unverified number) is reported, not hidden.
    resetForgotLimits();
    globalThis.fetch = async (url, init) => (String(url).startsWith('https://api.twilio.com/')
      ? new Response(JSON.stringify({ message: 'The number is unverified' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
      : realFetch(url, init));
    assert.equal((await api('POST', '/api/auth/forgot', { body: { phone: '+20 1234567890' } })).status, 502);
  } finally {
    globalThis.fetch = realFetch;
    for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
  }
});
