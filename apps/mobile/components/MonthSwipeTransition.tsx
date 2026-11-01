import { useRef, type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  FadeInLeft,
  FadeInRight,
  FadeOutLeft,
  FadeOutRight,
} from 'react-native-reanimated';

import {
  MONTH_SWIPE_TRANSITION_MS,
  monthContentKey,
  monthStepDirection,
} from '@/lib/monthSwipe';

type YearMonth = { year: number; month: number };

type MonthSwipeTransitionProps = {
  /** Focused calendar month — remounts content when year/month changes. */
  focus: YearMonth;
  /**
   * When false, keep a stable key so year/custom period steps do not
   * run the month transition.
   */
  active?: boolean;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
};

const easeOut = Easing.out(Easing.cubic);

/**
 * Subtle directional fade/slide when the focused month changes.
 * Forward (next month) enters from the right; back enters from the left.
 */
export function MonthSwipeTransition({
  focus,
  active = true,
  style,
  children,
}: MonthSwipeTransitionProps) {
  const prevFocusRef = useRef(focus);
  const directionRef = useRef<-1 | 1>(1);

  if (
    active &&
    (prevFocusRef.current.year !== focus.year ||
      prevFocusRef.current.month !== focus.month)
  ) {
    const step = monthStepDirection(prevFocusRef.current, focus);
    if (step !== 0) directionRef.current = step;
    prevFocusRef.current = focus;
  } else if (!active) {
    prevFocusRef.current = focus;
  }

  const contentKey = active ? monthContentKey(focus) : 'month-swipe-idle';
  const forward = directionRef.current > 0;

  return (
    <View style={[styles.clip, style]}>
      <Animated.View
        key={contentKey}
        entering={(forward ? FadeInRight : FadeInLeft)
          .duration(MONTH_SWIPE_TRANSITION_MS)
          .easing(easeOut)}
        exiting={(forward ? FadeOutLeft : FadeOutRight)
          .duration(MONTH_SWIPE_TRANSITION_MS)
          .easing(easeOut)}
        style={styles.fill}
      >
        {children}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  clip: {
    flex: 1,
    overflow: 'hidden',
  },
  fill: {
    flex: 1,
  },
});
