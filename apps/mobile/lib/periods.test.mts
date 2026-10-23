import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  canShiftPeriodFocusForward,
  currentPeriodFocus,
  formatCompactDate,
  periodModeLabel,
  resolvePeriodBounds,
  shiftPeriodFocus,
} from './periods.ts';

describe('periods', () => {
  const tz = 'America/Los_Angeles';
  // Fixed instant: 2026-10-23 afternoon UTC ≈ still Oct 23 in LA
  const now = new Date('2026-10-23T20:00:00.000Z');

  it('defaults Monthly to the focused calendar month', () => {
    const focus = currentPeriodFocus(tz, now);
    assert.deepEqual(focus, { year: 2026, month: 10 });
    const bounds = resolvePeriodBounds('month', tz, { focus, now });
    assert.equal(bounds.preset, 'month');
    assert.equal(bounds.navLabel, 'October');
    assert.ok(bounds.start < bounds.end);
  });

  it('includes year in Monthly nav when focus crosses year boundary', () => {
    const bounds = resolvePeriodBounds('month', tz, {
      focus: { year: 2025, month: 12 },
      now,
    });
    assert.equal(bounds.navLabel, 'December 2025');
  });

  it('Yearly uses the focused year and steps with shiftPeriodFocus', () => {
    const focus = { year: 2026, month: 10 };
    const bounds = resolvePeriodBounds('year', tz, { focus, now });
    assert.equal(bounds.navLabel, '2026');
    assert.deepEqual(shiftPeriodFocus(focus, 'year', -1), {
      year: 2025,
      month: 10,
    });
    assert.equal(
      canShiftPeriodFocusForward(focus, 'year', tz, now),
      false
    );
    assert.equal(
      canShiftPeriodFocusForward({ year: 2025, month: 1 }, 'year', tz, now),
      true
    );
  });

  it('Period (custom) formats compact dates and range bounds', () => {
    // Midday UTC so civil dates stay on the intended day in LA.
    const start = new Date('2026-01-01T18:00:00.000Z');
    const end = new Date('2026-12-31T18:00:00.000Z');
    const bounds = resolvePeriodBounds('custom', tz, {
      customStart: start,
      customEndInclusive: end,
      now,
    });
    assert.equal(bounds.preset, 'custom');
    assert.equal(formatCompactDate(start, tz), '1/1/26');
    assert.equal(formatCompactDate(end, tz), '12/31/26');
    assert.equal(periodModeLabel('custom'), 'Period');
    assert.ok(bounds.label.length > 0);
  });

  it('shifts months across year boundaries', () => {
    assert.deepEqual(
      shiftPeriodFocus({ year: 2026, month: 1 }, 'month', -1),
      { year: 2025, month: 12 }
    );
    assert.deepEqual(
      shiftPeriodFocus({ year: 2025, month: 12 }, 'month', 1),
      { year: 2026, month: 1 }
    );
  });
});
