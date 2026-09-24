import { Router } from 'express';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { query, withTransaction } from '../db.js';
import { requireAuth, requireRole } from '../auth/middleware.js';
import { isValidRole, canAssignRole, canManageUser, ACCESS_LEVEL_VALUES, EDITABLE_STATUSES } from '../auth/roles.js';
import { PLAN_LIMITS, clampPlanCount } from '../../../shared/pricing.js';

export const tenantsRouter = Router();

const CLIENT_SETTABLE_STEPS = ['pricing', 'checkout'];
// Matches the options on the Configure page.
const BUSINESS_TYPES = ['restaurant', 'cafe', 'quick_service', 'bar', 'cloud_kitchen', 'hotel_fb'];

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
  // Lowering a count below what's already in use would leave stores or
  // people the plan doesn't cover (and bill for fewer at the next
  // checkout), so it's refused here just as it is on the billing route.
  const { rows: usage } = await query(
    `SELECT (SELECT count(*)::int FROM branches WHERE tenant_id = $1 AND is_active) AS branches,
            (SELECT count(*)::int FROM users WHERE tenant_id = $1 AND status != 'disabled') AS users`,
    [req.auth.tenantId]
  );

  if (branchCount !== undefined) {
    const n = clampPlanCount(branchCount, PLAN_LIMITS.branches);
    if (n === null) return res.status(400).json({ error: 'branchCount must be a number' });
    if (n < usage[0].branches) {
      return res.status(409).json({ error: `You have ${usage[0].branches} active stores. Remove stores in Team & stores before lowering the plan to ${n}.` });
    }
    fields.push(`branch_count = $${i++}`); values.push(n);
  }
  if (userCount !== undefined) {
    const n = clampPlanCount(userCount, PLAN_LIMITS.users);
    if (n === null) return res.status(400).json({ error: 'userCount must be a number' });
    if (n < usage[0].users) {
      return res.status(409).json({ error: `You have ${usage[0].users} users (including pending invites). Disable users in Team & stores before lowering the plan to ${n}.` });
    }
    fields.push(`user_count = $${i++}`); values.push(n);
  }
  if (businessType !== undefined) {
    if (!BUSINESS_TYPES.includes(businessType)) return res.status(400).json({ error: 'Unknown business type' });
    fields.push(`business_type = $${i++}`); values.push(businessType);
  }
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
// works_here marks the stores the signed-in person belongs to, so report
// forms can default to their own store rather than the business's first.
tenantsRouter.get('/branches', requireAuth, async (req, res) => {
  const { rows } = await query(
    `SELECT b.*, EXISTS (SELECT 1 FROM user_branches ub WHERE ub.branch_id = b.id AND ub.user_id = $2) AS works_here
     FROM branches b WHERE b.tenant_id = $1 AND b.is_active ORDER BY b.created_at`,
    [req.auth.tenantId, req.auth.userId]
  );
  res.json({ branches: rows });
});

// The subscription is billed per store and per user, so the plan's counts
// are a ceiling: without this a business paying for one store and one
// user could add any number of either.
async function planRoom(tenantId, kind) {
  const { rows } = await query(
    kind === 'branches'
      ? `SELECT t.branch_count AS allowed, t.onboarding_step,
                (SELECT count(*)::int FROM branches WHERE tenant_id = t.id AND is_active) AS used
         FROM tenants t WHERE t.id = $1`
      : `SELECT t.user_count AS allowed, t.onboarding_step,
                (SELECT count(*)::int FROM users WHERE tenant_id = t.id AND status != 'disabled') AS used
         FROM tenants t WHERE t.id = $1`,
    [tenantId]
  );
  const r = rows[0];
  return { allowed: r.allowed, used: r.used, full: r.used >= r.allowed, settingUp: r.onboarding_step !== 'complete' };
}

