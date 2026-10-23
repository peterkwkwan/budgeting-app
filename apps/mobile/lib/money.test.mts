import assert from 'node:assert/strict';
import { test } from 'node:test';

import { formatUsd, parseMoneyInput } from './money.ts';

test('adds thousands commas and keeps two decimals', () => {
  assert.equal(formatUsd(12.5), '$12.50');
  assert.equal(formatUsd(1200), '$1,200.00');
  assert.equal(formatUsd(5000), '$5,000.00');
  assert.equal(formatUsd(10000), '$10,000.00');
  assert.equal(formatUsd(1000000.5), '$1,000,000.50');
  assert.equal(formatUsd(999.99), '$999.99');
  assert.equal(formatUsd(0), '$0.00');
});

test('drops the sign so callers can prefix − or +', () => {
  assert.equal(formatUsd(-10000), '$10,000.00');
});

test('parseMoneyInput strips commas and currency junk', () => {
  assert.equal(parseMoneyInput('557,269'), 557269);
  assert.equal(parseMoneyInput('$1,200.50'), 1200.5);
  assert.equal(parseMoneyInput('  USD 4,000  '), 4000);
  assert.equal(parseMoneyInput('4'), 4);
  assert.equal(parseMoneyInput('0'), 0);
  assert.ok(Number.isNaN(parseMoneyInput('')));
  assert.ok(Number.isNaN(parseMoneyInput('   ')));
  assert.ok(Number.isNaN(parseMoneyInput('abc')));
});
