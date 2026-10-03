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

test('library search finds Arabic and French however they are typed', async () => {
  const owner = await api('POST', '/api/auth/signup', {
    body: { fullName: 'O', email: 'search-owner@example.com', password: 'OwnerPass123', restaurantName: 'Search', country: 'Egypt' },
  });
  await completeSetup(api, owner.body.token);
  const search = async (q) => (await api('GET', `/api/checklists/library?lang=ar&q=${encodeURIComponent(q)}`, { token: owner.body.token })).body.items;

  // A stored Arabic text with vowel marks, ة and Arabic-Indic digits, and
  // the same words typed plainly.
  const { rows } = await pool.query(
    `SELECT ct.source_text, ct.translated FROM content_translations ct
     JOIN checklist_items ci ON ci.text = ct.source_text AND ci.tenant_id IS NULL
     WHERE ct.lang = 'ar' AND ct.translated ~ '[ً-ْ]' ORDER BY length(ct.translated) LIMIT 1`
  );
  const marked = rows[0].translated;
  const plain = marked.normalize('NFD').replace(/[ً-ٰٟـ]/g, '').replace(/ة/g, 'ه');
  assert.notEqual(plain, marked);
  assert.ok((await search(plain)).some((i) => i.text_en === rows[0].source_text || i.text === marked), `"${plain}" finds "${marked}"`);
  assert.ok((await search(marked)).length > 0, 'typing the marks still works');

  // French without accents.
  const fr = await pool.query("SELECT translated FROM content_translations WHERE lang = 'fr' AND translated ILIKE '%sécurité%' LIMIT 1");
  assert.ok(fr.rows[0]);
  assert.ok((await api('GET', '/api/checklists/library?lang=fr&q=securite', { token: owner.body.token })).body.items.length > 0);

  // Search characters are literal, and a list instead of text is ignored.
  assert.equal((await search('%')).length < (await search('')).length, true);
  assert.equal((await api('GET', '/api/checklists/library?q[]=x', { token: owner.body.token })).status, 200);
});