const planFullMessage = (what, room, role) =>
  `Your plan covers ${room.allowed} ${what}${room.allowed === 1 ? '' : 's'}. ` +
  (role !== 'business_owner'
    ? 'Ask the business owner to add more to the plan.'
    : room.settingUp
      ? 'You can add more from Profile & billing once setup is finished.'
      : 'Change your plan in Profile & billing to add more.');

tenantsRouter.post('/branches', requireAuth, requireRole('business_owner', 'operations_manager'), async (req, res) => {
  const { address, city, timezone } = req.body;
  const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
  if (!name) return res.status(400).json({ error: 'Branch name is required' });
  if (name.length > 120) return res.status(400).json({ error: 'That store name is too long' });
  if ((typeof city === 'string' && city.trim().length > 120) || (typeof address === 'string' && address.length > 300)) {
    return res.status(400).json({ error: 'That text is too long' });
  }
  const room = await planRoom(req.auth.tenantId, 'branches');
  if (room.full) return res.status(409).json({ error: planFullMessage('store', room, req.auth.role) });
  const { rows } = await query(
    `INSERT INTO branches (tenant_id, name, address, city, timezone)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [req.auth.tenantId, name, address || null, typeof city === 'string' ? city.trim() || null : null, timezone || 'UTC']
  );
  res.status(201).json({ branch: rows[0] });
});

tenantsRouter.delete('/branches/:id', requireAuth, requireRole('business_owner', 'operations_manager'), async (req, res) => {
  await query('UPDATE branches SET is_active = false WHERE id = $1 AND tenant_id = $2', [req.params.id, req.auth.tenantId]);
  res.status(204).end();
});

// --- Users / invites ---
// Everyone's email, phone and role: for the people who manage the team.
// (Any signed-in employee used to be able to read the whole staff list.)
tenantsRouter.get('/users', requireAuth, requireRole('business_owner', 'operations_manager', 'area_manager'), async (req, res) => {
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
  if (typeof fullName !== 'string' || typeof email !== 'string' || !fullName.trim() || !email.trim() || !role) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  if (fullName.trim().length > 120 || email.trim().length > 200) {
    return res.status(400).json({ error: 'That name or email is too long' });
  }
  if (!isValidRole(role)) return res.status(400).json({ error: 'Unknown role' });
  if (!canAssignRole(req.auth.role, role)) {
    return res.status(403).json({ error: "You can only invite people to roles below your own" });
  }
  if (accessLevel !== undefined && !ACCESS_LEVEL_VALUES.includes(accessLevel)) {
    return res.status(400).json({ error: 'Unknown access level' });
  }
  const branches = await validBranchIds(branchIds ?? [], req.auth.tenantId);
  if (branches === undefined) return res.status(400).json({ error: 'One or more stores were not found' });

  const cleanEmail = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) return res.status(400).json({ error: 'Enter a valid email address' });
  const existing = await query('SELECT id FROM users WHERE email = $1', [cleanEmail]);
  if (existing.rows.length) return res.status(409).json({ error: 'A user with this email already exists' });

  const room = await planRoom(req.auth.tenantId, 'users');
  if (room.full) return res.status(409).json({ error: planFullMessage('user', room, req.auth.role) });

  const inviteToken = crypto.randomBytes(24).toString('hex');
  const placeholderHash = await bcrypt.hash(crypto.randomBytes(16).toString('hex'), 10);

  let user;
  try {
    user = await withTransaction(async (client) => {
      const { rows } = await client.query(
        `INSERT INTO users (tenant_id, full_name, email, role, access_level, status, invite_token, invite_expires_at, password_hash)
         VALUES ($1, $2, $3, $4, $5, 'invited', $6, now() + interval '${INVITE_DAYS} days', $7) RETURNING *`,
        [req.auth.tenantId, fullName.trim(), cleanEmail, role, accessLevel || 'standard', inviteToken, placeholderHash]
      );
      if (branches.length) {
        const values = branches.map((_, idx) => `($1, $${idx + 2})`).join(', ');
        await client.query(`INSERT INTO user_branches (user_id, branch_id) VALUES ${values}`, [rows[0].id, ...branches]);
      }
      return rows[0];
    });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'A user with this email already exists' });
    throw err;
  }

  // In production this would send an email with the invite link.
  // Returned directly here so the demo/onboarding flow can show it.
  res.status(201).json({
    user: { id: user.id, fullName: user.full_name, email: user.email, role: user.role },
    inviteLink: `/accept-invite?token=${inviteToken}`,
  });
});

// Links used to work forever, so a reset link forwarded months ago still
// let whoever had it take over the account.
const INVITE_DAYS = 14;
const RESET_HOURS = 48;

// A manager creates a one-time link for someone who forgot their password
// (SOPY doesn't send email, so there was no way back in at all). Opening
// it lets them set a new password; that also signs out their other
// devices. For someone who hasn't accepted yet it's a fresh invite link,
// replacing one that expired or got lost. Same rank rules as editing.
tenantsRouter.post('/users/:id/reset-link', requireAuth, requireRole('business_owner', 'operations_manager', 'area_manager'), async (req, res) => {
  const { rows } = await query(
    'SELECT id, role, status FROM users WHERE id = $1 AND tenant_id = $2',
    [req.params.id, req.auth.tenantId]
  ).catch(() => ({ rows: [] }));
  const target = rows[0];
  if (!target) return res.status(404).json({ error: 'User not found' });
  if (target.id === req.auth.userId) return res.status(403).json({ error: 'Change your own password in Profile & billing' });
  if (!canManageUser(req.auth.role, target.role)) return res.status(403).json({ error: 'You can only manage people below your own role' });
  if (target.status === 'disabled') return res.status(409).json({ error: 'Enable this person before sending them a link' });

  const token = crypto.randomBytes(24).toString('hex');
  const lifetime = target.status === 'invited' ? `${INVITE_DAYS} days` : `${RESET_HOURS} hours`;
  const { rows: updated } = await query(
    'UPDATE users SET invite_token = $1, invite_expires_at = now() + $2::interval WHERE id = $3 RETURNING invite_expires_at',
    [token, lifetime, target.id]
  );
  res.status(201).json({ resetLink: `/accept-invite?token=${token}`, kind: target.status === 'invited' ? 'invite' : 'reset', expiresAt: updated[0].invite_expires_at });
});

// Columns safe to send to the browser — never password_hash or invite_token.
const PUBLIC_USER_COLUMNS = 'id, full_name, title, email, phone, role, access_level, status, language';

tenantsRouter.patch('/users/:id', requireAuth, requireRole('business_owner', 'operations_manager', 'area_manager'), async (req, res) => {
  const { role, accessLevel, status, branchIds } = req.body;

  // Resolve the target inside this tenant *first*. Everything below —
  // including the branch-assignment rewrite — only runs once we know the
  // user is ours; previously that rewrite ran against any id it was given.
  const { rows: targetRows } = await query(
    'SELECT id, role, status, invite_token FROM users WHERE id = $1 AND tenant_id = $2',
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
    let next = status;
    if (status === 'active') {
      // Re-enabling someone takes a seat again.
      if (target.status === 'disabled') {
        const room = await planRoom(req.auth.tenantId, 'users');
        if (room.full) return res.status(409).json({ error: planFullMessage('user', room, req.auth.role) });
      }
      // Someone who never accepted their invite goes back to 'invited' —
      // marking them 'active' left them with no password and a dead invite link.
      if (target.invite_token) next = 'invited';
    }
    // Disabling someone who already has a password drops any pending
    // reset link, so invite_token keeps meaning "never accepted" for the
    // re-enable rule above.
    if (status === 'disabled' && target.status === 'active') fields.push('invite_token = NULL', 'invite_expires_at = NULL');
    fields.push(`status = $${i++}`); values.push(next);
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
