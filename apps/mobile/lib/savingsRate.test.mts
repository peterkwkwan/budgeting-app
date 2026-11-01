import assert from 'node:assert/strict';
import { test } from 'node:test';

import { colors } from '../constants/theme.ts';
import {
  savingsRate,
  savingsRateBand,
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

test('savingsRateBand steps up at 15% and 50%', () => {
  assert.equal(savingsRateBand(null), 'neutral');
  assert.equal(savingsRateBand(0), 'neutral');
  assert.equal(savingsRateBand(9), 'light');
  assert.equal(savingsRateBand(14), 'light');
  assert.equal(savingsRateBand(15), 'mid');
  assert.equal(savingsRateBand(25), 'mid');
  assert.equal(savingsRateBand(49), 'mid');
  assert.equal(savingsRateBand(50), 'dark');
  assert.equal(savingsRateBand(80), 'dark');
  assert.equal(savingsRateBand(-9), 'light');
  assert.equal(savingsRateBand(-15), 'mid');
  assert.equal(savingsRateBand(-50), 'dark');
});

test('savingsRateColor darkens green when saving and rust when overspending', () => {
  assert.equal(savingsRateColor(null), colors.inkMuted);
  assert.equal(savingsRateColor(0), colors.inkMuted);
  assert.equal(savingsRateColor(9), '#388646');
  assert.equal(savingsRateColor(25), colors.green[700]);
  assert.equal(savingsRateColor(50), colors.green[950]);
  assert.equal(savingsRateColor(120), colors.green[950]);
  assert.equal(savingsRateColor(-9), colors.rust[500]);
  assert.equal(savingsRateColor(-25), colors.rust[700]);
  assert.equal(savingsRateColor(-50), colors.rust[950]);
  assert.equal(savingsRateColor(-200), colors.rust[950]);
  assert.notEqual(savingsRateColor(9), savingsRateColor(-9));
});
