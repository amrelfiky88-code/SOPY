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

// SOP 12-20 were researched (not transcribed from a client document, per
// SOP 1-11) at the client's explicit direction. This locks in the counts
// so a future edit doesn't silently drop or duplicate a phase.
test('SOP 12-20 (researched content) have the expected item and critical counts per procedure', async () => {
  const res = await api('GET', '/api/checklists/library?standard=SOP', { token });
  const byPrefix = (prefix) => res.body.items.filter((i) => i.category.startsWith(prefix));
  const criticalCount = (items) => items.filter((i) => i.is_critical).length;

  const expected = {
    'SOP 12: Recipe Standardization': [5, 0],
    'SOP 13: Cleaning & Sanitizing': [6, 1],
    'SOP 14: Inventory & Ordering': [6, 1],
    'SOP 15: Waste & Cost Control': [5, 0],
    'SOP 16: Alcohol Service': [6, 6],
    'SOP 17: Allergen Awareness': [5, 4],
    'SOP 18: Emergency Procedures': [6, 6],
    'SOP 19: Onboarding & Training': [6, 1],
    'SOP 20: Manager Shift Duties': [5, 1],
  };

  for (const [prefix, [count, critical]] of Object.entries(expected)) {
    const items = byPrefix(prefix);
    assert.equal(items.length, count, `${prefix} item count`);
    assert.equal(criticalCount(items), critical, `${prefix} critical count`);
  }
});

test('alcohol service and emergency procedures are almost entirely critical, matching their real-world stakes', async () => {
  const res = await api('GET', '/api/checklists/library?standard=SOP', { token });
  const alcohol = res.body.items.filter((i) => i.category.startsWith('SOP 16: Alcohol Service'));
  const emergency = res.body.items.filter((i) => i.category.startsWith('SOP 18: Emergency Procedures'));

  assert.ok(alcohol.every((i) => i.is_critical), 'expected every alcohol-service item to be critical');
  assert.ok(emergency.every((i) => i.is_critical), 'expected every emergency-procedure item to be critical');
});
