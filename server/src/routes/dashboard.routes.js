import { Router } from 'express';
import { query } from '../db.js';
import { requireAuth, requireRole } from '../auth/middleware.js';
import { MY_ASSIGNMENTS_FROM, myAssignmentParams } from '../assignments.js';
import { visibleBranchIds } from '../auth/scope.js';
import { temperatureDeviations as formTemperatureDeviations } from '../../../shared/temperatures.js';

export const dashboardRouter = Router();

const PERIODS = ['daily', 'weekly', 'monthly', 'quarterly'];

function periodStart(period) {
  const d = new Date();
  switch (period) {
    case 'weekly': d.setDate(d.getDate() - 7); break;
    case 'monthly': d.setMonth(d.getMonth() - 1); break;
    case 'quarterly': d.setMonth(d.getMonth() - 3); break;
    case 'daily':
    default: d.setDate(d.getDate() - 1); break;
  }
  return d.toISOString();
}

const amount = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

// Waste value as the report forms actually record it: the Kitchen
// report's "Total waste value" and the Bar report's "Total beverage waste
// value". (This used to read form_data.waste_log[].value, a shape no form
// writes, so the tile always showed $0.00.)
function wasteFromForm(formData) {
  if (!formData) return 0;
  let total = amount(formData.wasteTotal?.value) + amount(formData.stockNotes?.wasteValue);
  if (Array.isArray(formData.waste_log)) {
    for (const entry of formData.waste_log) total += amount(entry?.value);
  }
  return total;
}

// KPI dashboard: compliance %, temperature deviations, waste value, incident count.
// Only submitted reports count — a half-finished run isn't a result yet.
//
// Business-wide numbers (waste value, incidents) are for managers. Owners
// and operations managers see every store; area and store managers see
// the stores they work at. (Any signed-in employee used to get the whole
// business's figures.)
dashboardRouter.get('/kpi', requireAuth, requireRole('business_owner', 'operations_manager', 'area_manager', 'store_manager'), async (req, res) => {
  const period = PERIODS.includes(req.query.period) ? req.query.period : 'daily';
  const branchId = req.query.branchId || null;
  const since = periodStart(period);

  const scopedBranchIds = await visibleBranchIds(req.auth); // null = every store

  const params = [req.auth.tenantId, since];
  const clauses = [];
  if (branchId) { params.push(branchId); clauses.push(`s.branch_id = $${params.length}`); }
  if (scopedBranchIds) { params.push(scopedBranchIds); clauses.push(`s.branch_id = ANY($${params.length}::uuid[])`); }
  const branchClause = clauses.map((c) => `AND ${c}`).join(' ');

  const { rows: submissionRows } = await query(
    `SELECT s.id, s.has_incident, s.form_data, t.kind
     FROM checklist_submissions s
     JOIN checklist_templates t ON t.id = s.template_id
     WHERE s.tenant_id = $1 AND s.status = 'submitted' AND s.started_at >= $2 ${branchClause}`,
    params
  );

  // Latest answer per checkpoint per run, so a changed answer isn't
  // counted twice.
  const { rows: complianceRows } = await query(
    `SELECT DISTINCT ON (r.submission_id, r.item_id) r.is_compliant, ci.category, ci.is_critical
     FROM checklist_submission_responses r
     JOIN checklist_submissions s ON s.id = r.submission_id
     JOIN checklist_items ci ON ci.id = r.item_id
     WHERE s.tenant_id = $1 AND s.status = 'submitted' AND s.started_at >= $2 ${branchClause}
     ORDER BY r.submission_id, r.item_id, r.created_at DESC`,
    params
  );
  const answered = complianceRows.filter((r) => r.is_compliant !== null);

  const totalResponses = answered.length;
  const compliantResponses = answered.filter((r) => r.is_compliant === true).length;
  const compliancePct = totalResponses ? Math.round((compliantResponses / totalResponses) * 1000) / 10 : null;

  // Matches both the original placeholder category ('temperature') and
  // the richer imported category names (e.g. "... Food Safety &
  // Temperature Control") — substring, case-insensitive. On the Kitchen
  // and Bar reports, each logged reading outside its safe range counts
  // (these used to count only when "Temperature deviation found" was
  // ticked, so a freezer logged at 4 °C went unnoticed); a ticked box with
  // no out-of-range reading still counts once.
  const temperatureDeviations =
    answered.filter((r) => r.category?.toLowerCase().includes('temperature') && r.is_compliant === false).length +
    submissionRows.reduce((sum, s) => {
      const readings = formTemperatureDeviations(s.kind, s.form_data?.temperatureLog).length;
      return sum + Math.max(readings, s.form_data?.tempDeviation?.found === true ? 1 : 0);
    }, 0);

  const criticalFailCount = answered.filter((r) => r.is_critical && r.is_compliant === false).length;
  const incidentCount = submissionRows.filter((s) => s.has_incident).length;
  const wasteValue = submissionRows.reduce((sum, s) => sum + wasteFromForm(s.form_data), 0);

  res.json({
    period,
    branchId,
    scopedBranchIds,
    compliancePct,
    temperatureDeviations,
    wasteValue: Math.round(wasteValue * 100) / 100,
    incidentCount,
    criticalFailCount,
    submissionsCount: submissionRows.length,
  });
});

// Small "today" summary used by role dashboards
dashboardRouter.get('/summary', requireAuth, async (req, res) => {
  const { rows: myAssignments } = await query(
    `SELECT count(*)::int AS n ${MY_ASSIGNMENTS_FROM}`,
    myAssignmentParams(req.auth)
  );
  const { rows: submittedToday } = await query(
    `SELECT count(*)::int AS n FROM checklist_submissions
     WHERE tenant_id = $1 AND submitted_by = $2 AND status = 'submitted'
       AND submitted_at >= now() - interval '24 hours'`,
    [req.auth.tenantId, req.auth.userId]
  );
  const { rows: branches } = await query('SELECT count(*)::int AS n FROM branches WHERE tenant_id = $1 AND is_active', [req.auth.tenantId]);
  const { rows: users } = await query("SELECT count(*)::int AS n FROM users WHERE tenant_id = $1 AND status != 'disabled'", [req.auth.tenantId]);

  res.json({
    assignedChecklists: myAssignments[0].n,
    submittedLast24h: submittedToday[0].n,
    branchCount: branches[0].n,
    userCount: users[0].n,
  });
});
