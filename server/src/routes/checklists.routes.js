import { Router } from 'express';
import { query, withTransaction } from '../db.js';
import { requireAuth, requireRole } from '../auth/middleware.js';
import { translateRows, requestLanguage } from '../i18n/translateContent.js';
import { isValidRole } from '../auth/roles.js';

import { MY_ASSIGNMENTS_FROM, myAssignmentParams } from '../assignments.js';

const TRANSLATABLE_ITEM_FIELDS = ['text', 'description', 'category'];

export const checklistsRouter = Router();

async function requireOnboardingComplete(req, res, next) {
  const { rows } = await query('SELECT onboarding_step FROM tenants WHERE id = $1', [req.auth.tenantId]);
  if (rows[0]?.onboarding_step !== 'complete') {
    return res.status(403).json({ error: 'Finish onboarding before building checklists' });
  }
  next();
}

// --- Master checkpoint library: search + filter by standard/category ---
checklistsRouter.get('/library', requireAuth, requireOnboardingComplete, async (req, res) => {
  const { q, standard, category, critical } = req.query;
  const clauses = ['(tenant_id IS NULL OR tenant_id = $1)'];
  const params = [req.auth.tenantId];
  let i = 2;

  // Search the English text and its translations, so someone using the
  // app in Arabic or French can search in their own language.
  if (q) {
    clauses.push(`(text ILIKE $${i} OR EXISTS (
      SELECT 1 FROM content_translations ct
      WHERE ct.source_text = checklist_items.text AND ct.translated ILIKE $${i}))`);
    i += 1;
    params.push(`%${String(q).replace(/[\\%_]/g, (c) => `\\${c}`)}%`);
  }
  if (standard) { clauses.push(`standard = $${i++}`); params.push(standard); }
  if (category) { clauses.push(`category = $${i++}`); params.push(category); }
  if (critical === 'true') { clauses.push('is_critical = true'); }

  const { rows } = await query(
    // sort_order (not text) as the tiebreaker: seeded items carry an
    // explicit ordinal matching the source document's own sequence — a
    // multi-row INSERT doesn't guarantee row order on its own, and
    // created_at ties within one statement, so this is the real ordering.
    // Standards in the Builder's filter order. Alphabetical put the convenience-store
    // section (C_STORE) at the top of every restaurant's library.
    `SELECT * FROM checklist_items WHERE ${clauses.join(' AND ')}
     ORDER BY array_position($${i}::text[], standard::text), category, sort_order`,
    [...params, STANDARDS]
  );
  // Order by the English category deliberately: it keeps the source
  // document's grouping stable no matter which language is rendered.
  const items = await translateRows(rows, await requestLanguage(req), TRANSLATABLE_ITEM_FIELDS);
  res.json({ items });
});

