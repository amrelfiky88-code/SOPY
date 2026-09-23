import jwt from 'jsonwebtoken';

const DEV_SECRET = 'dev-secret-change-me';
const SECRET = process.env.JWT_SECRET || DEV_SECRET;
// Sessions last a month: staff sign in once on a shared phone rather than
// every shift.
const EXPIRES_IN = '30d';

// A deploy that forgets JWT_SECRET would otherwise run on this public
// default, and anyone could mint a token for any account. Fail at boot
// instead of serving a wide-open app.
if (process.env.NODE_ENV === 'production' && (SECRET === DEV_SECRET || SECRET.length < 24)) {
  throw new Error('JWT_SECRET must be set to a long random value in production (24+ characters).');
}

export function signToken(payload) {
  return jwt.sign(payload, SECRET, { expiresIn: EXPIRES_IN });
}

export function verifyToken(token) {
  return jwt.verify(token, SECRET);
}
