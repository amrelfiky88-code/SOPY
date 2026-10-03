// Checks shared by routes that take people's details.

export const MAX_EMAIL_LENGTH = 200;

// Something@something.something, with no spaces and one "@": the same rule
// as the old /^[^\s@]+@[^\s@]+\.[^\s@]+$/, without its backtracking. That
// regex took quadratic time on a crafted address ("a@" + "a." × 50,000 +
// "@" took over 6 seconds), and sign-up ran it before checking length, so
// one request could stall the whole server. This is linear, and refuses
// anything longer than an email can be first.
export function isEmail(value) {
  if (typeof value !== 'string' || value.length > MAX_EMAIL_LENGTH) return false;
  if (/\s/.test(value)) return false;
  const at = value.indexOf('@');
  if (at < 1 || at !== value.lastIndexOf('@')) return false;
  // A dot in the domain with something on each side of it.
  return value.slice(at + 2, -1).includes('.');
}
