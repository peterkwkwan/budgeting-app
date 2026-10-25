import assert from 'node:assert/strict';
import { test } from 'node:test';

import { formatFxRateInput } from './fx.ts';

test('formatFxRateInput trims trailing zeros', () => {
  assert.equal(formatFxRateInput(1), '1');
  assert.equal(formatFxRateInput(7.8), '7.8');
  assert.equal(formatFxRateInput(0.000123456789), '0.00012346');
  assert.equal(formatFxRateInput(0), '');
  assert.equal(formatFxRateInput(-1), '');
});
