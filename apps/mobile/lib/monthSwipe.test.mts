import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  MONTH_CARD_SNAP_RATIO,
  MONTH_CARD_VELOCITY_PX,
  MONTH_NEIGHBOR_LOCK_MS,
  MONTH_PREFETCH_OFFSETS,
  MONTH_SWIPE_DISTANCE_PX,
  adjacentMonthFocuses,
  monthContentKey,
  monthStepDirection,
  monthStepFromCardSwipe,
  monthStepFromSwipe,
  nearbyMonthFocuses,
  shiftYearMonth,
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

test('adjacentMonthFocuses returns prev and next', () => {
  assert.deepEqual(adjacentMonthFocuses({ year: 2026, month: 11 }), {
    prev: { year: 2026, month: 10 },
    next: { year: 2026, month: 12 },
  });
  assert.deepEqual(adjacentMonthFocuses({ year: 2026, month: 1 }), {
    prev: { year: 2025, month: 12 },
    next: { year: 2026, month: 2 },
  });
});

test('nearbyMonthFocuses covers ±2 for rapid-swipe prefetch', () => {
  assert.deepEqual(MONTH_PREFETCH_OFFSETS, [-2, -1, 1, 2]);
  assert.ok(MONTH_NEIGHBOR_LOCK_MS > 0);
  assert.deepEqual(nearbyMonthFocuses({ year: 2026, month: 11 }), [
    { year: 2026, month: 9 },
    { year: 2026, month: 10 },
    { year: 2026, month: 12 },
    { year: 2027, month: 1 },
  ]);
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

test('card swipe commits past the width snap ratio', () => {
  const width = 400;
  const threshold = width * MONTH_CARD_SNAP_RATIO;
  assert.equal(monthStepFromCardSwipe(-(threshold + 1), 0, width), 1);
  assert.equal(monthStepFromCardSwipe(threshold + 1, 0, width), -1);
  assert.equal(monthStepFromCardSwipe(-(threshold - 1), 0, width), 0);
  assert.equal(monthStepFromCardSwipe(threshold - 1, 0, width), 0);
});

test('card swipe commits on a flick even with a short drag', () => {
  const width = 400;
  assert.equal(
    monthStepFromCardSwipe(-10, -(MONTH_CARD_VELOCITY_PX + 1), width),
    1
  );
  assert.equal(
    monthStepFromCardSwipe(10, MONTH_CARD_VELOCITY_PX + 1, width),
    -1
  );
});

test('card swipe ignores bad width or ratio', () => {
  assert.equal(monthStepFromCardSwipe(-200, 0, 0), 0);
  assert.equal(monthStepFromCardSwipe(-200, 0, Number.NaN), 0);
  assert.equal(monthStepFromCardSwipe(-200, 0, 400, 0), 0);
  assert.equal(monthStepFromCardSwipe(-200, 0, 400, 1), 0);
});

test('shiftYearMonth steps across year boundaries', () => {
  assert.deepEqual(shiftYearMonth({ year: 2026, month: 11 }, 1), {
    year: 2026,
    month: 12,
  });
  assert.deepEqual(shiftYearMonth({ year: 2026, month: 12 }, 1), {
    year: 2027,
    month: 1,
  });
  assert.deepEqual(shiftYearMonth({ year: 2026, month: 1 }, -1), {
    year: 2025,
    month: 12,
  });
  assert.deepEqual(shiftYearMonth({ year: 2026, month: 6 }, 0), {
    year: 2026,
    month: 6,
  });
});
