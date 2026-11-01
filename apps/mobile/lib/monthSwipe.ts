/**
 * Stats month swipe.
 * Left (negative X) moves forward one month; right moves back one month.
 * Shorter drags do not change the month.
 */
export const MONTH_SWIPE_DISTANCE_PX = 48;

/**
 * Horizontal travel before the pan claims the touch, so taps and short
 * nudges still reach buttons inside the stats scroll view.
 */
export const MONTH_SWIPE_ACTIVATION_PX = 24;

/**
 * Vertical travel that gives the gesture back to the stats scroll view
 * when the finger moves up or down before the horizontal pan activates.
 */
export const MONTH_SWIPE_FAIL_Y_PX = 16;

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
