import type { RecurringCadence } from '@/lib/recurring';

/** 0=Sunday … 6=Saturday (JS / generator civil weekday). */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type EndsMode = 'never' | 'on_date' | 'after_count';

/** Rule payload created from a preset or Custom sheet. */
export type RepeatRule = {
  cadence: RecurringCadence;
  byweekday: Weekday[] | null;
  endsMode: EndsMode;
  /** Inclusive end date as YYYY-MM-DD (local), when endsMode = on_date. */
  endsOn: string | null;
  endsAfterCount: number | null;
};

export type RepeatPresetId =
  | 'none'
  | 'daily'
  | 'weekly'
  | 'monthly'
  | 'yearly'
  | 'weekdays'
  | 'custom';

export type RepeatPresetOption = {
  id: RepeatPresetId;
  label: string;
  /** null = does not repeat. custom opens the Custom sheet. */
  rule: RepeatRule | null | 'custom';
};

const WEEKDAY_LONG = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

const MONTH_LONG = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

export function weekdayOfDate(date: Date, timeZone: string): Weekday {
  try {
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone,
      weekday: 'short',
    });
    const w = fmt.format(date);
    const map: Record<string, Weekday> = {
      Sun: 0,
      Mon: 1,
      Tue: 2,
      Wed: 3,
      Thu: 4,
      Fri: 5,
      Sat: 6,
    };
    return map[w] ?? (date.getDay() as Weekday);
  } catch {
    return date.getDay() as Weekday;
  }
}

function dayOfMonth(date: Date, timeZone: string): number {
  try {
    return Number(
      new Intl.DateTimeFormat('en-US', {
        timeZone,
        day: 'numeric',
      }).format(date)
    );
  } catch {
    return date.getDate();
  }
}

function monthIndex(date: Date, timeZone: string): number {
  try {
    const m = new Intl.DateTimeFormat('en-US', {
      timeZone,
      month: 'numeric',
    }).format(date);
    return Number(m);
  } catch {
    return date.getMonth() + 1;
  }
}

function neverEnds(): Pick<RepeatRule, 'endsMode' | 'endsOn' | 'endsAfterCount'> {
  return { endsMode: 'never', endsOn: null, endsAfterCount: null };
}

/**
 * Google-like preset list driven by the transaction / start date.
 * Monthly ordinal (“4th Thursday”) deferred — use day-of-month instead.
 */
export function buildRepeatPresetOptions(
  startDate: Date,
  timeZone: string
): RepeatPresetOption[] {
  const dow = weekdayOfDate(startDate, timeZone);
  const day = dayOfMonth(startDate, timeZone);
  const month = monthIndex(startDate, timeZone);
  const weekdayName = WEEKDAY_LONG[dow];
  const monthName = MONTH_LONG[month - 1];

  return [
    {
      id: 'none',
      label: 'Does not repeat',
      rule: null,
    },
    {
      id: 'daily',
      label: 'Daily',
      rule: {
        cadence: 'daily',
        byweekday: null,
        ...neverEnds(),
      },
    },
    {
      id: 'weekly',
      label: `Weekly on ${weekdayName}`,
      rule: {
        cadence: 'weekly',
        byweekday: [dow],
        ...neverEnds(),
      },
    },
    {
      id: 'monthly',
      label: `Monthly on day ${day}`,
      rule: {
        cadence: 'monthly',
        byweekday: null,
        ...neverEnds(),
      },
    },
    {
      id: 'yearly',
      label: `Annually on ${monthName} ${day}`,
      rule: {
        cadence: 'yearly',
        byweekday: null,
        ...neverEnds(),
      },
    },
    {
      id: 'weekdays',
      label: 'Every weekday (Monday to Friday)',
      rule: {
        cadence: 'daily',
        byweekday: [1, 2, 3, 4, 5],
        ...neverEnds(),
      },
    },
    {
      id: 'custom',
      label: 'Custom…',
      rule: 'custom',
    },
  ];
}

export function shortRepeatLabel(rule: RepeatRule | null): string {
  if (!rule) return 'Never';
  const sorted = [...(rule.byweekday ?? [])].sort((a, b) => a - b).join(',');
  if (rule.cadence === 'daily' && sorted === '1,2,3,4,5') return 'Weekdays';
  if (rule.cadence === 'daily' && !rule.byweekday) return 'Daily';
  if (rule.cadence === 'weekly') {
    if (rule.byweekday?.length === 1) {
      return `Weekly · ${WEEKDAY_LONG[rule.byweekday[0]].slice(0, 3)}`;
    }
    if (rule.byweekday && rule.byweekday.length > 1) return 'Weekly';
    return 'Weekly';
  }
  if (rule.cadence === 'monthly') return 'Monthly';
  if (rule.cadence === 'yearly') return 'Annually';
  return 'Custom';
}

export function seriesRepeatLabel(
  cadence: RecurringCadence,
  byweekday: number[] | null | undefined,
  endsOn?: string | null,
  endsAfterCount?: number | null
): string {
  const sorted = [...(byweekday ?? [])].sort((a, b) => a - b).join(',');
  let base: string;
  if (cadence === 'daily' && sorted === '1,2,3,4,5') base = 'Weekdays';
  else if (cadence === 'daily' && sorted === '0,6') base = 'Weekends';
  else if (cadence === 'daily') base = 'Daily';
  else if (cadence === 'weekly' && byweekday?.length === 1) {
    base = `Weekly on ${WEEKDAY_LONG[byweekday[0] as Weekday]}`;
  } else if (cadence === 'weekly') base = 'Weekly';
  else if (cadence === 'monthly') base = 'Monthly';
  else base = 'Annually';

  if (endsOn) return `${base} · ends ${endsOn}`;
  if (endsAfterCount) return `${base} · ${endsAfterCount} times`;
  return base;
}

export function endsSummary(rule: {
  endsOn?: string | null;
  endsAfterCount?: number | null;
}): string {
  if (rule.endsOn) return `Ends on ${rule.endsOn}`;
  if (rule.endsAfterCount) return `Ends after ${rule.endsAfterCount} times`;
  return 'Does not end';
}

export const WEEKDAY_CHIP_LABELS: { day: Weekday; label: string }[] = [
  { day: 0, label: 'S' },
  { day: 1, label: 'M' },
  { day: 2, label: 'T' },
  { day: 3, label: 'W' },
  { day: 4, label: 'T' },
  { day: 5, label: 'F' },
  { day: 6, label: 'S' },
];
