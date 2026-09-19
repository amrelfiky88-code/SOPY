// Slows password guessing: after too many failed attempts on one account
// (or one invite token), further attempts are refused for a while.
// Keyed by the account, not the IP — behind a load balancer or tunnel
// every user can share one IP, and one person's typos mustn't lock out
// the whole restaurant. In-memory, so it resets on restart; that's fine
// for a single-process deployment.

const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 10;
const failures = new Map(); // key -> { count, first }

function entry(key) {
  const e = failures.get(key);
  if (e && Date.now() - e.first > WINDOW_MS) {
    failures.delete(key);
    return null;
  }
  return e;
}

export function isLocked(key) {
  const e = entry(key);
  return !!e && e.count >= MAX_FAILURES;
}

export function recordFailure(key) {
  const e = entry(key);
  if (e) e.count += 1;
  else failures.set(key, { count: 1, first: Date.now() });
  // Keep memory bounded if someone sprays random emails.
  if (failures.size > 10_000) failures.delete(failures.keys().next().value);
}

export function clearFailures(key) {
  failures.delete(key);
}

export const LOCKED_MESSAGE = 'Too many failed attempts. Wait 15 minutes and try again.';
