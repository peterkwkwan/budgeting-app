import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { formatDisplayDate } from './dates.ts';

describe('formatDisplayDate', () => {
  it('uses the short weekday (Thu, not Thursday)', () => {
    // 2026-10-29 is Thursday. Noon UTC stays that civil day in UTC.
    const label = formatDisplayDate('2026-10-29T12:00:00.000Z', 'UTC');
    const expected = new Date('2026-10-29T12:00:00.000Z').toLocaleDateString(
      undefined,
      {
        timeZone: 'UTC',
        weekday: 'short',
        month: 'long',
        day: 'numeric',
      }
    );
    assert.equal(label, expected);
    assert.equal(label.includes('Thursday'), false);
    assert.match(label, /Thu/);
  });
});
