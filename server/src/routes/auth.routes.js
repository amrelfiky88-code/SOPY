import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { query, withTransaction } from '../db.js';
import { signToken } from '../auth/jwt.js';
import { requireAuth } from '../auth/middleware.js';

export const authRouter = Router();

// Step 2: "Who Are You" — creates the tenant + the first user (Business Owner)
authRouter.post('/signup', async (req, res) => {
  const {
    fullName, title, email, phone, password,
    restaurantName, country, branchCount, userCount,
  } = req.body;

  if (!fullName || !email || !password || !restaurantName || !country) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  const existing = await query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
  if (existing.rows.length) {
    return res.status(409).json({ error: 'An account with this email already exists' });
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const result = await withTransaction(async (client) => {
    const tenantRes = await client.query(
      `INSERT INTO tenants (restaurant_name, country, branch_count, user_count, onboarding_step)
       VALUES ($1, $2, $3, $4, 'configure_data') RETURNING *`,
      [restaurantName, country, Number(branchCount) || 1, Number(userCount) || 1]
    );
    const tenant = tenantRes.rows[0];

    const userRes = await client.query(
      `INSERT INTO users (tenant_id, full_name, title, email, phone, password_hash, role, access_level)
       VALUES ($1, $2, $3, $4, $5, $6, 'business_owner', 'admin') RETURNING *`,
      [tenant.id, fullName, title || null, email.toLowerCase(), phone || null, passwordHash]
    );
    return { tenant, user: userRes.rows[0] };
  });

  const token = signToken({ userId: result.user.id });
  res.status(201).json({
    token,
    user: publicUser(result.user),
    tenant: result.tenant,
  });
});

authRouter.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Missing credentials' });

  const { rows } = await query('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);
  const user = rows[0];
  if (!user) return res.status(401).json({ error: 'Invalid email or password' });

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: 'Invalid email or password' });
  if (user.status === 'disabled') return res.status(403).json({ error: 'Account disabled' });

  const token = signToken({ userId: user.id });
  const { rows: tenantRows } = await query('SELECT * FROM tenants WHERE id = $1', [user.tenant_id]);
  res.json({ token, user: publicUser(user), tenant: tenantRows[0] });
});

// Accept an invite: sets a password for a pre-created 'invited' user
authRouter.post('/accept-invite', async (req, res) => {
  const { inviteToken, password } = req.body;
  if (!inviteToken || !password) return res.status(400).json({ error: 'Missing fields' });
  if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });

  const { rows } = await query(
    "SELECT * FROM users WHERE invite_token = $1 AND status = 'invited'",
    [inviteToken]
  );
  const user = rows[0];
  if (!user) return res.status(404).json({ error: 'Invite not found or already used' });

  const passwordHash = await bcrypt.hash(password, 10);
  await query(
    "UPDATE users SET password_hash = $1, status = 'active', invite_token = NULL WHERE id = $2",
    [passwordHash, user.id]
  );

  const token = signToken({ userId: user.id });
  res.json({ token, user: publicUser({ ...user, status: 'active' }) });
});

authRouter.get('/me', requireAuth, async (req, res) => {
  const { rows } = await query('SELECT * FROM users WHERE id = $1', [req.auth.userId]);
  const { rows: tenantRows } = await query('SELECT * FROM tenants WHERE id = $1', [req.auth.tenantId]);
  res.json({ user: publicUser(rows[0]), tenant: tenantRows[0] });
});

function publicUser(u) {
  return {
    id: u.id,
    tenantId: u.tenant_id,
    fullName: u.full_name,
    title: u.title,
    email: u.email,
    phone: u.phone,
    role: u.role,
    accessLevel: u.access_level,
    status: u.status,
  };
}
