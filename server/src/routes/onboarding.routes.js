import { Router } from 'express';
import { query } from '../db.js';
import { requireAuth, requireRole } from '../auth/middleware.js';

export const onboardingRouter = Router();

// Step 6: onboarding wizard. Role selection and access levels are set via
// PATCH /tenants/users/:id, store setup via POST /tenants/branches, and
// invites via POST /tenants/users/invite. This just tracks/gates progress.

onboardingRouter.get('/status', requireAuth, async (req, res) => {
  const { rows: tenantRows } = await query('SELECT * FROM tenants WHERE id = $1', [req.auth.tenantId]);
  const { rows: branchRows } = await query('SELECT count(*)::int AS n FROM branches WHERE tenant_id = $1 AND is_active', [req.auth.tenantId]);
  const { rows: userRows } = await query("SELECT count(*)::int AS n FROM users WHERE tenant_id = $1 AND status != 'disabled'", [req.auth.tenantId]);

  const tenant = tenantRows[0];
  res.json({
    onboardingStep: tenant.onboarding_step,
    onboardingCompleted: !!tenant.onboarding_completed_at,
    storesConfigured: branchRows[0].n > 0,
    usersInvited: userRows[0].n > 1, // more than just the owner
    branchesSetUp: branchRows[0].n,
    usersSetUp: userRows[0].n,
  });
});

// Only once checkout is paid (step 'onboarding') — otherwise a fresh
// signup could call this and use the app without ever subscribing.
onboardingRouter.post('/complete', requireAuth, requireRole('business_owner', 'operations_manager'), async (req, res) => {
  const { rows } = await query(
    `UPDATE tenants SET onboarding_step = 'complete', onboarding_completed_at = COALESCE(onboarding_completed_at, now())
     WHERE id = $1 AND onboarding_step IN ('onboarding', 'complete') RETURNING *`,
    [req.auth.tenantId]
  );
  if (!rows[0]) return res.status(403).json({ error: 'Choose a plan and complete checkout first' });
  res.json({ tenant: rows[0] });
});
