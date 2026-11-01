import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';

import { colors, fonts } from '@/constants/theme';

type Props = {
  prevLabel: string;
  navLabel: string;
  nextLabel: string;
  /** Same translateX as MonthCardPager’s track. */
  translateX: SharedValue<number>;
  /** Pager width SharedValue from MonthCardPager. */
  pagerWidth: SharedValue<number>;
};

/**
 * Month title strip that tracks the card pager’s translateX so
 * ‹ November › slides toward October with the swipe (not after settle).
 *
 * Viewport width comes from a single-label measure probe — not the three-slot
 * strip — so the right › stays beside the month (not at the end of the navbar).
 */
export function MonthSwipeNavLabel({
  prevLabel,
  navLabel,
  nextLabel,
  translateX,
  pagerWidth,
}: Props) {
  const slotSV = useSharedValue(0);
  const [slotW, setSlotW] = useState(0);
  const probeWidths = useRef({ prev: 0, nav: 0, next: 0 });

  // Clear per-label probes when the trio changes; keep last slotW until the
  // new max lands so the chevron cluster does not collapse mid-swipe.
  useEffect(() => {
    probeWidths.current = { prev: 0, nav: 0, next: 0 };
  }, [prevLabel, navLabel, nextLabel]);

  const commitMax = useCallback(() => {
    const { prev, nav, next } = probeWidths.current;
    if (!(nav > 0)) return;
    const measured = Math.max(prev, nav, next);
    if (!(measured > 0) || measured === slotW) return;
    slotSV.value = measured;
    setSlotW(measured);
  }, [slotSV, slotW]);

  const onMeasure =
    (key: 'prev' | 'nav' | 'next') => (event: LayoutChangeEvent) => {
      const w = Math.ceil(event.nativeEvent.layout.width);
      if (!(w > 0)) return;
      probeWidths.current[key] = w;
      commitMax();
    };

  const stripStyle = useAnimatedStyle(() => {
    const pw = pagerWidth.value;
    const lw = slotSV.value;
    if (!(pw > 0) || !(lw > 0)) {
      return { transform: [{ translateX: -lw }] };
    }
    // Pager: +width shows prev, −width shows next.
    // Strip is [prev][current][next]; start at −lw (current in view).
    const progress = translateX.value / pw;
    return {
      transform: [{ translateX: -lw + progress * lw }],
    };
  });

  const slotStyle = slotW > 0 ? { width: slotW } : undefined;

  return (
    <View style={styles.wrap}>
      {/*
        Hidden probe: natural width of the longest of prev/current/next so the
        viewport is one slot wide (› packs beside the label). Absolute so it
        does not affect layout.
      */}
      <View
        style={styles.measureLayer}
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {(
          [
            ['prev', prevLabel],
            ['nav', navLabel],
            ['next', nextLabel],
          ] as const
        ).map(([key, label]) => (
          <Animated.Text
            key={`${key}-${label}`}
            style={styles.measureLabel}
            numberOfLines={1}
            onLayout={onMeasure(key)}
          >
            {label}
          </Animated.Text>
        ))}
      </View>

      {slotW <= 0 ? (
        <Animated.Text
          style={styles.label}
          numberOfLines={1}
          accessibilityRole="header"
          accessibilityLabel={navLabel}
        >
          {navLabel}
        </Animated.Text>
      ) : (
        <View
          style={[styles.viewport, { width: slotW }]}
          accessibilityRole="header"
        >
          <Animated.View style={[styles.strip, stripStyle]}>
            <Animated.Text
              style={[styles.label, slotStyle]}
              numberOfLines={1}
              accessibilityElementsHidden
              importantForAccessibility="no"
            >
              {prevLabel}
            </Animated.Text>
            <Animated.Text
              style={[styles.label, slotStyle]}
              numberOfLines={1}
              accessibilityLabel={navLabel}
            >
              {navLabel}
            </Animated.Text>
            <Animated.Text
              style={[styles.label, slotStyle]}
              numberOfLines={1}
              accessibilityElementsHidden
              importantForAccessibility="no"
            >
              {nextLabel}
            </Animated.Text>
          </Animated.View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexGrow: 0,
    flexShrink: 1,
    minWidth: 0,
    position: 'relative',
  },
  measureLayer: {
    position: 'absolute',
    opacity: 0,
    left: 0,
    top: 0,
  },
  measureLabel: {
    color: colors.ink,
    fontSize: 17,
    lineHeight: 22,
    fontFamily: fonts.bodyStrong,
    // Let each probe size to its string; onLayout keeps the max.
    position: 'absolute',
    left: 0,
    top: 0,
  },
  viewport: {
    flexGrow: 0,
    flexShrink: 1,
    minWidth: 0,
    overflow: 'hidden',
  },
  strip: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  label: {
    color: colors.ink,
    fontSize: 17,
    lineHeight: 22,
    textAlign: 'left',
    fontFamily: fonts.bodyStrong,
  },
});
