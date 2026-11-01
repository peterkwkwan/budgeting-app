import assert from 'node:assert/strict';
import { test } from 'node:test';

import { colors } from '../constants/theme.ts';
import {
  savingsRate,
  savingsRateColor,
  savingsRatePercent,
} from './savingsRate.ts';

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

test('savingsRateColor uses one income green and one expense rust', () => {
  assert.equal(savingsRateColor(null), colors.inkMuted);
  assert.equal(savingsRateColor(0), colors.inkMuted);
  assert.equal(savingsRateColor(9), colors.income);
  assert.equal(savingsRateColor(25), colors.income);
  assert.equal(savingsRateColor(50), colors.income);
  assert.equal(savingsRateColor(120), colors.income);
  assert.equal(savingsRateColor(-9), colors.expense);
  assert.equal(savingsRateColor(-25), colors.expense);
  assert.equal(savingsRateColor(-50), colors.expense);
  assert.equal(savingsRateColor(-200), colors.expense);
  assert.notEqual(savingsRateColor(9), savingsRateColor(-9));
});
