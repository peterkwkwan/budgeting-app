import type { RecurringCadence } from '@/lib/recurring';

/** 0=Sunday … 6=Saturday (JS / generator civil weekday). */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type RepeatPresetId =
  | 'none'
  | 'daily'
  | 'weekdays'
  | 'weekends'
  | 'weekly'
  | 'monthly'
  | 'yearly';

export type RepeatPreset = {
  id: RepeatPresetId;
  label: string;
  /** null = does not repeat (one-off transaction). */
  cadence: RecurringCadence | null;
  byweekday: Weekday[] | null;
};

/**
 * Add-transaction Repeat sheet options.
 * Maps onto existing D/W/M/Y + optional byweekday — no interval-2 / custom RRULE.
 */
export const REPEAT_PRESETS: readonly RepeatPreset[] = [
  {
    id: 'none',
    label: 'Does not repeat',
    cadence: null,
    byweekday: null,
  },
  {
    id: 'daily',
    label: 'Every day',
    cadence: 'daily',
    byweekday: null,
  },
  {
    id: 'weekdays',
    label: 'Weekdays (Mon–Fri)',
    cadence: 'daily',
    byweekday: [1, 2, 3, 4, 5],
  },
  {
    id: 'weekends',
    label: 'Weekends (Sat–Sun)',
    cadence: 'daily',
    byweekday: [0, 6],
  },
  {
    id: 'weekly',
    label: 'Every week',
    cadence: 'weekly',
    byweekday: null,
  },
  {
    id: 'monthly',
    label: 'Every month',
    cadence: 'monthly',
    byweekday: null,
  },
  {
    id: 'yearly',
    label: 'Every year',
    cadence: 'yearly',
    byweekday: null,
  },
] as const;

export function presetById(id: RepeatPresetId): RepeatPreset {
  return REPEAT_PRESETS.find((p) => p.id === id) ?? REPEAT_PRESETS[0];
}

export function shortRepeatLabel(preset: RepeatPreset): string {
  switch (preset.id) {
    case 'none':
      return 'Never';
    case 'daily':
      return 'Daily';
    case 'weekdays':
      return 'Weekdays';
    case 'weekends':
      return 'Weekends';
    case 'weekly':
      return 'Weekly';
    case 'monthly':
      return 'Monthly';
    case 'yearly':
      return 'Yearly';
  }
}

/** Human label for a saved series (list rows). */
export function seriesRepeatLabel(
  cadence: RecurringCadence,
  byweekday: number[] | null | undefined
): string {
  const sorted = [...(byweekday ?? [])].sort((a, b) => a - b).join(',');
  if (cadence === 'daily' && sorted === '1,2,3,4,5') return 'Weekdays';
  if (cadence === 'daily' && sorted === '0,6') return 'Weekends';
  switch (cadence) {
    case 'daily':
      return 'Daily';
    case 'weekly':
      return 'Weekly';
    case 'monthly':
      return 'Monthly';
    case 'yearly':
      return 'Yearly';
  }
}
