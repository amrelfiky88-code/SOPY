// Shared pricing calculator — imported by both server and web so the
// number a customer sees on the Pricing page always matches what billing
// charges. Keep this the single source of truth for the rate schedule.

// Tapering unit rate: first unit costs `first`, rate steps down toward
// `floor` as volume grows, reaching `floor` at or above `floorAt` units.
function taperedUnitRate(index, first, floor, floorAt) {
  // index is 1-based position of this unit (1st, 2nd, 3rd branch/user...)
  if (index <= 1) return first;
  if (index >= floorAt) return floor;
  const progress = (index - 1) / (floorAt - 1);
  return first - (first - floor) * progress;
}

export const RATE_SCHEDULE = {
  branch: { first: 10, floor: 7, floorAt: 10 },
  user: { first: 9, floor: 5, floorAt: 20 },
};

// A plan needs at least one of each — the tapered schedule returns $0.00
// for zero branches and zero users, which would hand out a free account.
// The upper bounds just keep a typo ("99999 users") from turning into a
// half-million-dollar invoice. Shared so the Pricing page, the tenant
// PATCH, and checkout all enforce the same range.
export const PLAN_LIMITS = {
  branches: { min: 1, max: 500 },
  users: { min: 1, max: 2000 },
};

// Returns null for input that isn't a usable count, so callers can tell
// "not a number" apart from "a number I clamped".
export function clampPlanCount(value, { min, max }) {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n)) return null;
  return Math.min(max, Math.max(min, n));
}

function lineTotal(count, schedule) {
  let total = 0;
  const perUnit = [];
  for (let i = 1; i <= count; i++) {
    const rate = taperedUnitRate(i, schedule.first, schedule.floor, schedule.floorAt);
    perUnit.push(rate);
    total += rate;
  }
  return { total: Math.round(total * 100) / 100, perUnit };
}

// Effective blended rate for a given count — what Paddle line items use
// as a flat unit price so quantity x price == the tapered total exactly.
export function blendedRate(count, schedule) {
  if (count <= 0) return schedule.first;
  const { total } = lineTotal(count, schedule);
  return Math.round((total / count) * 10000) / 10000;
}

export function calculatePricing({ branches, users }) {
  // Whole numbers within the plan limits. The rate is computed unit by
  // unit, so an unbounded count (say 1e9 from a crafted request) would
  // spin the server; a fraction like 1.5 isn't a store you can bill.
  const safe = (v, { max }) => Math.min(max, Math.max(0, Math.floor(Number(v)) || 0));
  const branchCount = safe(branches, PLAN_LIMITS.branches);
  const userCount = safe(users, PLAN_LIMITS.users);

  const branchLine = lineTotal(branchCount, RATE_SCHEDULE.branch);
  const userLine = lineTotal(userCount, RATE_SCHEDULE.user);

  const monthlyTotal = Math.round((branchLine.total + userLine.total) * 100) / 100;

  return {
    branchCount,
    userCount,
    branchSubtotal: branchLine.total,
    userSubtotal: userLine.total,
    branchBlendedRate: blendedRate(branchCount, RATE_SCHEDULE.branch),
    userBlendedRate: blendedRate(userCount, RATE_SCHEDULE.user),
    monthlyTotal,
    currency: 'USD',
  };
}
