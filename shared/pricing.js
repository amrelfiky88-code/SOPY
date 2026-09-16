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
  const branchCount = Math.max(0, Number(branches) || 0);
  const userCount = Math.max(0, Number(users) || 0);

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
