import { Router } from 'express';
import { query, withTransaction } from '../db.js';
import { requireAuth, requireRole } from '../auth/middleware.js';

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
  const { q, standard, category } = req.query;
  const clauses = ['(tenant_id IS NULL OR tenant_id = $1)'];
  const params = [req.auth.tenantId];
  let i = 2;

  if (q) { clauses.push(`text ILIKE $${i++}`); params.push(`%${q}%`); }
  if (standard) { clauses.push(`standard = $${i++}`); params.push(standard); }
  if (category) { clauses.push(`category = $${i++}`); params.push(category); }

  const { rows } = await query(
    `SELECT * FROM checklist_items WHERE ${clauses.join(' AND ')} ORDER BY standard, category, text`,
    params
  );
  res.json({ items: rows });
});

checklistsRouter.post('/library', requireAuth, requireRole('business_owner', 'operations_manager'), async (req, res) => {
  const { text, description, standard, category, requiresPhoto } = req.body;
  if (!text || !standard) return res.status(400).json({ error: 'text and standard are required' });
  const { rows } = await query(
    `INSERT INTO checklist_items (tenant_id, text, description, standard, category, requires_photo)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [req.auth.tenantId, text, description || null, standard, category || null, !!requiresPhoto]
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
  res.json({ template: templateRows[0], items: itemRows });
});

// Custom checklists (built in the Checklist Builder) require manager access.
// The two built-in daily operation report kinds are auto-provisioned the
// first time any authenticated user opens that report, so they're exempt.
function requireManagerUnlessBuiltinDailyReport(req, res, next) {
  const builtin = req.body.kind === 'kitchen_daily' || req.body.kind === 'bar_daily';
  if (builtin) return next();
  return requireRole('business_owner', 'operations_manager')(req, res, next);
}

checklistsRouter.post('/templates', requireAuth, requireOnboardingComplete, requireManagerUnlessBuiltinDailyReport, async (req, res) => {
  const { name, description, kind, frequency, itemIds } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });

  const result = await withTransaction(async (client) => {
    const templateRes = await client.query(
      `INSERT INTO checklist_templates (tenant_id, name, description, kind, frequency, created_by)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [req.auth.tenantId, name, description || null, kind || 'custom', frequency || 'daily', req.auth.userId]
    );
    const template = templateRes.rows[0];

    if (Array.isArray(itemIds) && itemIds.length) {
      const values = itemIds.map((_, idx) => `($1, $${idx + 2}, ${idx})`).join(', ');
      await client.query(
        `INSERT INTO checklist_template_items (template_id, item_id, sort_order) VALUES ${values}`,
        [template.id, ...itemIds]
      );
    }
    return template;
  });

  res.status(201).json({ template: result });
});

checklistsRouter.delete('/templates/:id', requireAuth, requireRole('business_owner', 'operations_manager'), async (req, res) => {
  await query('DELETE FROM checklist_templates WHERE id = $1 AND tenant_id = $2', [req.params.id, req.auth.tenantId]);
  res.status(204).end();
});

// --- Assignments: assign a template to stores / users / roles ---
checklistsRouter.get('/assignments', requireAuth, async (req, res) => {
  const { rows } = await query(
    `SELECT a.*, t.name AS template_name, b.name AS branch_name
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
  const { rows } = await query(
    `INSERT INTO checklist_assignments (tenant_id, template_id, branch_id, user_id, role, due_time)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [req.auth.tenantId, templateId, branchId || null, userId || null, role || null, dueTime || null]
  );
  res.status(201).json({ assignment: rows[0] });
});

checklistsRouter.delete('/assignments/:id', requireAuth, requireRole('business_owner', 'operations_manager', 'area_manager'), async (req, res) => {
  await query('DELETE FROM checklist_assignments WHERE id = $1 AND tenant_id = $2', [req.params.id, req.auth.tenantId]);
  res.status(204).end();
});

// Checklists assigned to the current user, for "My Checklists Today"
checklistsRouter.get('/my-assignments', requireAuth, async (req, res) => {
  const { rows } = await query(
    `SELECT a.*, t.name AS template_name, t.kind, t.frequency, b.name AS branch_name
     FROM checklist_assignments a
     JOIN checklist_templates t ON t.id = a.template_id
     LEFT JOIN branches b ON b.id = a.branch_id
     LEFT JOIN user_branches ub ON ub.branch_id = a.branch_id AND ub.user_id = $2
     WHERE a.tenant_id = $1 AND a.active
       AND (a.user_id = $2 OR a.role = $3 OR a.branch_id IS NULL OR ub.user_id IS NOT NULL)
     ORDER BY a.due_time NULLS LAST`,
    [req.auth.tenantId, req.auth.userId, req.auth.role]
  );
  res.json({ assignments: rows });
});
