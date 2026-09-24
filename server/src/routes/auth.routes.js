import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { query, withTransaction } from '../db.js';
import { signToken } from '../auth/jwt.js';
import { requireAuth } from '../auth/middleware.js';
import { isSupportedLanguage, DEFAULT_LANGUAGE } from '../../../shared/languages.js';
import { clampPlanCount, PLAN_LIMITS } from '../../../shared/pricing.js';
import { isLocked, recordFailure, clearFailures, LOCKED_MESSAGE } from '../auth/rateLimit.js';
import { planEnded } from '../auth/plan.js';
import { tenantForReferralCode } from '../credits.js';
import { REFERRAL_WELCOME_USD } from '../../../shared/referrals.js';

export const authRouter = Router();

// Step 2: "Who Are You" — creates the tenant + the first user (Business Owner)
authRouter.post('/signup', async (req, res) => {
  const {
    fullName, title, email, phone, password,
    restaurantName, country, branchCount, userCount,
  } = req.body;

  const cleanEmail = normalizeEmail(email);
  const name = str(fullName);
  const restaurant = str(restaurantName);
  const countryName = str(country);
  if (!name || !cleanEmail || typeof password !== 'string' || !restaurant || !countryName) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  if (!EMAIL_RE.test(cleanEmail)) return res.status(400).json({ error: 'Enter a valid email address' });
  if (tooLong(req.body)) return res.status(400).json({ error: 'That text is too long' });
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }
  if (password.length > 200) return res.status(400).json({ error: 'Password is too long' });

  const existing = await query('SELECT id FROM users WHERE email = $1', [cleanEmail]);
  if (existing.rows.length) {
    return res.status(409).json({ error: 'An account with this email already exists' });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  // Signed up through another business's referral link? Remember whose,
  // so they're rewarded when this business first pays. An unknown or
  // malformed code is simply ignored — it must never block a signup.
  const referredBy = await tenantForReferralCode(req.body.referralCode);

  let result;
  try {
    result = await withTransaction(async (client) => {
      const tenantRes = await client.query(
        `INSERT INTO tenants (restaurant_name, country, branch_count, user_count, onboarding_step, referred_by_tenant_id)
         VALUES ($1, $2, $3, $4, 'configure_data', $5) RETURNING *`,
        [
          restaurant, countryName,
          // Same limits as the Pricing page; a negative or huge count
          // used to be stored as-is.
          clampPlanCount(branchCount, PLAN_LIMITS.branches) ?? PLAN_LIMITS.branches.min,
          clampPlanCount(userCount, PLAN_LIMITS.users) ?? PLAN_LIMITS.users.min,
          referredBy,
        ]
      );
      const tenant = tenantRes.rows[0];

      const userRes = await client.query(
        `INSERT INTO users (tenant_id, full_name, title, email, phone, password_hash, role, access_level, language)
         VALUES ($1, $2, $3, $4, $5, $6, 'business_owner', 'admin', $7) RETURNING *`,
        [tenant.id, name, str(title) || null, cleanEmail, str(phone) || null, passwordHash, uiLanguage(req.body.language)]
      );
      // Signed up through a referral link: a welcome discount off the
      // first payment (the referrer's reward comes when that payment is made).
      if (referredBy) {
        await client.query(
          "INSERT INTO account_credits (tenant_id, amount, source) VALUES ($1, $2, 'welcome')",
          [tenant.id, REFERRAL_WELCOME_USD]
        );
      }
      return { tenant, user: userRes.rows[0] };
    });
  } catch (err) {
    // Two signups racing on the same email: the unique index catches the
    // second one after the check above passed.
    if (err.code === '23505') return res.status(409).json({ error: 'An account with this email already exists' });
    throw err;
  }

  const token = signToken({ userId: result.user.id });
  res.status(201).json({
    token,
    user: publicUser(result.user),
    tenant: result.tenant,
  });
});

