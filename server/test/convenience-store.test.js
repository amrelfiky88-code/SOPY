import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { resetTestDb, closeDb } from '../test-utils/db.js';
import { startTestServer, makeClient } from '../test-utils/server.js';

let close, api, token;

before(async () => {
  await resetTestDb();
  const server = await startTestServer();
  close = server.close;
  api = makeClient(server.baseUrl);

  const signup = await api('POST', '/api/auth/signup', {
    body: { fullName: 'Amina', email: 'amina@example.com', password: 'SopyDemo123', restaurantName: 'The Nile Bistro', country: 'Egypt', branchCount: 1, userCount: 1 },
  });
  token = signup.body.token;
  await api('POST', '/api/billing/checkout', { token, body: {} });
  await api('POST', '/api/billing/mock-complete', { token, body: {} });
  await api('PATCH', '/api/tenants/current', { token, body: { onboardingStep: 'complete' } });
});

after(async () => {
  await close();
  await closeDb();
});

test('the convenience store section seeds with the expected shape', async () => {
  const res = await api('GET', '/api/checklists/library?standard=C_STORE', { token });
  assert.equal(res.status, 200, JSON.stringify(res.body));

  const items = res.body.items;
  assert.equal(items.length, 114);

  const categories = [...new Set(items.map((i) => i.category))];
  assert.equal(categories.length, 15, 'expected 15 C-Store sections');
  assert.ok(categories.every((c) => c.startsWith('C-Store — ')), 'every section is prefixed consistently');

  // Forecourt and age-restricted sales are where a convenience store
  // carries real legal and safety exposure, so those must be critical.
  const critical = (text) => items.find((i) => i.text === text)?.is_critical;
  assert.equal(critical('Emergency fuel shutoff accessible and unobstructed'), true);
  assert.equal(critical('No fuel spills or hazardous conditions on the pump island'), true);
  assert.equal(critical('Every age-restricted sale this shift was ID-checked and logged'), true);
  assert.equal(critical('Hot holding at or above 135F (57C)'), true);

  // Presentation items are not incidents.
  assert.equal(critical('Music / PA system on'), false);
});

// The section is researched from public industry sources rather than
// transcribed from the client's documents, so it must stay filterable as
// its own standard rather than being mixed into SOP.
test('convenience store items are their own standard, separate from SOP', async () => {
  const cStore = await api('GET', '/api/checklists/library?standard=C_STORE', { token });
  assert.ok(cStore.body.items.every((i) => i.standard === 'C_STORE'));

  const sop = await api('GET', '/api/checklists/library?standard=SOP', { token });
  assert.ok(sop.body.items.every((i) => i.standard === 'SOP'));
  assert.ok(sop.body.items.length > 0, 'SOP content is untouched by the new section');
});

test('convenience store content is served translated, falling back to English', async () => {
  const ar = await api('GET', '/api/checklists/library?standard=C_STORE&lang=ar', { token });
  assert.equal(ar.status, 200);

  const arItem = ar.body.items.find((i) => i.sort_order === 4 && i.category.includes('C. '));
  assert.ok(arItem, 'expected the emergency fuel shutoff checkpoint');
  assert.match(arItem.text, /[؀-ۿ]/, 'Arabic text should be returned, not English');
  assert.match(arItem.category, /[؀-ۿ]/, 'category heading should be Arabic too');

  const fr = await api('GET', '/api/checklists/library?standard=C_STORE&lang=fr', { token });
  assert.ok(fr.body.items.some((i) => i.text.includes('carburant')), 'French content should be returned');

  // An unknown language has no rows in content_translations, so every
  // field must fall through as English rather than rendering blank.
  const xx = await api('GET', '/api/checklists/library?standard=C_STORE&lang=xx', { token });
  assert.equal(xx.body.items[0].text, (await api('GET', '/api/checklists/library?standard=C_STORE&lang=en', { token })).body.items[0].text);
});
