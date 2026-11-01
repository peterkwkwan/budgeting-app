import {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  type ReactNode,
} from 'react';
import {
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import {
  MONTH_CARD_SNAP_MS,
  MONTH_SWIPE_ACTIVATION_PX,
  MONTH_SWIPE_FAIL_Y_PX,
  monthStepDirection,
  monthStepFromCardSwipe,
  shiftYearMonth,
} from '@/lib/monthSwipe';
import type { PeriodFocus } from '@/lib/periods';

type MonthCardPagerProps = {
  /** Focused calendar month — drives prev/next peek cards. */
  focus: PeriodFocus;
  /**
   * When false, render children only (no gesture / peeks).
   * Stats uses this outside Monthly mode.
   */
  enabled: boolean;
  onStep: (delta: -1 | 1) => void;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
  /** Non-interactive peek for the adjacent month (placeholder or ready content). */
  renderAdjacent: (focus: PeriodFocus, side: 'prev' | 'next') => ReactNode;
};

const easeOut = Easing.out(Easing.cubic);

/**
 * Tinder-style horizontal month cards.
 * Drag left/right to peek the next/previous month; release to snap.
 */
export function MonthCardPager({
  focus,
  enabled,
  onStep,
  style,
  children,
  renderAdjacent,
}: MonthCardPagerProps) {
  const widthSV = useSharedValue(0);
  const translateX = useSharedValue(0);

  const ignoreFocusAnimRef = useRef(false);
  const prevFocusRef = useRef(focus);
  const onStepRef = useRef(onStep);
  onStepRef.current = onStep;

  const prevMonth = useMemo(
    () => shiftYearMonth(focus, -1),
    [focus.year, focus.month]
  );
  const nextMonth = useMemo(
    () => shiftYearMonth(focus, 1),
    [focus.year, focus.month]
  );

  const commitStep = useCallback((delta: -1 | 1) => {
    ignoreFocusAnimRef.current = true;
    onStepRef.current(delta);
  }, []);

  /**
   * Snap / commit on the JS thread (`monthStepFromCardSwipe` is not a worklet).
   * On a committed step, keep translateX at the peek offset until focus updates,
   * then reset to 0 in useLayoutEffect before paint — avoids a flash of the
   * previous month’s current card after the snap.
   */
  const settleSwipe = useCallback(
    (translationXValue: number, velocityX: number, width: number) => {
      const step = monthStepFromCardSwipe(
        translationXValue,
        velocityX,
        width
      );
      const target = step === 0 ? 0 : -step * width;
      translateX.value = withTiming(
        target,
        { duration: MONTH_CARD_SNAP_MS, easing: easeOut },
        (finished) => {
          'worklet';
          if (!finished || step === 0) return;
          runOnJS(commitStep)(step);
        }
      );
    },
    [commitStep, translateX]
  );

  const onLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const w = event.nativeEvent.layout.width;
      if (w > 0) widthSV.value = w;
    },
    [widthSV]
  );

  // Chevron / header: slide in. Card-swipe settle: recenter before paint.
  useLayoutEffect(() => {
    const from = prevFocusRef.current;
    const step = monthStepDirection(from, focus);
    prevFocusRef.current = focus;
    if (ignoreFocusAnimRef.current) {
      ignoreFocusAnimRef.current = false;
      // New month content is already mounted; show it centered before paint.
      translateX.value = 0;
      return;
    }
    if (!enabled || step === 0 || widthSV.value <= 0) return;
    translateX.value = -step * widthSV.value;
    translateX.value = withTiming(0, {
      duration: MONTH_CARD_SNAP_MS,
      easing: easeOut,
    });
  }, [enabled, focus.year, focus.month, translateX, widthSV]);

  const gesture = usePanGesture({
    enabled,
    activeOffsetX: [-MONTH_SWIPE_ACTIVATION_PX, MONTH_SWIPE_ACTIVATION_PX],
    failOffsetY: [-MONTH_SWIPE_FAIL_Y_PX, MONTH_SWIPE_FAIL_Y_PX],
    onUpdate: (event) => {
      'worklet';
      const w = widthSV.value;
      if (!(w > 0)) return;
      const next = event.translationX;
      translateX.value = Math.max(-w, Math.min(w, next));
    },
    onDeactivate: (event) => {
      'worklet';
      const w = widthSV.value;
      if (event.canceled || !(w > 0)) {
        translateX.value = withTiming(0, {
          duration: MONTH_CARD_SNAP_MS,
          easing: easeOut,
        });
        return;
      }
      runOnJS(settleSwipe)(event.translationX, event.velocityX, w);
    },
  });

  const trackStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  if (!enabled) {
    return <View style={[styles.clip, style]}>{children}</View>;
  }

  return (
    <GestureDetector gesture={gesture} touchAction="pan-y">
      <View style={[styles.clip, style]} onLayout={onLayout}>
        <Animated.View style={[styles.track, trackStyle]}>
          <View
            style={[styles.page, styles.pagePrev]}
            pointerEvents="none"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            {renderAdjacent(prevMonth, 'prev')}
          </View>
          <View style={styles.pageCurrent} pointerEvents="box-none">
            {children}
          </View>
          <View
            style={[styles.page, styles.pageNext]}
            pointerEvents="none"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            {renderAdjacent(nextMonth, 'next')}
          </View>
        </Animated.View>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  clip: {
    flex: 1,
    overflow: 'hidden',
  },
  track: {
    flex: 1,
  },
  pageCurrent: {
    flex: 1,
  },
  page: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: '100%',
  },
  pagePrev: {
    left: '-100%',
  },
  pageNext: {
    left: '100%',
  },
});
