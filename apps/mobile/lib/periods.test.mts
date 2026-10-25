import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  currentPeriodFocus,
  formatCompactDate,
  formatTrendBucketLabel,
  periodModeLabel,
  resolvePeriodBounds,
  resolveTrendBounds,
  shiftPeriodFocus,
  TREND_MONTHLY_POINTS,
  TREND_RPC_BUCKETS,
  TREND_YEARLY_POINTS,
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

  it('trend nodes match period mode (month / year totals)', () => {
    const month = resolvePeriodBounds('month', tz, {
      focus: { year: 2026, month: 10 },
      now,
    });
    const year = resolvePeriodBounds('year', tz, {
      focus: { year: 2026, month: 10 },
      now,
    });
    assert.equal(
      trendBucketForPeriod(month.start, month.end, 'month'),
      'month'
    );
    assert.equal(
      trendBucketForPeriod(year.start, year.end, 'year'),
      'year'
    );
    // Yearly must send a bucket the Supabase RPC allow-list accepts.
    assert.ok(
      (TREND_RPC_BUCKETS as readonly string[]).includes(
        trendBucketForPeriod(year.start, year.end, 'year')
      )
    );
    assert.deepEqual([...TREND_RPC_BUCKETS], [
      'day',
      'week',
      'month',
      'year',
    ]);

    // Period (custom): ≤45 → day, ≤183 → week, else → month
    const shortStart = new Date('2026-01-01T18:00:00.000Z');
    const shortEnd = new Date('2026-01-20T18:00:00.000Z');
    const short = resolvePeriodBounds('custom', tz, {
      customStart: shortStart,
      customEndInclusive: shortEnd,
      now,
    });
    assert.equal(
      trendBucketForPeriod(short.start, short.end, 'custom'),
      'day'
    );

    const midStart = new Date('2026-01-01T18:00:00.000Z');
    const midEnd = new Date('2026-04-30T18:00:00.000Z');
    const mid = resolvePeriodBounds('custom', tz, {
      customStart: midStart,
      customEndInclusive: midEnd,
      now,
    });
    assert.equal(
      trendBucketForPeriod(mid.start, mid.end, 'custom'),
      'week'
    );

    const longStart = new Date('2026-01-01T18:00:00.000Z');
    const longEnd = new Date('2026-12-31T18:00:00.000Z');
    const long = resolvePeriodBounds('custom', tz, {
      customStart: longStart,
      customEndInclusive: longEnd,
      now,
    });
    assert.equal(
      trendBucketForPeriod(long.start, long.end, 'custom'),
      'month'
    );
  });

  it('Trend widens Monthly/Yearly so multiple period nodes can plot', () => {
    const focus = { year: 2026, month: 10 };
    const month = resolvePeriodBounds('month', tz, { focus, now });
    const monthTrend = resolveTrendBounds(month, tz, { focus });
    assert.equal(monthTrend.end.getTime(), month.end.getTime());
    const expectedMonthStart = resolvePeriodBounds('month', tz, {
      focus: shiftPeriodFocus(focus, 'month', -(TREND_MONTHLY_POINTS - 1)),
      now,
    }).start;
    assert.equal(monthTrend.start.getTime(), expectedMonthStart.getTime());

    const year = resolvePeriodBounds('year', tz, { focus, now });
    const yearTrend = resolveTrendBounds(year, tz, { focus });
    assert.equal(yearTrend.end.getTime(), year.end.getTime());
    const expectedYearStart = resolvePeriodBounds('year', tz, {
      focus: shiftPeriodFocus(focus, 'year', -(TREND_YEARLY_POINTS - 1)),
      now,
    }).start;
    assert.equal(yearTrend.start.getTime(), expectedYearStart.getTime());

    const customStart = new Date('2026-03-01T18:00:00.000Z');
    const customEnd = new Date('2026-06-15T18:00:00.000Z');
    const custom = resolvePeriodBounds('custom', tz, {
      customStart,
      customEndInclusive: customEnd,
      now,
    });
    const customTrend = resolveTrendBounds(custom, tz);
    assert.equal(customTrend.start.getTime(), custom.start.getTime());
    assert.equal(customTrend.end.getTime(), custom.end.getTime());
  });

  it('formats trend bucket X labels', () => {
    const iso = '2026-10-01T07:00:00.000Z';
    assert.match(formatTrendBucketLabel(iso, 'day', tz), /Oct/);
    assert.match(formatTrendBucketLabel(iso, 'week', tz), /Oct/);
    assert.match(formatTrendBucketLabel(iso, 'month', tz), /Oct/);
    assert.match(formatTrendBucketLabel(iso, 'month', tz), /26/);
    assert.equal(formatTrendBucketLabel(iso, 'year', tz), '2026');
  });
});
