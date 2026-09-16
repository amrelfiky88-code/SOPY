import { Router } from 'express';
import { query } from '../db.js';
import { requireAuth } from '../auth/middleware.js';

export const dashboardRouter = Router();

function periodStart(period) {
  const now = new Date();
  const d = new Date(now);
  switch (period) {
    case 'weekly': d.setDate(d.getDate() - 7); break;
    case 'monthly': d.setMonth(d.getMonth() - 1); break;
    case 'quarterly': d.setMonth(d.getMonth() - 3); break;
    case 'daily':
    default: d.setDate(d.getDate() - 1); break;
  }
  return d.toISOString();
}

// KPI dashboard: compliance %, temperature deviations, waste value, incident count
dashboardRouter.get('/kpi', requireAuth, async (req, res) => {
  const period = req.query.period || 'daily';
  const branchId = req.query.branchId || null;
  const since = periodStart(period);

  const branchClause = branchId ? 'AND s.branch_id = $3' : '';
  const params = [req.auth.tenantId, since];
  if (branchId) params.push(branchId);

  const { rows: submissionRows } = await query(
    `SELECT s.id, s.has_incident, s.form_data
     FROM checklist_submissions s
     WHERE s.tenant_id = $1 AND s.started_at >= $2 ${branchClause}`,
    params
  );

  const { rows: complianceRows } = await query(
    `SELECT r.is_compliant, ci.category, ci.is_critical
     FROM checklist_submission_responses r
     JOIN checklist_submissions s ON s.id = r.submission_id
     JOIN checklist_items ci ON ci.id = r.item_id
     WHERE s.tenant_id = $1 AND s.started_at >= $2 ${branchClause} AND r.is_compliant IS NOT NULL`,
    params
  );

  const totalResponses = complianceRows.length;
  const compliantResponses = complianceRows.filter((r) => r.is_compliant === true).length;
  const compliancePct = totalResponses ? Math.round((compliantResponses / totalResponses) * 1000) / 10 : null;

  // Matches both the original placeholder category ('temperature') and
  // the richer imported category names (e.g. "... Food Safety &
  // Temperature Control") — substring, case-insensitive.
  const temperatureDeviations = complianceRows.filter(
    (r) => r.category?.toLowerCase().includes('temperature') && r.is_compliant === false
  ).length;

  const criticalFailCount = complianceRows.filter((r) => r.is_critical && r.is_compliant === false).length;

  const incidentCount = submissionRows.filter((s) => s.has_incident).length;

  let wasteValue = 0;
  for (const s of submissionRows) {
    const wasteLog = s.form_data?.waste_log;
    if (Array.isArray(wasteLog)) {
      for (const entry of wasteLog) {
        wasteValue += Number(entry.value) || 0;
      }
    }
  }

  res.json({
    period,
    branchId,
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
    `SELECT count(*)::int AS n FROM checklist_assignments a
     LEFT JOIN user_branches ub ON ub.branch_id = a.branch_id AND ub.user_id = $2
     WHERE a.tenant_id = $1 AND a.active
       AND (a.user_id = $2 OR a.role = $3 OR a.branch_id IS NULL OR ub.user_id IS NOT NULL)`,
    [req.auth.tenantId, req.auth.userId, req.auth.role]
  );
  const { rows: submittedToday } = await query(
    `SELECT count(*)::int AS n FROM checklist_submissions
     WHERE tenant_id = $1 AND submitted_by = $2 AND started_at >= now() - interval '24 hours'`,
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
