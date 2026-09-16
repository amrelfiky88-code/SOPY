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

test('SOP 6-9 front-of-house items have the expected counts, and only the two documented critical triggers are flagged', async () => {
  const res = await api('GET', '/api/checklists/library?standard=SOP', { token });
  assert.equal(res.status, 200);

  const byPhase = (prefix) => res.body.items.filter((i) => i.category.startsWith(prefix));

  const greeting = byPhase('SOP 6: Greeting & Seating');
  const ordering = byPhase('SOP 7: Order Taking & POS');
  const running = byPhase('SOP 8: Food Running & Service');
  const complaints = byPhase('SOP 9: Complaint Handling');

  assert.equal(greeting.length, 7);
  assert.equal(ordering.length, 7);
  assert.equal(running.length, 6);
  assert.equal(complaints.length, 8);

  // Almost all of this is hospitality/service-quality guidance, not a
  // compliance checkpoint — only the source document's own explicit
  // safety triggers should be critical.
  const critical = res.body.items.filter((i) =>
    (i.category.startsWith('SOP 6') || i.category.startsWith('SOP 7') || i.category.startsWith('SOP 8') || i.category.startsWith('SOP 9'))
    && i.is_critical
  );
  assert.equal(critical.length, 2);
  assert.deepEqual(critical.map((i) => i.text).sort(), [
    'Allergy alert handled correctly',
    'Manager involved when required',
  ]);
});

test('allergy alert item carries the full escalation guidance and is flagged critical', async () => {
  const res = await api('GET', `/api/checklists/library?q=${encodeURIComponent('Allergy alert handled correctly')}`, { token });
  const item = res.body.items.find((i) => i.text === 'Allergy alert handled correctly');
  assert.ok(item);
  assert.equal(item.is_critical, true);
  assert.ok(item.description.includes('notify the kitchen manager immediately'));
});
