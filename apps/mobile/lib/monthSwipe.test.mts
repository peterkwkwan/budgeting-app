import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  MONTH_SWIPE_DISTANCE_PX,
  monthContentKey,
  monthStepDirection,
  monthStepFromSwipe,
} from './monthSwipe.ts';

test('swipe left moves forward one month', () => {
  assert.equal(monthStepFromSwipe(-MONTH_SWIPE_DISTANCE_PX), 1);
  assert.equal(monthStepFromSwipe(-120), 1);
});

test('swipe right moves back one month', () => {
  assert.equal(monthStepFromSwipe(MONTH_SWIPE_DISTANCE_PX), -1);
  assert.equal(monthStepFromSwipe(120), -1);
});

test('a short drag does not change the month', () => {
  assert.equal(monthStepFromSwipe(0), 0);
  assert.equal(monthStepFromSwipe(MONTH_SWIPE_DISTANCE_PX - 1), 0);
  assert.equal(monthStepFromSwipe(-(MONTH_SWIPE_DISTANCE_PX - 1)), 0);
});

test('non-finite movement does not change the month', () => {
  assert.equal(monthStepFromSwipe(Number.NaN), 0);
  assert.equal(monthStepFromSwipe(Number.POSITIVE_INFINITY), 0);
  assert.equal(monthStepFromSwipe(-10, 0), 0);
});

test('monthContentKey is year-month', () => {
  assert.equal(monthContentKey({ year: 2026, month: 11 }), '2026-11');
});

test('monthStepDirection compares calendar months', () => {
  assert.equal(
    monthStepDirection({ year: 2026, month: 10 }, { year: 2026, month: 11 }),
    1
  );
  assert.equal(
    monthStepDirection({ year: 2026, month: 11 }, { year: 2026, month: 10 }),
    -1
  );
  assert.equal(
    monthStepDirection({ year: 2025, month: 12 }, { year: 2026, month: 1 }),
    1
  );
  assert.equal(
    monthStepDirection({ year: 2026, month: 1 }, { year: 2025, month: 12 }),
    -1
  );
  assert.equal(
    monthStepDirection({ year: 2026, month: 5 }, { year: 2026, month: 5 }),
    0
  );
});
