import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
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
  type SharedValue,
} from 'react-native-reanimated';

import {
  MONTH_CARD_SNAP_MS,
  MONTH_NEIGHBOR_LOCK_MS,
  MONTH_SWIPE_ACTIVATION_PX,
  MONTH_SWIPE_FAIL_Y_PX,
  monthContentKey,
  monthStepDirection,
  monthStepFromCardSwipe,
  shiftYearMonth,
} from '@/lib/monthSwipe';
import type { PeriodFocus } from '@/lib/periods';

export type MonthCardSlot = 'prev' | 'current' | 'next';

type MonthCardPagerProps = {
  /** Focused calendar month — drives prev/current/next full-month slots. */
  focus: PeriodFocus;
  /**
   * When false, render only the current page (no gesture / adjacent months).
   * Stats uses this outside Monthly mode.
   */
  enabled: boolean;
  onStep: (delta: -1 | 1) => void;
  style?: StyleProp<ViewStyle>;
  /**
   * Full month UI for a slot. Same component family for all three so settle
   * never swaps trees (date-line / Trend / Quiet chrome stay isomorphic).
   * `active` is true only for the center slot.
   */
  renderPage: (focus: PeriodFocus, slot: MonthCardSlot) => ReactNode;
  /**
   * Optional shared motion (e.g. header month label). When omitted the pager
   * owns internal values; when provided, parent drives header sync from the
   * same translateX / width as the sliding track.
   */
  translateX?: SharedValue<number>;
  pagerWidth?: SharedValue<number>;
  /**
   * True when M±1 for the current focus can paint without a cold skeleton.
   * After a settle, swipe + header stay locked until this is true (or the
   * short neighbor-lock timeout). Omit to skip locking.
   */
  neighborsReady?: boolean;
  /** Mirror of the settle input lock — disable header month chevrons. */
  onInputLockChange?: (locked: boolean) => void;
};

const easeOut = Easing.out(Easing.cubic);

type PageSpec = {
  focus: PeriodFocus;
  slot: MonthCardSlot;
};

/**
 * Tinder-style horizontal month cards.
 * Drag left/right to peek the next/previous month; release to snap.
 * Pages are keyed by month content so settle promotes the warm adjacent
 * fiber instead of rewriting the center instance in place.
 */
export function MonthCardPager({
  focus,
  enabled,
  onStep,
  style,
  renderPage,
  translateX: translateXProp,
  pagerWidth: pagerWidthProp,
  neighborsReady,
  onInputLockChange,
}: MonthCardPagerProps) {
  const widthInternal = useSharedValue(0);
  const translateInternal = useSharedValue(0);
  const widthSV = pagerWidthProp ?? widthInternal;
  const translateX = translateXProp ?? translateInternal;

  const ignoreFocusAnimRef = useRef(false);
  const lockAfterStepRef = useRef(false);
  const prevFocusRef = useRef(focus);
  const onStepRef = useRef(onStep);
  onStepRef.current = onStep;
  const onInputLockChangeRef = useRef(onInputLockChange);
  onInputLockChangeRef.current = onInputLockChange;

  const [inputLocked, setInputLocked] = useState(false);

  const pages = useMemo<PageSpec[]>(
    () => [
      { focus: shiftYearMonth(focus, -1), slot: 'prev' },
      { focus, slot: 'current' },
      { focus: shiftYearMonth(focus, 1), slot: 'next' },
    ],
    [focus.year, focus.month]
  );

  useEffect(() => {
    onInputLockChangeRef.current?.(inputLocked);
  }, [inputLocked]);

  const commitStep = useCallback((delta: -1 | 1) => {
    ignoreFocusAnimRef.current = true;
    lockAfterStepRef.current = true;
    onStepRef.current(delta);
  }, []);

  /**
   * Snap / commit on the JS thread (`monthStepFromCardSwipe` is not a worklet).
   * On a committed step, keep translateX at the page offset until focus updates,
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
      // Promoted adjacent fiber is already under the viewport offset; show it
      // centered before paint (content key recycle keeps that tree mounted).
      translateX.value = 0;
      return;
    }
    if (!enabled || step === 0 || widthSV.value <= 0) return;
    // Header chevron / programmatic step — also arm neighbor lock.
    lockAfterStepRef.current = true;
    translateX.value = -step * widthSV.value;
    translateX.value = withTiming(0, {
      duration: MONTH_CARD_SNAP_MS,
      easing: easeOut,
    });
  }, [enabled, focus.year, focus.month, translateX, widthSV]);

  // Lock swipe + header until new M±1 neighbors are ready (or short timeout).
  useEffect(() => {
    if (!enabled || neighborsReady === undefined) {
      lockAfterStepRef.current = false;
      setInputLocked(false);
      return;
    }
    if (!lockAfterStepRef.current) {
      setInputLocked(false);
      return;
    }
    if (neighborsReady) {
      lockAfterStepRef.current = false;
      setInputLocked(false);
      return;
    }
    setInputLocked(true);
    const timer = setTimeout(() => {
      lockAfterStepRef.current = false;
      setInputLocked(false);
    }, MONTH_NEIGHBOR_LOCK_MS);
    return () => clearTimeout(timer);
  }, [enabled, neighborsReady, focus.year, focus.month]);

  const gesture = usePanGesture({
    enabled: enabled && !inputLocked,
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
    return (
      <View style={[styles.clip, style]}>{renderPage(focus, 'current')}</View>
    );
  }

  return (
    <GestureDetector gesture={gesture} touchAction="pan-y">
      <View style={[styles.clip, style]} onLayout={onLayout}>
        <Animated.View style={[styles.track, trackStyle]}>
          {pages.map((page) => {
            const isCurrent = page.slot === 'current';
            return (
              <View
                key={monthContentKey(page.focus)}
                style={
                  isCurrent
                    ? styles.pageCurrent
                    : [
                        styles.page,
                        page.slot === 'prev'
                          ? styles.pagePrev
                          : styles.pageNext,
                      ]
                }
                pointerEvents={isCurrent ? 'box-none' : 'none'}
                accessibilityElementsHidden={!isCurrent}
                importantForAccessibility={
                  isCurrent ? 'yes' : 'no-hide-descendants'
                }
              >
                {renderPage(page.focus, page.slot)}
              </View>
            );
          })}
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
