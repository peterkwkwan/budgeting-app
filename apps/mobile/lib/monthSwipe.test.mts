import assert from 'node:assert/strict';
import { test } from 'node:test';

import { MONTH_SWIPE_DISTANCE_PX, monthStepFromSwipe } from './monthSwipe.ts';

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
