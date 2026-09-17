import { Router } from 'express';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { query } from '../db.js';
import { requireAuth, requireRole } from '../auth/middleware.js';
import { PLAN_LIMITS, clampPlanCount } from '../../../shared/pricing.js';

export const tenantsRouter = Router();

// Step 3: "Configure Your Data" — confirm branch/user counts and business type
tenantsRouter.patch('/current', requireAuth, requireRole('business_owner', 'operations_manager'), async (req, res) => {
  const { branchCount, userCount, businessType, onboardingStep } = req.body;

  const fields = [];
  const values = [];
  let i = 1;

  // Clamp rather than trust the client: `Number('abc')` is NaN (which the
  // integer column rejects outright) and a negative or zero count would
  // price out at $0.00. Limits live in shared/pricing.js so the Pricing
  // page and checkout enforce exactly the same range.
  if (branchCount !== undefined) {
    const n = clampPlanCount(branchCount, PLAN_LIMITS.branches);
    if (n === null) return res.status(400).json({ error: 'branchCount must be a number' });
    fields.push(`branch_count = $${i++}`); values.push(n);
  }
  if (userCount !== undefined) {
    const n = clampPlanCount(userCount, PLAN_LIMITS.users);
    if (n === null) return res.status(400).json({ error: 'userCount must be a number' });
    fields.push(`user_count = $${i++}`); values.push(n);
  }
  if (businessType !== undefined) { fields.push(`business_type = $${i++}`); values.push(businessType); }
  if (onboardingStep !== undefined) { fields.push(`onboarding_step = $${i++}`); values.push(onboardingStep); }

  if (!fields.length) return res.status(400).json({ error: 'No fields to update' });

  values.push(req.auth.tenantId);
  const { rows } = await query(
    `UPDATE tenants SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`,
    values
  );
  res.json({ tenant: rows[0] });
});

tenantsRouter.get('/current', requireAuth, async (req, res) => {
  const { rows } = await query('SELECT * FROM tenants WHERE id = $1', [req.auth.tenantId]);
  res.json({ tenant: rows[0] });
});

// --- Branches ---
tenantsRouter.get('/branches', requireAuth, async (req, res) => {
  const { rows } = await query(
    'SELECT * FROM branches WHERE tenant_id = $1 ORDER BY created_at',
    [req.auth.tenantId]
  );
  res.json({ branches: rows });
});

tenantsRouter.post('/branches', requireAuth, requireRole('business_owner', 'operations_manager'), async (req, res) => {
  const { name, address, city, timezone } = req.body;
  if (!name) return res.status(400).json({ error: 'Branch name is required' });
  const { rows } = await query(
    `INSERT INTO branches (tenant_id, name, address, city, timezone)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [req.auth.tenantId, name, address || null, city || null, timezone || 'UTC']
  );
  res.status(201).json({ branch: rows[0] });
});

tenantsRouter.delete('/branches/:id', requireAuth, requireRole('business_owner', 'operations_manager'), async (req, res) => {
  await query('UPDATE branches SET is_active = false WHERE id = $1 AND tenant_id = $2', [req.params.id, req.auth.tenantId]);
  res.status(204).end();
});

// --- Users / invites ---
tenantsRouter.get('/users', requireAuth, async (req, res) => {
  const { rows } = await query(
    `SELECT u.id, u.full_name, u.title, u.email, u.phone, u.role, u.access_level, u.status,
            COALESCE(array_agg(ub.branch_id) FILTER (WHERE ub.branch_id IS NOT NULL), '{}') AS branch_ids
     FROM users u
     LEFT JOIN user_branches ub ON ub.user_id = u.id
     WHERE u.tenant_id = $1
     GROUP BY u.id
     ORDER BY u.created_at`,
    [req.auth.tenantId]
  );
  res.json({ users: rows });
});

tenantsRouter.post('/users/invite', requireAuth, requireRole('business_owner', 'operations_manager', 'area_manager'), async (req, res) => {
  const { fullName, email, role, accessLevel, branchIds } = req.body;
  if (!fullName || !email || !role) return res.status(400).json({ error: 'Missing required fields' });

  const existing = await query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
  if (existing.rows.length) return res.status(409).json({ error: 'A user with this email already exists' });

  const inviteToken = crypto.randomBytes(24).toString('hex');
  const placeholderHash = await bcrypt.hash(crypto.randomBytes(16).toString('hex'), 10);

  const { rows } = await query(
    `INSERT INTO users (tenant_id, full_name, email, role, access_level, status, invite_token, password_hash)
     VALUES ($1, $2, $3, $4, $5, 'invited', $6, $7) RETURNING *`,
    [req.auth.tenantId, fullName, email.toLowerCase(), role, accessLevel || 'standard', inviteToken, placeholderHash]
  );
  const user = rows[0];

  if (Array.isArray(branchIds) && branchIds.length) {
    const values = branchIds.map((_, idx) => `($1, $${idx + 2})`).join(', ');
    await query(`INSERT INTO user_branches (user_id, branch_id) VALUES ${values}`, [user.id, ...branchIds]);
  }

  // In production this would send an email with the invite link.
  // Returned directly here so the demo/onboarding flow can show it.
  res.status(201).json({
    user: { id: user.id, fullName: user.full_name, email: user.email, role: user.role },
    inviteLink: `/accept-invite?token=${inviteToken}`,
  });
});

tenantsRouter.patch('/users/:id', requireAuth, requireRole('business_owner', 'operations_manager', 'area_manager'), async (req, res) => {
  const { role, accessLevel, status, branchIds } = req.body;
  const fields = [];
  const values = [];
  let i = 1;
  if (role !== undefined) { fields.push(`role = $${i++}`); values.push(role); }
  if (accessLevel !== undefined) { fields.push(`access_level = $${i++}`); values.push(accessLevel); }
  if (status !== undefined) { fields.push(`status = $${i++}`); values.push(status); }

  if (fields.length) {
    values.push(req.params.id, req.auth.tenantId);
    await query(`UPDATE users SET ${fields.join(', ')} WHERE id = $${i} AND tenant_id = $${i + 1}`, values);
  }

  if (Array.isArray(branchIds)) {
    await query('DELETE FROM user_branches WHERE user_id = $1', [req.params.id]);
    if (branchIds.length) {
      const values2 = branchIds.map((_, idx) => `($1, $${idx + 2})`).join(', ');
      await query(`INSERT INTO user_branches (user_id, branch_id) VALUES ${values2}`, [req.params.id, ...branchIds]);
    }
  }

  const { rows } = await query('SELECT * FROM users WHERE id = $1 AND tenant_id = $2', [req.params.id, req.auth.tenantId]);
  res.json({ user: rows[0] });
});