checklistsRouter.post('/library', requireAuth, requireRole('business_owner', 'operations_manager'), async (req, res) => {
  const { requiresPhoto, isCritical } = req.body;
  const text = trimmed(req.body.text);
  const description = trimmed(req.body.description);
  const category = trimmed(req.body.category);
  const { standard } = req.body;
  if (!text || !standard) return res.status(400).json({ error: 'text and standard are required' });
  if (!STANDARDS.includes(standard)) return res.status(400).json({ error: 'Unknown standard' });
  if (text.length > 500 || description.length > 2000 || category.length > 200) {
    return res.status(400).json({ error: 'That checkpoint text is too long' });
  }
  // Photo evidence is mandatory for every checkpoint — default new
  // custom items to true unless the caller explicitly opts out.
  const { rows } = await query(
    `INSERT INTO checklist_items (tenant_id, text, description, standard, category, requires_photo, is_critical)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [req.auth.tenantId, text, description || null, standard, category || null, requiresPhoto !== false, !!isCritical]

  );
  res.status(201).json({ item: rows[0] });
});

// --- Templates ---
checklistsRouter.get('/templates', requireAuth, async (req, res) => {
  const { rows } = await query(
    'SELECT * FROM checklist_templates WHERE tenant_id = $1 ORDER BY created_at DESC',
    [req.auth.tenantId]
  );
  res.json({ templates: rows });
});

checklistsRouter.get('/templates/:id', requireAuth, async (req, res) => {
  const { rows: templateRows } = await query(
    'SELECT * FROM checklist_templates WHERE id = $1 AND tenant_id = $2',
    [req.params.id, req.auth.tenantId]
  );
  if (!templateRows[0]) return res.status(404).json({ error: 'Not found' });

  const { rows: itemRows } = await query(
    `SELECT ti.id AS template_item_id, ti.section, ti.sort_order, ci.*
     FROM checklist_template_items ti
     JOIN checklist_items ci ON ci.id = ti.item_id
     WHERE ti.template_id = $1
     ORDER BY ti.sort_order`,
    [req.params.id]
  );
  const items = await translateRows(itemRows, await requestLanguage(req), TRANSLATABLE_ITEM_FIELDS);
  res.json({ template: templateRows[0], items });
});

// Custom checklists (built in the Checklist Builder) require manager access.
// The built-in pinned report "kinds" are auto-provisioned the first time
// an appropriately-roled user opens that report, so they're exempt from
// the business_owner/operations_manager-only rule below — but the three
// manager visit-report kinds still need a manager-level role, just not
// specifically business_owner/operations_manager (an area manager, for
// instance, needs to be able to start their own visit report).
const OPEN_TO_ANYONE_REPORT_KINDS = new Set(['kitchen_daily', 'bar_daily', 'opening_daily', 'closing_daily']);
const MANAGER_VISIT_REPORT_ROLES = ['business_owner', 'operations_manager', 'area_manager'];
const MANAGER_VISIT_REPORT_KINDS = new Set(['qc_visit', 'area_manager_visit', 'ops_manager_visit']);
const FREQUENCIES = ['daily', 'weekly', 'monthly', 'quarterly'];
// Same set the builder's filter row offers.
const STANDARDS = ['HACCP', 'ISO_22000', 'LOCAL_CODE', 'INTERNAL_QC', 'SOP', 'C_STORE', 'CUSTOM'];
const trimmed = (v) => (typeof v === 'string' ? v.trim() : '');

function requireManagerUnlessBuiltinDailyReport(req, res, next) {
  const kind = req.body.kind;
  if (OPEN_TO_ANYONE_REPORT_KINDS.has(kind)) return next();
  if (MANAGER_VISIT_REPORT_KINDS.has(kind)) return requireRole(...MANAGER_VISIT_REPORT_ROLES)(req, res, next);
  return requireRole('business_owner', 'operations_manager')(req, res, next);
}

checklistsRouter.post('/templates', requireAuth, requireOnboardingComplete, requireManagerUnlessBuiltinDailyReport, async (req, res) => {
  const { name, description, itemIds } = req.body;
  const kind = req.body.kind || 'custom';
  const frequency = req.body.frequency || 'daily';
  if (typeof name !== 'string' || !name.trim()) return res.status(400).json({ error: 'name is required' });
  if (name.trim().length > 200) return res.status(400).json({ error: 'That checklist name is too long' });
  if (kind !== 'custom' && !OPEN_TO_ANYONE_REPORT_KINDS.has(kind) && !MANAGER_VISIT_REPORT_KINDS.has(kind)) {
    return res.status(400).json({ error: 'Unknown report kind' });
  }
  if (!FREQUENCIES.includes(frequency)) return res.status(400).json({ error: 'Unknown frequency' });

  // Library checkpoints are global (tenant_id NULL) or this tenant's own
  // custom ones — never another tenant's.
  const ids = Array.isArray(itemIds) ? [...new Set(itemIds)] : [];
  // A checklist with no checkpoints would count as "all answered" the
  // moment it opened and submit empty.
  if (kind === 'custom' && !ids.length) return res.status(400).json({ error: 'Pick at least one checkpoint' });
  if (ids.length) {
    const { rows } = await query(
      'SELECT count(*)::int AS n FROM checklist_items WHERE id = ANY($1::uuid[]) AND (tenant_id IS NULL OR tenant_id = $2)',
      [ids, req.auth.tenantId]
    );
    if (rows[0].n !== ids.length) return res.status(400).json({ error: 'Some checkpoints were not found' });
  }

  let reused = false;
  const result = await withTransaction(async (client) => {
    // Each pinned report has one template per business. Two people opening
    // the same report at once (or a double tap) used to create two, which
    // split that report's history across them. Serialise per tenant+kind
    // and hand back the existing one.
    if (kind !== 'custom') {
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`${req.auth.tenantId}:${kind}`]);
      const { rows: existing } = await client.query(
        'SELECT * FROM checklist_templates WHERE tenant_id = $1 AND kind = $2 ORDER BY created_at LIMIT 1',
        [req.auth.tenantId, kind]
      );
      if (existing[0]) { reused = true; return existing[0]; }
    }

    const templateRes = await client.query(
      `INSERT INTO checklist_templates (tenant_id, name, description, kind, frequency, created_by)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [req.auth.tenantId, name.trim(), description || null, kind, frequency, req.auth.userId]
    );
    const template = templateRes.rows[0];

    if (ids.length) {
      const values = ids.map((_, idx) => `($1, $${idx + 2}, ${idx})`).join(', ');
      await client.query(
        `INSERT INTO checklist_template_items (template_id, item_id, sort_order) VALUES ${values}`,
        [template.id, ...ids]
      );
    }
    return template;
  });

  res.status(reused ? 200 : 201).json({ template: result });
});

