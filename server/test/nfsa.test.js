import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { resetTestDb, closeDb } from '../test-utils/db.js';
import { startTestServer, makeClient, completeSetup } from '../test-utils/server.js';
import { pool } from '../src/db.js';
import { upgradeContent } from '../src/db/upgrade.js';

// The NFSA site visit: the Egyptian National Food Safety Authority's
// inspection checkpoints in the library (seed_nfsa.sql), run as a
// self-inspection from the NFSA page through Library "Run now".

const GROUP = 'NFSA Site Visit';
let close, api, baseUrl;
const owner = {};
let branchId, otherBranchId, storeMgr, otherMgr, emp;

async function inviteAndAccept(email, role, extra = {}) {
  const invite = await api('POST', '/api/tenants/users/invite', { token: owner.token, body: { fullName: email.split('@')[0], email, role, ...extra } });
  assert.equal(invite.status, 201, JSON.stringify(invite.body));
  const accept = await api('POST', '/api/auth/accept-invite', { body: { inviteToken: invite.body.inviteLink.split('token=')[1], password: 'Password123' } });
  return { token: accept.body.token, userId: accept.body.user.id };
}

before(async () => {
  await resetTestDb();
  const server = await startTestServer();
  close = server.close;
  baseUrl = server.baseUrl;
  api = makeClient(server.baseUrl);
  const signup = await api('POST', '/api/auth/signup', {
    body: { fullName: 'Nadia Owner', email: 'nfsa-owner@example.com', password: 'OwnerPass123', restaurantName: 'Nile Grill', country: 'Egypt', branchCount: 2, userCount: 6 },
  });
  owner.token = signup.body.token;
  await completeSetup(api, owner.token);
  branchId = (await api('POST', '/api/tenants/branches', { token: owner.token, body: { name: 'Zamalek' } })).body.branch.id;
  otherBranchId = (await api('POST', '/api/tenants/branches', { token: owner.token, body: { name: 'Maadi' } })).body.branch.id;
  storeMgr = await inviteAndAccept('nfsa-mgr@example.com', 'store_manager', { branchIds: [branchId] });
  otherMgr = await inviteAndAccept('nfsa-mgr2@example.com', 'store_manager', { branchIds: [otherBranchId] });
  emp = await inviteAndAccept('nfsa-staff@example.com', 'employee', { branchIds: [branchId] });
});

after(async () => {
  await close();
  await closeDb();
});

test('the library has the NFSA site visit: 53 checkpoints in 12 sections, the food-safety risks critical, every one needing a photo', async () => {
  const res = await api('GET', '/api/checklists/library?standard=NFSA', { token: owner.token });
  assert.equal(res.status, 200);
  const items = res.body.items;
  assert.equal(items.length, 53);
  assert.ok(items.every((i) => i.category.startsWith(`${GROUP} — `) && i.requires_photo));
  assert.equal(new Set(items.map((i) => i.category)).size, 12);
  assert.equal(items.filter((i) => i.is_critical).length, 15);
  // Sections in letter order, checkpoints in the form's order within them.
  const sections = [...new Set(items.map((i) => i.category.split(' — ')[1][0]))];
  assert.deepEqual(sections, 'ABCDEFGHIJKL'.split(''));
  const critical = items.filter((i) => i.is_critical).map((i) => i.text).join(' | ');
  for (const word of ['75 °C', '60 °C', '-18 °C', 'white list', 'health certificate', 'expired', 'insects', 'rodents']) {
    assert.ok(critical.includes(word), `a critical checkpoint covers "${word}"`);
  }
});

test('every NFSA checkpoint and section reads in Arabic and French, keeping its English for the app', async () => {
  for (const lang of ['ar', 'fr']) {
    const res = await api('GET', `/api/checklists/library?standard=NFSA&lang=${lang}`, { token: owner.token });
    for (const item of res.body.items) {
      assert.notEqual(item.text, item.text_en, `${lang}: ${item.text_en}`);
      assert.notEqual(item.category, item.category_en, `${lang}: ${item.category_en}`);
      assert.ok(item.category_en.startsWith(GROUP));
    }
  }
  const ar = await api('GET', '/api/checklists/library?standard=NFSA&lang=ar', { token: owner.token });
  assert.match(ar.body.items.find((i) => i.text_en.includes('60 °C')).text, /٦٠ °م/, 'Arabic-Indic digits');
  const names = await api('GET', '/api/checklists/library/groups?lang=ar', { token: owner.token });
  assert.equal(names.body.names[GROUP], 'زيارة هيئة سلامة الغذاء');
});

test('a store manager runs the NFSA self-inspection at their store; it lists on the NFSA page and nowhere it should not', async () => {
  const run = await api('POST', '/api/checklists/library/run', { token: storeMgr.token, body: { group: GROUP, branchId } });
  assert.equal(run.status, 201, JSON.stringify(run.body));
  const { rows: [template] } = await pool.query('SELECT name, frequency, library_group, (SELECT count(*)::int FROM checklist_template_items WHERE template_id = t.id) AS n FROM checklist_templates t WHERE id = $1', [run.body.submission.template_id]);
  assert.deepEqual(template, { name: GROUP, frequency: 'monthly', library_group: GROUP, n: 53 });

  assert.equal((await api('POST', '/api/checklists/library/run', { token: storeMgr.token, body: { group: GROUP, branchId: otherBranchId } })).status, 404, 'not at another store');

  // A library run of something else shouldn't appear on the NFSA page.
  await api('POST', '/api/checklists/library/run', { token: storeMgr.token, body: { group: 'SOP 1: Opening', branchId } });
  const q = new URLSearchParams({ libraryGroup: GROUP });
  const mine = await api('GET', `/api/submissions?${q}`, { token: storeMgr.token });
  assert.equal(mine.status, 200);
  assert.deepEqual(mine.body.submissions.map((s) => s.id), [run.body.submission.id]);
  assert.equal((await api('GET', `/api/submissions?${q}`, { token: owner.token })).body.submissions.length, 1, 'the owner sees it');
  assert.equal((await api('GET', `/api/submissions?${q}`, { token: otherMgr.token })).body.submissions.length, 0, "another store's manager doesn't");
  assert.equal((await api('GET', `/api/submissions?${q}`, { token: emp.token })).body.submissions.length, 0, "staff see only their own");
  assert.equal((await api('GET', '/api/submissions?libraryGroup[]=x', { token: owner.token })).status, 400);
});

test('the NFSA seed is safe to run again, so a live database gets it at start-up without duplicates', async () => {
  await pool.query(fs.readFileSync(new URL('../db/seed_nfsa.sql', import.meta.url), 'utf8'));
  await upgradeContent();
  const { rows } = await pool.query("SELECT count(*)::int AS n FROM checklist_items WHERE tenant_id IS NULL AND standard = 'NFSA'");
  assert.equal(rows[0].n, 53);

  // A database from before the NFSA section gets it, translations included.
  await pool.query("DELETE FROM checklist_items WHERE standard = 'NFSA'");
  await pool.query("DELETE FROM content_translations WHERE source_text LIKE 'NFSA Site Visit%'");
  await upgradeContent();
  const after = await pool.query("SELECT count(*)::int AS n FROM checklist_items WHERE tenant_id IS NULL AND standard = 'NFSA'");
  assert.equal(after.rows[0].n, 53);
  const names = await api('GET', '/api/checklists/library/groups?lang=fr', { token: owner.token });
  assert.equal(names.body.names[GROUP], 'Visite NFSA');
});
