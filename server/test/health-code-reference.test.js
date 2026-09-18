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

test('the 4 gap-filling health code checkpoints exist and are all critical', async () => {
  const res = await api('GET', '/api/checklists/library?standard=SOP', { token });
  const items = res.body.items.filter((i) => i.category === 'Health Code Compliance — Critical Violation Checkpoints');
  assert.equal(items.length, 4);
  assert.ok(items.every((i) => i.is_critical), 'expected every health-code reference item to be critical');
  assert.deepEqual(items.map((i) => i.text).sort(), [
    'Certified food manager on-site during all operating hours',
    'Food received only from approved, licensed suppliers',
    'No bare hand contact with ready-to-eat food',
    'Water supply and sewage systems functioning normally',
  ]);
});
