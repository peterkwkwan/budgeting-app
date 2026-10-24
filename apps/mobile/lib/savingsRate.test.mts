import assert from 'node:assert/strict';
import { test } from 'node:test';

import { savingsRate, savingsRatePercent } from './savingsRate.ts';

test('savingsRate is (income − expenses) / income', () => {
  assert.equal(savingsRate(6660, 4180), (6660 - 4180) / 6660);
  assert.equal(savingsRate(1000, 0), 1);
  assert.equal(savingsRate(1000, 1000), 0);
  assert.equal(savingsRate(1000, 1500), -0.5);
});

test('savingsRate is null when income is 0', () => {
  assert.equal(savingsRate(0, 0), null);
  assert.equal(savingsRate(0, 100), null);
  assert.equal(savingsRate(-10, 50), null);
});

test('savingsRatePercent rounds to whole percent', () => {
  assert.equal(savingsRatePercent(6660, 4180), 37);
  assert.equal(savingsRatePercent(0, 100), null);
});
