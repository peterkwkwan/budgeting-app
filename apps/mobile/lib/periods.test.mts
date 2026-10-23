import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  currentPeriodFocus,
  formatCompactDate,
  formatTrendBucketLabel,
  periodModeLabel,
  resolvePeriodBounds,
  shiftPeriodFocus,
  trendBucketForPeriod,
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

  it('Yearly uses the focused year and steps into future years', () => {
    const focus = { year: 2026, month: 10 };
    const bounds = resolvePeriodBounds('year', tz, { focus, now });
    assert.equal(bounds.navLabel, '2026');
    assert.deepEqual(shiftPeriodFocus(focus, 'year', -1), {
      year: 2025,
      month: 10,
    });
    assert.deepEqual(shiftPeriodFocus(focus, 'year', 1), {
      year: 2027,
      month: 10,
    });
  });

  it('Monthly next may advance into future months', () => {
    const focus = { year: 2026, month: 10 };
    assert.deepEqual(shiftPeriodFocus(focus, 'month', 1), {
      year: 2026,
      month: 11,
    });
    const future = resolvePeriodBounds('month', tz, {
      focus: { year: 2026, month: 11 },
      now,
    });
    assert.equal(future.navLabel, 'November');
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

  it('Trend buckets follow period mode (not range length)', () => {
    assert.equal(trendBucketForPeriod('month'), 'month');
    assert.equal(trendBucketForPeriod('year'), 'year');
    assert.equal(trendBucketForPeriod('custom'), 'month');

    // Short custom ranges still use month buckets (no day/week smart split).
    const shortStart = new Date('2026-01-01T18:00:00.000Z');
    const shortEnd = new Date('2026-01-20T18:00:00.000Z');
    const short = resolvePeriodBounds('custom', tz, {
      customStart: shortStart,
      customEndInclusive: shortEnd,
      now,
    });
    assert.equal(short.preset, 'custom');
    assert.equal(trendBucketForPeriod(short.preset), 'month');
  });

  it('formats trend bucket X labels', () => {
    const iso = '2026-10-01T07:00:00.000Z';
    assert.match(formatTrendBucketLabel(iso, 'day', tz), /Oct/);
    assert.match(formatTrendBucketLabel(iso, 'week', tz), /Oct/);
    assert.equal(formatTrendBucketLabel(iso, 'month', tz), 'Oct');
    assert.equal(formatTrendBucketLabel(iso, 'year', tz), '2026');
  });
});
