/**
 * Month card swipe.
 * Left (negative X) moves forward one month; right moves back one month.
 * During the drag, full prev/next month UIs slide in from the sides.
 */

/** Horizontal travel before the pan claims the touch. */
export const MONTH_SWIPE_ACTIVATION_PX = 24;

/**
 * Vertical travel that gives the gesture back to the scroll view
 * when the finger moves up or down before the horizontal pan activates.
 */
export const MONTH_SWIPE_FAIL_Y_PX = 16;

/** Fraction of pager width that commits a month change on release. */
export const MONTH_CARD_SNAP_RATIO = 0.28;

/** Flick speed (px/s) that commits a month change even on a short drag. */
export const MONTH_CARD_VELOCITY_PX = 700;

/** Snap / chevron slide length. */
export const MONTH_CARD_SNAP_MS = 240;

/**
 * After a settle, lock swipe / header month input until M±1 neighbors are
 * ready (or this timeout elapses — then skeleton is allowed).
 */
export const MONTH_NEIGHBOR_LOCK_MS = 480;

/**
 * Calendar-month offsets to prefetch around focus for rapid swipes.
 * Visible slots stay M±1; ±2 is data-only warm cache.
 */
export const MONTH_PREFETCH_OFFSETS = [-2, -1, 1, 2] as const;

/**
 * Legacy short-drag threshold (tests + older call sites).
 * Card pager uses width-based {@link monthStepFromCardSwipe} instead.
 */
export const MONTH_SWIPE_DISTANCE_PX = 48;

/** @deprecated Prefer {@link MONTH_CARD_SNAP_MS}. */
export const MONTH_SWIPE_TRANSITION_MS = MONTH_CARD_SNAP_MS;

type YearMonth = { year: number; month: number };

/** +1 next month, −1 previous month, 0 when the drag is too short. */
export function monthStepFromSwipe(
  translationX: number,
  distancePx = MONTH_SWIPE_DISTANCE_PX
): -1 | 0 | 1 {
  if (!Number.isFinite(translationX) || !(distancePx > 0)) return 0;
  if (translationX <= -distancePx) return 1;
  if (translationX >= distancePx) return -1;
  return 0;
}

/**
 * Commit helper for the card pager: distance vs pager width, or a flick.
 * +1 next month, −1 previous month, 0 snap back.
 */
export function monthStepFromCardSwipe(
  translationX: number,
  velocityX: number,
  width: number,
  snapRatio = MONTH_CARD_SNAP_RATIO,
  velocityPx = MONTH_CARD_VELOCITY_PX
): -1 | 0 | 1 {
  if (!Number.isFinite(translationX) || !Number.isFinite(width) || !(width > 0)) {
    return 0;
  }
  if (!(snapRatio > 0 && snapRatio < 1)) return 0;

  if (Number.isFinite(velocityX) && velocityPx > 0) {
    if (velocityX <= -velocityPx) return 1;
    if (velocityX >= velocityPx) return -1;
  }

  const threshold = width * snapRatio;
  if (translationX <= -threshold) return 1;
  if (translationX >= threshold) return -1;
  return 0;
}

/** Step a calendar month by ±N (month is 1–12). */
export function shiftYearMonth(focus: YearMonth, delta: number): YearMonth {
  if (!Number.isFinite(delta) || delta === 0) {
    return { year: focus.year, month: focus.month };
  }
  const idx = focus.year * 12 + (focus.month - 1) + delta;
  const year = Math.floor(idx / 12);
  const month = ((idx % 12) + 12) % 12 + 1;
  return { year, month };
}

/** Stable key for a focused calendar month (`2026-11`). */
export function monthContentKey(focus: YearMonth): string {
  return `${focus.year}-${focus.month}`;
}

/** Previous and next calendar months around `focus` (visible pager slots). */
export function adjacentMonthFocuses(focus: YearMonth): {
  prev: YearMonth;
  next: YearMonth;
} {
  return {
    prev: shiftYearMonth(focus, -1),
    next: shiftYearMonth(focus, 1),
  };
}

/** Focus months at {@link MONTH_PREFETCH_OFFSETS} (data warm for rapid swipes). */
export function nearbyMonthFocuses(focus: YearMonth): YearMonth[] {
  return MONTH_PREFETCH_OFFSETS.map((delta) => shiftYearMonth(focus, delta));
}

/**
 * Direction of a month change for content transitions.
 * +1 moved forward, −1 moved back, 0 when the month did not change.
 */
export function monthStepDirection(
  from: YearMonth,
  to: YearMonth
): -1 | 0 | 1 {
  const a = from.year * 12 + from.month;
  const b = to.year * 12 + to.month;
  if (!(Number.isFinite(a) && Number.isFinite(b)) || a === b) return 0;
  return b > a ? 1 : -1;
}
