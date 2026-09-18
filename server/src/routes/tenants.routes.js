import { Router } from 'express';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { query, withTransaction } from '../db.js';
import { requireAuth, requireRole } from '../auth/middleware.js';
import { isValidRole, canAssignRole, canManageUser, ACCESS_LEVEL_VALUES, EDITABLE_STATUSES } from '../auth/roles.js';
import { PLAN_LIMITS, clampPlanCount } from '../../../shared/pricing.js';

export const tenantsRouter = Router();

const CLIENT_SETTABLE_STEPS = ['pricing', 'checkout'];

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
  // The client may only walk forward through the pre-payment steps
  // (configure → pricing → checkout). Anything past checkout is the
  // server's to set once payment is confirmed; accepting any value let a
  // signup PATCH itself straight to 'complete' without paying, and let a
  // paying business that tapped "Change plan" get locked back into checkout.
  if (onboardingStep !== undefined) {
    if (!CLIENT_SETTABLE_STEPS.includes(onboardingStep)) {
      return res.status(400).json({ error: 'Invalid onboarding step' });
    }
    fields.push(`onboarding_step = CASE WHEN onboarding_step IN ('configure_data', 'pricing', 'checkout') THEN $${i++} ELSE onboarding_step END`);
    values.push(onboardingStep);
  }

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
// Removing a branch is a soft delete (is_active = false) so past checklist
// submissions keep their store. Every list must therefore filter on it —
// this one didn't, so a "removed" store stayed in every picker while the
// dashboard's active-store count (which did filter) disagreed with it.
tenantsRouter.get('/branches', requireAuth, async (req, res) => {
  const { rows } = await query(
    'SELECT * FROM branches WHERE tenant_id = $1 AND is_active ORDER BY created_at',
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

// Branch ids arrive from the client, so they must be proven to belong to
// this tenant before being linked to a user — otherwise a crafted request
// could attach staff to another business's store.
async function validBranchIds(branchIds, tenantId) {
  if (!Array.isArray(branchIds)) return null;
  if (!branchIds.length) return [];
  const unique = [...new Set(branchIds)];
  const { rows } = await query(
    'SELECT id FROM branches WHERE tenant_id = $1 AND is_active AND id = ANY($2::uuid[])',
    [tenantId, unique]
  ).catch(() => ({ rows: [] })); // malformed uuids → treated as not found
  return rows.length === unique.length ? unique : undefined;
}

tenantsRouter.post('/users/invite', requireAuth, requireRole('business_owner', 'operations_manager', 'area_manager'), async (req, res) => {
  const { fullName, email, role, accessLevel, branchIds } = req.body;
  if (!fullName?.trim() || !email?.trim() || !role) return res.status(400).json({ error: 'Missing required fields' });
  if (!isValidRole(role)) return res.status(400).json({ error: 'Unknown role' });
  if (!canAssignRole(req.auth.role, role)) {
    return res.status(403).json({ error: "You can only invite people to roles below your own" });
  }
  if (accessLevel !== undefined && !ACCESS_LEVEL_VALUES.includes(accessLevel)) {
    return res.status(400).json({ error: 'Unknown access level' });
  }
  const branches = await validBranchIds(branchIds ?? [], req.auth.tenantId);
  if (branches === undefined) return res.status(400).json({ error: 'One or more stores were not found' });

  const existing = await query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
  if (existing.rows.length) return res.status(409).json({ error: 'A user with this email already exists' });

  const inviteToken = crypto.randomBytes(24).toString('hex');
  const placeholderHash = await bcrypt.hash(crypto.randomBytes(16).toString('hex'), 10);

  const { rows } = await query(
    `INSERT INTO users (tenant_id, full_name, email, role, access_level, status, invite_token, password_hash)
     VALUES ($1, $2, $3, $4, $5, 'invited', $6, $7) RETURNING *`,
    [req.auth.tenantId, fullName.trim(), email.trim().toLowerCase(), role, accessLevel || 'standard', inviteToken, placeholderHash]
  );
  const user = rows[0];

  if (branches.length) {
    const values = branches.map((_, idx) => `($1, $${idx + 2})`).join(', ');
    await query(`INSERT INTO user_branches (user_id, branch_id) VALUES ${values}`, [user.id, ...branches]);
  }

  // In production this would send an email with the invite link.
  // Returned directly here so the demo/onboarding flow can show it.
  res.status(201).json({
    user: { id: user.id, fullName: user.full_name, email: user.email, role: user.role },
    inviteLink: `/accept-invite?token=${inviteToken}`,
  });
});

// Columns safe to send to the browser — never password_hash or invite_token.
const PUBLIC_USER_COLUMNS = 'id, full_name, title, email, phone, role, access_level, status, language';

tenantsRouter.patch('/users/:id', requireAuth, requireRole('business_owner', 'operations_manager', 'area_manager'), async (req, res) => {
  const { role, accessLevel, status, branchIds } = req.body;

  // Resolve the target inside this tenant *first*. Everything below —
  // including the branch-assignment rewrite — only runs once we know the
  // user is ours; previously that rewrite ran against any id it was given.
  const { rows: targetRows } = await query(
    'SELECT id, role FROM users WHERE id = $1 AND tenant_id = $2',
    [req.params.id, req.auth.tenantId]
  ).catch(() => ({ rows: [] }));
  const target = targetRows[0];
  if (!target) return res.status(404).json({ error: 'User not found' });

  if (target.id === req.auth.userId) {
    return res.status(403).json({ error: "You can't change your own role, access or status" });
  }
  if (!canManageUser(req.auth.role, target.role)) {
    return res.status(403).json({ error: 'You can only manage people below your own role' });
  }

  const fields = [];
  const values = [];
  let i = 1;
  if (role !== undefined) {
    if (!isValidRole(role)) return res.status(400).json({ error: 'Unknown role' });
    if (!canAssignRole(req.auth.role, role)) {
      return res.status(403).json({ error: 'You can only assign roles below your own' });
    }
    fields.push(`role = $${i++}`); values.push(role);
  }
  if (accessLevel !== undefined) {
    if (!ACCESS_LEVEL_VALUES.includes(accessLevel)) return res.status(400).json({ error: 'Unknown access level' });
    fields.push(`access_level = $${i++}`); values.push(accessLevel);
  }
  if (status !== undefined) {
    if (!EDITABLE_STATUSES.includes(status)) return res.status(400).json({ error: 'Unknown status' });
    fields.push(`status = $${i++}`); values.push(status);
  }

  const branches = branchIds === undefined ? null : await validBranchIds(branchIds, req.auth.tenantId);
  if (branches === undefined) return res.status(400).json({ error: 'One or more stores were not found' });

  await withTransaction(async (client) => {
    if (fields.length) {
      values.push(target.id);
      await client.query(`UPDATE users SET ${fields.join(', ')} WHERE id = $${i}`, values);
    }
    if (branches) {
      await client.query('DELETE FROM user_branches WHERE user_id = $1', [target.id]);
      if (branches.length) {
        const placeholders = branches.map((_, idx) => `($1, $${idx + 2})`).join(', ');
        await client.query(`INSERT INTO user_branches (user_id, branch_id) VALUES ${placeholders}`, [target.id, ...branches]);
      }
    }
  });

  const { rows } = await query(`SELECT ${PUBLIC_USER_COLUMNS} FROM users WHERE id = $1`, [target.id]);
  res.json({ user: rows[0] });
});
