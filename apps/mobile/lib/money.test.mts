import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  formatAmountInput,
  formatAmountInputFromNumber,
  formatCompactMoney,
  formatCompactUsd,
  formatMoney,
  formatUsd,
  niceAxisTicks,
  parseAmountInput,
  parseMoneyInput,
} from './money.ts';

test('adds thousands commas and keeps two decimals', () => {
  assert.equal(formatUsd(12.5), '$12.50');
  assert.equal(formatUsd(1200), '$1,200.00');
  assert.equal(formatUsd(5000), '$5,000.00');
  assert.equal(formatUsd(10000), '$10,000.00');
  assert.equal(formatUsd(1000000.5), '$1,000,000.50');
  assert.equal(formatUsd(999.99), '$999.99');
  assert.equal(formatUsd(0), '$0.00');
});

test('formatMoney uses account currency symbols', () => {
  assert.equal(formatMoney(12.5, 'HKD'), 'HK$12.50');
  assert.equal(formatMoney(1200, 'JPY'), '¥1,200');
  assert.equal(formatMoney(99.5, 'EUR'), '€99.50');
});

test('formatCompactUsd abbreviates axis ticks', () => {
  assert.equal(formatCompactUsd(0), '$0');
  assert.equal(formatCompactUsd(42), '$42');
  assert.equal(formatCompactUsd(999), '$999');
  assert.equal(formatCompactUsd(250_000), '$250k');
  assert.equal(formatCompactUsd(1500), '$1.5k');
  assert.equal(formatCompactUsd(1_000_000), '$1.0M');
  assert.equal(formatCompactUsd(1_079_462.49), '$1.1M');
  assert.equal(formatCompactUsd(-250_000), '-$250k');
});

test('formatCompactMoney respects currency symbol', () => {
  assert.equal(formatCompactMoney(250_000, 'HKD'), 'HK$250k');
});

test('niceAxisTicks returns 3–4 values spanning the range', () => {
  const ticks = niceAxisTicks(0, 1_000_000, 4);
  assert.ok(ticks.length >= 3 && ticks.length <= 4);
  assert.ok(ticks[0]! <= 0);
  assert.ok(ticks[ticks.length - 1]! >= 1_000_000);
});

test('drops the sign so callers can prefix − or +', () => {
  assert.equal(formatUsd(-10000), '$10,000.00');
});

test('parseMoneyInput strips commas and currency junk', () => {
  assert.equal(parseMoneyInput('557,269'), 557269);
  assert.equal(parseAmountInput('$1,200.50'), 1200.5);
  assert.equal(parseMoneyInput('  USD 4,000  '), 4000);
  assert.equal(parseMoneyInput('4'), 4);
  assert.equal(parseMoneyInput('0'), 0);
  assert.ok(Number.isNaN(parseMoneyInput('')));
  assert.ok(Number.isNaN(parseMoneyInput('   ')));
  assert.ok(Number.isNaN(parseMoneyInput('abc')));
});

test('formatAmountInput adds commas while typing', () => {
  assert.equal(formatAmountInput(''), '');
  assert.equal(formatAmountInput('5'), '5');
  assert.equal(formatAmountInput('5000'), '5,000');
  assert.equal(formatAmountInput('500000'), '500,000');
  assert.equal(formatAmountInput('500,000'), '500,000');
  assert.equal(formatAmountInput('1234.5'), '1,234.5');
  assert.equal(formatAmountInput('1234.56'), '1,234.56');
  assert.equal(formatAmountInput('1234.567'), '1,234.56'); // max 2 dp
  assert.equal(formatAmountInput('1,234.'), '1,234.');
  assert.equal(formatAmountInput('.5'), '0.5');
});

test('formatAmountInputFromNumber seeds edit fields', () => {
  assert.equal(formatAmountInputFromNumber(500000), '500,000');
  assert.equal(formatAmountInputFromNumber(12.5), '12.5');
  assert.equal(formatAmountInputFromNumber(0), '0');
});
