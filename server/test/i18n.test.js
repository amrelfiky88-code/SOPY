import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { resetTestDb, closeDb } from '../test-utils/db.js';
import { startTestServer, makeClient, completeSetup } from '../test-utils/server.js';
import { pool } from '../src/db.js';
import ar from '../db/translations/ar.js';
import fr from '../db/translations/fr.js';

// Everything a person reads comes in their language: the checkpoint
// library, the API's error messages, and the language they picked before
// they had an account.

let close, api, baseUrl;

before(async () => {
  await resetTestDb();
  const server = await startTestServer();
  close = server.close;
  baseUrl = server.baseUrl;
  api = makeClient(baseUrl);
});

after(async () => {
  await close();
  await closeDb();
});

test('every library checkpoint, description and category has Arabic and French', async () => {
  const { rows } = await pool.query('SELECT text, description, category FROM checklist_items WHERE tenant_id IS NULL');
  for (const [lang, dict] of Object.entries({ ar, fr })) {
    const missing = new Set();
    for (const r of rows) {
      for (const v of [r.text, r.description, r.category]) if (v && !dict[v]) missing.add(v);
    }
    assert.deepEqual([...missing].slice(0, 5), [], `${lang}: ${missing.size} library strings would show in English`);
  }
});

const post = (path, body, lang) => fetch(`${baseUrl}${path}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', ...(lang ? { 'Accept-Language': lang } : {}) },
  body: JSON.stringify(body),
}).then(async (r) => ({ status: r.status, body: await r.json() }));

test('error messages come back in the language the app sends', async () => {
  const wrong = { email: 'nobody@example.com', password: 'wrong-password' };
  assert.equal((await post('/api/auth/login', wrong)).body.error, 'Invalid email or password');
  assert.equal((await post('/api/auth/login', wrong, 'ar')).body.error, 'البريد الإلكتروني أو كلمة المرور غير صحيحة');
  assert.equal((await post('/api/auth/login', wrong, 'fr-FR,fr;q=0.9')).body.error, 'E-mail ou mot de passe incorrect');
  // Unsupported languages fall back to English rather than failing.
  assert.equal((await post('/api/auth/login', wrong, 'de')).body.error, 'Invalid email or password');
});

test('messages with numbers in them are translated whole', async () => {
  const signup = await api('POST', '/api/auth/signup', {
    body: { fullName: 'O', email: 'full@example.com', password: 'OwnerPass123', restaurantName: 'Full', country: 'Egypt', branchCount: 1, userCount: 1 },
  });
  await completeSetup(api, signup.body.token);
  const res = await fetch(`${baseUrl}/api/tenants/users/invite`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${signup.body.token}`, 'Accept-Language': 'ar' },
    body: JSON.stringify({ fullName: 'S', email: 'staff-full@example.com', role: 'employee' }),
  });
  assert.equal(res.status, 409);
  assert.equal((await res.json()).error, 'تغطي خطتك 1 مستخدم فقط. غيّر خطتك من الملف الشخصي والفواتير لإضافة المزيد.');
});

test('the language picked before signing up becomes the account setting', async () => {
  const res = await api('POST', '/api/auth/signup', {
    body: { fullName: 'A', email: 'arabic@example.com', password: 'OwnerPass123', restaurantName: 'A', country: 'Egypt', language: 'ar' },
  });
  assert.equal(res.status, 201);
  assert.equal(res.body.user.language, 'ar');
  const junk = await api('POST', '/api/auth/signup', {
    body: { fullName: 'B', email: 'junk-lang@example.com', password: 'OwnerPass123', restaurantName: 'B', country: 'Egypt', language: 'xx' },
  });
  assert.equal(junk.body.user.language, 'en', 'an unknown language never blocks signup');
});

test('an invited person keeps the language they accepted the invite in; a reset keeps theirs', async () => {
  const owner = await api('POST', '/api/auth/signup', {
    body: { fullName: 'O', email: 'inv-owner@example.com', password: 'OwnerPass123', restaurantName: 'Inv', country: 'Egypt', userCount: 3 },
  });
  await completeSetup(api, owner.body.token);
  const invite = await api('POST', '/api/tenants/users/invite', {
    token: owner.body.token, body: { fullName: 'S', email: 'inv-staff@example.com', role: 'employee' },
  });
  const inviteToken = invite.body.inviteLink.split('token=')[1];
  const accepted = await api('POST', '/api/auth/accept-invite', { body: { inviteToken, password: 'StaffPass123', language: 'fr' } });
  assert.equal(accepted.status, 200);
  assert.equal(accepted.body.user.language, 'fr');

  const reset = await api('POST', `/api/tenants/users/${accepted.body.user.id}/reset-link`, { token: owner.body.token, body: {} });
  const resetToken = reset.body.resetLink.split('token=')[1];
  const again = await api('POST', '/api/auth/accept-invite', { body: { inviteToken: resetToken, password: 'StaffPass456', language: 'ar' } });
  assert.equal(again.body.user.language, 'fr', 'a password reset page does not change their saved language');
});

test('translated checkpoints keep their English category, so the app treats them the same in every language', async () => {
  const owner = await api('POST', '/api/auth/signup', {
    body: { fullName: 'O', email: 'cat-owner@example.com', password: 'OwnerPass123', restaurantName: 'Cat', country: 'Egypt' },
  });
  await completeSetup(api, owner.body.token);
  const { body } = await api('GET', '/api/checklists/library?lang=ar&standard=INTERNAL_QC', { token: owner.body.token });
  const observation = body.items.find((i) => i.category_en === 'Daily QC — H. Consumer Behavior & Insights');
  assert.ok(observation, 'observation items are still recognisable');
  assert.equal(observation.category, 'الجودة اليومية — H. سلوك المستهلك والرؤى');
  assert.ok(!/^[A-Za-z]/.test(observation.text), 'and the text itself is Arabic');
});
