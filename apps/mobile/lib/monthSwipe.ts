/**
 * Month swipe.
 * Left (negative X) moves forward one month; right moves back one month.
 * Shorter drags do not change the month.
 */
export const MONTH_SWIPE_DISTANCE_PX = 48;

/**
 * Horizontal travel before the pan claims the touch, so taps and short
 * nudges still reach buttons inside the scroll view.
 */
export const MONTH_SWIPE_ACTIVATION_PX = 24;

/**
 * Vertical travel that gives the gesture back to the scroll view
 * when the finger moves up or down before the horizontal pan activates.
 */
export const MONTH_SWIPE_FAIL_Y_PX = 16;

/** Content fade/slide length when the focused month changes. */
export const MONTH_SWIPE_TRANSITION_MS = 220;

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

type YearMonth = { year: number; month: number };

/** Stable key for a focused calendar month (`2026-11`). */
export function monthContentKey(focus: YearMonth): string {
  return `${focus.year}-${focus.month}`;
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