checklistsRouter.delete('/templates/:id', requireAuth, requireRole('business_owner', 'operations_manager'), async (req, res) => {
  await query('DELETE FROM checklist_templates WHERE id = $1 AND tenant_id = $2', [req.params.id, req.auth.tenantId]);
  res.status(204).end();
});

// --- Assignments: assign a template to stores / users / roles ---
checklistsRouter.get('/assignments', requireAuth, requireRole('business_owner', 'operations_manager', 'area_manager'), async (req, res) => {
  const { rows } = await query(
    `SELECT a.*, t.name AS template_name, t.kind, b.name AS branch_name
     FROM checklist_assignments a
     JOIN checklist_templates t ON t.id = a.template_id
     LEFT JOIN branches b ON b.id = a.branch_id
     WHERE a.tenant_id = $1
     ORDER BY a.created_at DESC`,
    [req.auth.tenantId]
  );
  res.json({ assignments: rows });
});

checklistsRouter.post('/assignments', requireAuth, requireRole('business_owner', 'operations_manager', 'area_manager'), async (req, res) => {
  const { templateId, branchId, userId, role, dueTime } = req.body;
  if (!templateId) return res.status(400).json({ error: 'templateId is required' });
  if (role && !isValidRole(role)) return res.status(400).json({ error: 'Invalid role' });
  const { rows: owned } = await query(
    `SELECT
       EXISTS (SELECT 1 FROM checklist_templates WHERE id = $1 AND tenant_id = $4) AS template_ok,
       EXISTS (SELECT 1 FROM checklist_templates WHERE id = $1 AND tenant_id = $4 AND kind = 'custom') AS assignable,
       ($2::uuid IS NULL OR EXISTS (SELECT 1 FROM branches WHERE id = $2 AND tenant_id = $4 AND is_active)) AS branch_ok,
       ($3::uuid IS NULL OR EXISTS (SELECT 1 FROM users WHERE id = $3 AND tenant_id = $4)) AS user_ok`,
    [templateId, branchId || null, userId || null, req.auth.tenantId]
  );
  if (!owned[0].template_ok || !owned[0].branch_ok || !owned[0].user_ok) {
    return res.status(404).json({ error: 'Checklist, store or user not found' });
  }
  // The daily and visit reports have no checkpoints; assigned as a
  // checklist they opened an empty run nobody could ever submit.
  if (!owned[0].assignable) return res.status(400).json({ error: 'Only checklists built in the Checklist Builder can be assigned' });
  // The same checklist assigned the same way twice showed up twice on
  // everyone's dashboard (a double tap on Assign was enough). Hand back the
  // existing assignment instead.
  // Check-then-insert under a per-checklist lock, so two simultaneous
  // taps can't both pass the check.
  const result = await withTransaction(async (client) => {
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`assign:${req.auth.tenantId}:${templateId}`]);
    const { rows: same } = await client.query(
      `SELECT * FROM checklist_assignments
       WHERE tenant_id = $1 AND template_id = $2 AND active
         AND branch_id IS NOT DISTINCT FROM $3 AND user_id IS NOT DISTINCT FROM $4
         AND role::text IS NOT DISTINCT FROM $5::text`,
      [req.auth.tenantId, templateId, branchId || null, userId || null, role || null]
    );
    if (same[0]) return { assignment: same[0], existing: true };
    const { rows } = await client.query(
      `INSERT INTO checklist_assignments (tenant_id, template_id, branch_id, user_id, role, due_time)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [req.auth.tenantId, templateId, branchId || null, userId || null, role || null, dueTime || null]
    );
    return { assignment: rows[0], existing: false };
  });
  res.status(result.existing ? 200 : 201).json(result);
});

checklistsRouter.delete('/assignments/:id', requireAuth, requireRole('business_owner', 'operations_manager', 'area_manager'), async (req, res) => {
  await query('DELETE FROM checklist_assignments WHERE id = $1 AND tenant_id = $2', [req.params.id, req.auth.tenantId]);
  res.status(204).end();
});

// Checklists assigned to the current user, for "My Checklists Today"
checklistsRouter.get('/my-assignments', requireAuth, async (req, res) => {
  // Each assignment carries this person's latest submitted run and any run
  // still in progress, so the dashboard can say "Done" / "Continue" rather
  // than always "Start" — which gave staff no way to tell what they'd
  // already finished, and opened a fresh run if they tapped it again.
  // "Done" means within the checklist's own frequency window.
  const { rows } = await query(
    `SELECT x.*,
            last.id AS last_submission_id, last.submitted_at AS last_submitted_at,
            open.id AS open_submission_id,
            (last.submitted_at IS NOT NULL AND last.submitted_at >= now() - (CASE x.frequency
               WHEN 'weekly' THEN interval '7 days'
               WHEN 'monthly' THEN interval '30 days'
               WHEN 'quarterly' THEN interval '90 days'
               ELSE interval '16 hours' END)) AS done
     FROM (
       SELECT a.*, t.name AS template_name, t.kind, t.frequency, b.name AS branch_name
       ${MY_ASSIGNMENTS_FROM}
     ) x
     LEFT JOIN LATERAL (
       SELECT id, submitted_at FROM checklist_submissions
       WHERE assignment_id = x.id AND submitted_by = $2 AND status = 'submitted'
       ORDER BY submitted_at DESC LIMIT 1
     ) last ON true
     LEFT JOIN LATERAL (
       SELECT id FROM checklist_submissions
       WHERE assignment_id = x.id AND submitted_by = $2 AND status = 'in_progress'
         AND started_at >= now() - interval '16 hours'
       ORDER BY started_at DESC LIMIT 1
     ) open ON true
     ORDER BY done, x.due_time NULLS LAST`,
    myAssignmentParams(req.auth)
  );
  // The stores this person works at, for "All stores" checklists — which
  // used to run against the business's first store regardless of where
  // the person actually works.
  const { rows: mine } = await query(
    `SELECT b.id FROM user_branches ub JOIN branches b ON b.id = ub.branch_id
     WHERE ub.user_id = $1 AND b.is_active ORDER BY b.created_at`,
    [req.auth.userId]
  );
  res.json({ assignments: rows, myBranchIds: mine.map((r) => r.id) });
});
