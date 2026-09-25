import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculatePricing, blendedRate, RATE_SCHEDULE } from '../../shared/pricing.js';

test('first unit of each resource costs the base rate', () => {
  const p = calculatePricing({ branches: 1, users: 1 });
  assert.equal(p.branchSubtotal, 10);
  assert.equal(p.userSubtotal, 10);
  assert.equal(p.monthlyTotal, 20);
});

test('rate reaches the floor exactly at floorAt volume', () => {
  const p = calculatePricing({ branches: 10, users: 20 });
  // Arithmetic mean of first..floor over floorAt terms.
  assert.equal(p.branchBlendedRate, (10 + 7) / 2);
  assert.equal(p.userBlendedRate, (10 + 5) / 2);
  assert.equal(p.branchSubtotal, 85);
  assert.equal(p.userSubtotal, 150);
});

test('blended rate approaches but never drops below the floor as volume grows', () => {
  // Per-unit rate hits the floor exactly at floorAt and stays there, but
  // the BLENDED (average) rate stays slightly above the floor forever,
  // since the first few units were priced above it — it only gets
  // asymptotically closer as volume grows. It must never undershoot.
  let previousGap = Infinity;
  // blendedRate directly: calculatePricing caps counts at the plan limit
  // (500 stores), and this is about the rate curve itself.
  for (const branches of [10, 50, 500, 5000]) {
    const rate = blendedRate(branches, RATE_SCHEDULE.branch);
    const gap = rate - RATE_SCHEDULE.branch.floor;
    assert.ok(gap >= 0, `blended rate ${rate} dropped below floor at ${branches} branches`);
    assert.ok(gap <= previousGap, 'gap to floor should shrink (or stay flat) as volume grows');
    previousGap = gap;
  }
  assert.ok(previousGap < 0.01, 'blended rate should be within a cent of the floor at very high volume');
});

test('calculatePricing never bills a fraction of a unit or more than the plan limit', () => {
  const p = calculatePricing({ branches: 2.9, users: 1e12 });
  assert.equal(p.branchCount, 2);
  assert.equal(p.userCount, 2000);
});

test('monthlyTotal always equals branches * blendedRate + users * blendedRate', () => {
  for (const branches of [1, 3, 7, 10, 25]) {
    for (const users of [1, 5, 12, 20, 60]) {
      const p = calculatePricing({ branches, users });
      const expected = Math.round((branches * p.branchBlendedRate + users * p.userBlendedRate) * 100) / 100;
      assert.equal(p.monthlyTotal, expected, `branches=${branches} users=${users}`);
    }
  }
});

test('zero counts do not divide by zero and total is zero', () => {
  const p = calculatePricing({ branches: 0, users: 0 });
  assert.equal(p.monthlyTotal, 0);
  assert.equal(p.branchBlendedRate, RATE_SCHEDULE.branch.first);
  assert.equal(p.userBlendedRate, RATE_SCHEDULE.user.first);
});

test('negative or non-numeric input is clamped to zero, not NaN', () => {
  const p = calculatePricing({ branches: -5, users: 'not-a-number' });
  assert.equal(p.branchCount, 0);
  assert.equal(p.userCount, 0);
  assert.equal(p.monthlyTotal, 0);
});

test('blendedRate matches calculatePricing for the same schedule', () => {
  const p = calculatePricing({ branches: 4, users: 4 });
  assert.equal(blendedRate(4, RATE_SCHEDULE.branch), p.branchBlendedRate);
});