authRouter.post('/login', async (req, res) => {
  const { password } = req.body;
  // Phones autocapitalise and add trailing spaces; neither should fail a login.
  const email = normalizeEmail(req.body.email);
  if (!email || typeof password !== 'string' || !password) return res.status(400).json({ error: 'Missing credentials' });

  const lockKey = `login:${email}`;
  if (isLocked(lockKey)) return res.status(429).json({ error: LOCKED_MESSAGE });

  const { rows } = await query('SELECT * FROM users WHERE email = $1', [email]);
  const user = rows[0];
  // Invited users have a random placeholder hash until they accept.
  const ok = user && user.status !== 'invited' && (await bcrypt.compare(password, user.password_hash));
  if (!ok) {
    recordFailure(lockKey);
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  clearFailures(lockKey);
  if (user.status === 'disabled') return res.status(403).json({ error: 'Account disabled' });

  const token = signToken({ userId: user.id });
  const { rows: tenantRows } = await query('SELECT * FROM tenants WHERE id = $1', [user.tenant_id]);
  res.json({ token, user: publicUser(user), tenant: { ...tenantRows[0], plan_ended: await planEnded(user.tenant_id) } });
});

// Accept an invite: sets a password for a pre-created 'invited' user
authRouter.post('/accept-invite', async (req, res) => {
  const { inviteToken, password } = req.body;
  if (typeof inviteToken !== 'string' || !inviteToken || typeof password !== 'string') return res.status(400).json({ error: 'Missing fields' });
  if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
  if (password.length > 200) return res.status(400).json({ error: 'Password is too long' });

  // Also used for manager-issued password resets, where the person is
  // already active. Disabled accounts can't come back through a link.
  const { rows } = await query(
    "SELECT * FROM users WHERE invite_token = $1 AND status IN ('invited', 'active')",
    [inviteToken]
  );
  const user = rows[0];
  if (!user) return res.status(404).json({ error: 'This link has already been used or is no longer valid' });
  if (user.invite_expires_at && new Date(user.invite_expires_at) < new Date()) {
    return res.status(410).json({ error: 'This link has expired. Ask your manager for a new one.' });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  // The language they read the invite page in becomes their setting,
  // unless they already had one (a password reset keeps it).
  const language = user.status === 'invited' && isSupportedLanguage(req.body.language) ? req.body.language : user.language;
  await query(
    "UPDATE users SET password_hash = $1, status = 'active', invite_token = NULL, invite_expires_at = NULL, tokens_valid_after = $2, language = $3 WHERE id = $4",
    [passwordHash, new Date(), language, user.id]
  );
  clearFailures(`login:${user.email}`);

  const token = signToken({ userId: user.id });
  res.json({ token, user: publicUser({ ...user, status: 'active', language }) });
});

authRouter.get('/me', requireAuth, async (req, res) => {
  const { rows } = await query('SELECT * FROM users WHERE id = $1', [req.auth.userId]);
  const { rows: tenantRows } = await query('SELECT * FROM tenants WHERE id = $1', [req.auth.tenantId]);
  // Lets the app show a "subscription ended" banner up front instead of
  // failing on the first thing someone tries to save.
  res.json({ user: publicUser(rows[0]), tenant: { ...tenantRows[0], plan_ended: await planEnded(req.auth.tenantId) } });
});

// Lets a signed-in user edit their own profile from the account page.
// Email is deliberately not editable here: it's the login identity and
// carries a global unique index, so changing it is an account-recovery
// flow rather than a profile edit.
authRouter.patch('/me', requireAuth, async (req, res) => {
  const { fullName, title, phone, language } = req.body;
  if (tooLong({ fullName, title, phone })) return res.status(400).json({ error: 'That text is too long' });

  const fields = [];
  const values = [];
  let i = 1;

  if (language !== undefined) {
    if (!isSupportedLanguage(language)) return res.status(400).json({ error: 'Unsupported language' });
    fields.push(`language = $${i++}`); values.push(language);
  }

  if (fullName !== undefined) {
    if (!String(fullName).trim()) return res.status(400).json({ error: 'Name cannot be empty' });
    fields.push(`full_name = $${i++}`); values.push(String(fullName).trim());
  }
  if (title !== undefined) { fields.push(`title = $${i++}`); values.push(String(title).trim() || null); }
  if (phone !== undefined) { fields.push(`phone = $${i++}`); values.push(String(phone).trim() || null); }

  if (!fields.length) return res.status(400).json({ error: 'No fields to update' });

  values.push(req.auth.userId);
  const { rows } = await query(`UPDATE users SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`, values);
  res.json({ user: publicUser(rows[0]) });
});

// Change your own password. Signs out every other device (their sessions
// predate tokens_valid_after) and hands this one a fresh token.
authRouter.patch('/password', requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (typeof currentPassword !== 'string' || typeof newPassword !== 'string') {
    return res.status(400).json({ error: 'Enter your current and new password' });
  }
  if (newPassword.length < 8) return res.status(400).json({ error: 'New password must be at least 8 characters' });
  if (newPassword.length > 200) return res.status(400).json({ error: 'Password is too long' });

  const lockKey = `password:${req.auth.userId}`;
  if (isLocked(lockKey)) return res.status(429).json({ error: LOCKED_MESSAGE });
  const { rows } = await query('SELECT password_hash FROM users WHERE id = $1', [req.auth.userId]);
  if (!(await bcrypt.compare(currentPassword, rows[0].password_hash))) {
    recordFailure(lockKey);
    return res.status(400).json({ error: 'Your current password is not correct' });
  }
  clearFailures(lockKey);

  // App-clock time, the same clock that stamps the new token below — a DB
  // clock running ahead would otherwise reject the fresh session too.
  await query(
    'UPDATE users SET password_hash = $1, tokens_valid_after = $2 WHERE id = $3',
    [await bcrypt.hash(newPassword, 10), new Date(), req.auth.userId]
  );
  res.json({ token: signToken({ userId: req.auth.userId }) });
});

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const str = (v) => (typeof v === 'string' ? v.trim() : '');
// Names and details show on every report and PDF; there was no limit at
// all, so a pasted essay became someone's name.
const MAX_LENGTH = { fullName: 120, title: 120, phone: 40, restaurantName: 120, country: 80, email: 200 };
const tooLong = (body) => Object.entries(MAX_LENGTH).some(([k, max]) => typeof body[k] === 'string' && body[k].trim().length > max);
// The language someone signed up in, falling back to the default.
const uiLanguage = (v) => (isSupportedLanguage(v) ? v : DEFAULT_LANGUAGE);
export const normalizeEmail = (v) => str(v).toLowerCase();

function publicUser(u) {
  return {
    id: u.id,
    tenantId: u.tenant_id,
    fullName: u.full_name,
    title: u.title,
    email: u.email,
    phone: u.phone,
    role: u.role,
    language: u.language || DEFAULT_LANGUAGE,
    accessLevel: u.access_level,
    status: u.status,
  };
}
