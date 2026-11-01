import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { formatDisplayDate } from './dates.ts';
import {
  nextOccurrenceLabel,
  nextOccurrenceYmd,
  type NextOccurrenceInput,
} from './nextOccurrence.ts';

function series(
  overrides: Partial<NextOccurrenceInput> &
    Pick<NextOccurrenceInput, 'cadence' | 'anchor_at'>
): NextOccurrenceInput {
  return {
    byweekday: null,
    timezone: 'UTC',
    ends_on: null,
    ends_after_count: null,
    ...overrides,
  };
}

describe('nextOccurrenceYmd', () => {
  it('includes today when a monthly rule occurs today', () => {
    const ymd = nextOccurrenceYmd(
      series({
        cadence: 'monthly',
        anchor_at: '2024-03-01T08:00:00.000Z',
      }),
      new Date('2026-11-01T12:00:00.000Z')
    );
    assert.equal(ymd, '2026-11-01');
  });

  it('moves a monthly rule to next month after its day has passed', () => {
    const ymd = nextOccurrenceYmd(
      series({
        cadence: 'monthly',
        anchor_at: '2024-03-01T08:00:00.000Z',
      }),
      new Date('2026-11-02T12:00:00.000Z')
    );
    assert.equal(ymd, '2026-12-01');
  });

  it('clamps a 31st monthly rule to the last day of a short month', () => {
    const ymd = nextOccurrenceYmd(
      series({
        cadence: 'monthly',
        anchor_at: '2026-01-31T12:00:00.000Z',
      }),
      new Date('2026-02-01T12:00:00.000Z')
    );
    assert.equal(ymd, '2026-02-28');
  });

  it('keeps a future anchor as the next date', () => {
    const ymd = nextOccurrenceYmd(
      series({
        cadence: 'monthly',
        anchor_at: '2026-12-15T12:00:00.000Z',
      }),
      new Date('2026-11-01T12:00:00.000Z')
    );
    assert.equal(ymd, '2026-12-15');
  });

  it('uses the series timezone for the civil day', () => {
    // 2026-10-31 16:30Z is 2026-11-01 00:30 in Hong Kong.
    const ymd = nextOccurrenceYmd(
      series({
        cadence: 'monthly',
        timezone: 'Asia/Hong_Kong',
        anchor_at: '2026-10-31T16:30:00.000Z',
      }),
      new Date('2026-11-01T16:00:00.000Z')
    );
    assert.equal(ymd, '2026-12-01');
  });

  it('finds the next weekly weekday', () => {
    // 2026-11-01 is a Sunday. Wednesday is the 4th.
    const ymd = nextOccurrenceYmd(
      series({
        cadence: 'weekly',
        byweekday: [3],
        anchor_at: '2026-10-07T12:00:00.000Z',
      }),
      new Date('2026-11-01T12:00:00.000Z')
    );
    assert.equal(ymd, '2026-11-04');
  });

  it('starts after the anchor when that weekday is not selected', () => {
    // 2026-11-01 is a Sunday, so the first weekday is Monday the 2nd.
    const ymd = nextOccurrenceYmd(
      series({
        cadence: 'daily',
        byweekday: [1, 2, 3, 4, 5],
        anchor_at: '2026-11-01T12:00:00.000Z',
      }),
      new Date('2026-10-01T12:00:00.000Z')
    );
    assert.equal(ymd, '2026-11-02');
  });

  it('skips weekend days for a weekday daily rule', () => {
    const ymd = nextOccurrenceYmd(
      series({
        cadence: 'daily',
        byweekday: [1, 2, 3, 4, 5],
        anchor_at: '2026-10-05T12:00:00.000Z',
      }),
      new Date('2026-11-01T12:00:00.000Z')
    );
    assert.equal(ymd, '2026-11-02');
  });

  it('rolls a yearly rule to next year after its day', () => {
    const ymd = nextOccurrenceYmd(
      series({
        cadence: 'yearly',
        anchor_at: '2024-11-01T12:00:00.000Z',
      }),
      new Date('2026-11-02T12:00:00.000Z')
    );
    assert.equal(ymd, '2027-11-01');
  });

  it('returns null after an inclusive end date', () => {
    const ymd = nextOccurrenceYmd(
      series({
        cadence: 'monthly',
        anchor_at: '2026-01-01T12:00:00.000Z',
        ends_on: '2026-11-01',
      }),
      new Date('2026-11-02T12:00:00.000Z')
    );
    assert.equal(ymd, null);
  });

  it('returns null when ends-after is used up', () => {
    const ymd = nextOccurrenceYmd(
      series({
        cadence: 'monthly',
        anchor_at: '2026-01-01T12:00:00.000Z',
        ends_after_count: 3,
      }),
      new Date('2026-03-02T12:00:00.000Z')
    );
    assert.equal(ymd, null);
  });

  it('returns the last remaining occurrence inside ends-after', () => {
    const ymd = nextOccurrenceYmd(
      series({
        cadence: 'monthly',
        anchor_at: '2026-01-01T12:00:00.000Z',
        ends_after_count: 3,
      }),
      new Date('2026-02-15T12:00:00.000Z')
    );
    assert.equal(ymd, '2026-03-01');
  });

  it('counts weekly days against ends-after', () => {
    // Anchor Monday 2026-11-02, also Friday. Count 3 → Mon 2, Fri 6, Mon 9.
    const ymd = nextOccurrenceYmd(
      series({
        cadence: 'weekly',
        byweekday: [1, 5],
        anchor_at: '2026-11-02T12:00:00.000Z',
        ends_after_count: 3,
      }),
      new Date('2026-11-07T12:00:00.000Z')
    );
    assert.equal(ymd, '2026-11-09');
  });

  it('returns null for an invalid anchor', () => {
    const ymd = nextOccurrenceYmd(
      series({ cadence: 'monthly', anchor_at: 'not-a-date' }),
      new Date('2026-11-01T12:00:00.000Z')
    );
    assert.equal(ymd, null);
  });
});

describe('nextOccurrenceLabel', () => {
  it('uses the short display date in the current year', () => {
    const input = series({
      cadence: 'monthly',
      anchor_at: '2024-03-01T08:00:00.000Z',
    });
    const now = new Date('2026-11-02T12:00:00.000Z');
    const label = nextOccurrenceLabel(input, now);
    assert.equal(
      label,
      formatDisplayDate('2026-12-01T12:00:00.000Z', 'UTC')
    );
  });

  it('appends the year when the next date is next year', () => {
    const input = series({
      cadence: 'yearly',
      anchor_at: '2024-11-01T12:00:00.000Z',
    });
    const now = new Date('2026-11-02T12:00:00.000Z');
    const label = nextOccurrenceLabel(input, now);
    const base = formatDisplayDate('2027-11-01T12:00:00.000Z', 'UTC');
    assert.equal(label, `${base}, 2027`);
  });
});
