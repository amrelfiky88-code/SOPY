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
  await api('POST', '/api/onboarding/complete', { token, body: {} });
});

after(async () => {
  await close();
  await closeDb();
});

test('SOP 10 cash handling has 7 items, with only the starting-drawer setup step non-critical', async () => {
  const res = await api('GET', '/api/checklists/library?standard=SOP', { token });
  const cashItems = res.body.items.filter((i) => i.category.startsWith('SOP 10: Cash Handling'));
  assert.equal(cashItems.length, 7);

  const nonCritical = cashItems.filter((i) => !i.is_critical);
  assert.equal(nonCritical.length, 1);
  assert.equal(nonCritical[0].text, 'Starting cash drawer counted and verified');

  // Everything else in this domain is a live fraud-prevention or
  // fraud-detection point (change counting, card handling, counterfeit
  // checks, till drops, end-of-shift reconciliation, standing security
  // rules) — matches the source document's own framing.
  assert.equal(cashItems.filter((i) => i.is_critical).length, 6);
});

test('cash drawer reconciliation item captures the variance-investigation rule', async () => {
  const res = await api('GET', `/api/checklists/library?q=${encodeURIComponent('Cash drawer closed and reconciled')}`, { token });
  const item = res.body.items.find((i) => i.text === 'Cash drawer closed and reconciled');
  assert.ok(item);
  assert.equal(item.is_critical, true);
  assert.ok(item.description.includes('recounted and investigated'));
});
