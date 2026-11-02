import assert from 'node:assert/strict';
import { test } from 'node:test';

import { adjacentMonthFocuses, nearbyMonthFocuses } from './monthSwipe.ts';
import { resolvePeriodBounds } from './periods.ts';

/**
 * Adjacent prefetch must target different period bounds than the focused month
 * so React Query keys for totals/categories do not collide.
 */
test('adjacent months resolve distinct period bounds', () => {
  const focus = { year: 2026, month: 11 };
  const timeZone = 'UTC';
  const { prev, next } = adjacentMonthFocuses(focus);

  const current = resolvePeriodBounds('month', timeZone, { focus });
  const prevPeriod = resolvePeriodBounds('month', timeZone, { focus: prev });
  const nextPeriod = resolvePeriodBounds('month', timeZone, { focus: next });

  assert.notEqual(
    current.start.toISOString(),
    prevPeriod.start.toISOString()
  );
  assert.notEqual(
    current.start.toISOString(),
    nextPeriod.start.toISOString()
  );
  assert.notEqual(
    current.end.toISOString(),
    nextPeriod.end.toISOString()
  );
  assert.equal(prevPeriod.end.toISOString(), current.start.toISOString());
  assert.equal(current.end.toISOString(), nextPeriod.start.toISOString());
});

test('nearby ±2 months resolve distinct contiguous bounds', () => {
  const focus = { year: 2026, month: 11 };
  const timeZone = 'UTC';
  const nearby = nearbyMonthFocuses(focus);
  assert.equal(nearby.length, 4);

  const starts = new Set(
    nearby.map(
      (m) =>
        resolvePeriodBounds('month', timeZone, { focus: m }).start.toISOString()
    )
  );
  assert.equal(starts.size, 4);

  const mMinus2 = resolvePeriodBounds('month', timeZone, {
    focus: nearby[0]!,
  });
  const mMinus1 = resolvePeriodBounds('month', timeZone, {
    focus: nearby[1]!,
  });
  assert.equal(mMinus2.end.toISOString(), mMinus1.start.toISOString());
});
