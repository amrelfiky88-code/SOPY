import crypto from 'node:crypto';

// Evidence photos used to be served by a plain static handler: anyone
// with the URL could open one, with no login and no expiry. The paths
// contain random ids, but "hard to guess" is not access control — a URL
// in a browser history, a proxy log or a forwarded link stayed valid
// forever, for any tenant's photo.
//
// The API now hands out short-lived signed links instead: the path is
// signed with the server secret plus an expiry, so a link works in an
// <img> tag (no auth header needed) but stops working after a day and
// can't be altered to point at another business's photo.

const SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const TTL_MS = 24 * 60 * 60 * 1000;

const sign = (pathname, expires) =>
  crypto.createHmac('sha256', SECRET).update(`${pathname}|${expires}`).digest('base64url');

/** `/uploads/a/b/c.jpg` → `/uploads/a/b/c.jpg?e=…&s=…` */
export function signUploadPath(pathname) {
  if (!pathname || !pathname.startsWith('/uploads/')) return pathname;
  const expires = Date.now() + TTL_MS;
  return `${pathname}?e=${expires}&s=${sign(pathname, expires)}`;
}

/** Adds signed `photo_path`s to rows that have one. */
export const signPhotos = (rows) =>
  rows.map((row) => (row.photo_path ? { ...row, photo_path: signUploadPath(row.photo_path) } : row));

// Express middleware guarding the static /uploads mount.
export function requireSignedUpload(req, res, next) {
  const expires = Number(req.query.e);
  const signature = String(req.query.s || '');
  const pathname = `/uploads${req.path}`;
  if (!expires || !signature) return res.status(403).json({ error: 'This photo link is not valid' });
  if (Date.now() > expires) return res.status(403).json({ error: 'This photo link has expired' });

  const expected = sign(pathname, expires);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return res.status(403).json({ error: 'This photo link is not valid' });
  }
  next();
}
