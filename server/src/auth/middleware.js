import { verifyToken } from './jwt.js';
import { query } from '../db.js';

// Populates req.auth = { userId, tenantId, role } from the Bearer token.
export async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Missing authorization token' });

  try {
    const payload = verifyToken(token);
    const { rows } = await query(
      'SELECT id, tenant_id, role, access_level, status, tokens_valid_after FROM users WHERE id = $1',
      [payload.userId]
    );
    const user = rows[0];
    if (!user || user.status === 'disabled') {
      return res.status(401).json({ error: 'Invalid session' });
    }
    // Signed in before the password last changed or was reset: that
    // session (say, on a lost phone) no longer counts. `iat` is in seconds.
    if (user.tokens_valid_after && payload.iat * 1000 < new Date(user.tokens_valid_after).getTime() - 1000) {
      return res.status(401).json({ error: 'Your password was changed. Please sign in again.' });
    }
    req.auth = {
      userId: user.id,
      tenantId: user.tenant_id,
      role: user.role,
      accessLevel: user.access_level,
    };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.auth || !roles.includes(req.auth.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}
