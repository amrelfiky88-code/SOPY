import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { resetTestDb, closeDb } from '../test-utils/db.js';
import { startTestServer, makeClient, completeSetup } from '../test-utils/server.js';

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
  await completeSetup(api, token);
});

after(async () => {
  await close();
  await closeDb();
});

test('opening/closing SOP has 8 opening + 7 closing items with the expected critical count', async () => {
  const res = await api('GET', '/api/checklists/library?standard=SOP', { token });
  assert.equal(res.status, 200);
  const opening = res.body.items.filter((i) => i.category.startsWith('SOP 1: Opening'));
  const closing = res.body.items.filter((i) => i.category.startsWith('SOP 2: Closing'));
  assert.equal(opening.length, 8);
  assert.equal(closing.length, 7);
  const criticalCount = (items) => items.filter((i) => i.is_critical).length;
  assert.equal(criticalCount(opening), 2);
  assert.equal(criticalCount(closing), 3);
});

test('opening procedure items come back in source-document order and carry their guidance in description', async () => {
  const res = await api('GET', '/api/checklists/library?standard=SOP', { token });
  const opening = res.body.items.filter((i) => i.category.startsWith('SOP 1: Opening'));
  assert.deepEqual(opening.map((i) => i.text), [
    'Arrival and security check completed',
    'Kitchen equipment startup completed',
    'Food safety checks completed',
    'Station prep and mise en place completed',
    'Dining room setup completed',
    'Pre-service meeting held',
    'Final opening checklist verified',
    'Open for service',
  ]);
  assert.ok(opening[0].description.includes('photograph'));
});
