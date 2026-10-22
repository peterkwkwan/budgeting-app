import assert from 'node:assert/strict';
import { test } from 'node:test';

import { formatUsd } from './money.ts';

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
