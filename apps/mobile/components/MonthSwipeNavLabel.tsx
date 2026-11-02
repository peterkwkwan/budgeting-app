import { useCallback, useLayoutEffect, useState } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';

import { colors, fonts } from '@/constants/theme';

/** Longest English month name — fixed slot so ‹ › do not shift (May vs September). */
export const LONGEST_MONTH_NAV_LABEL = 'September';

type Props = {
  prevLabel: string;
  navLabel: string;
  nextLabel: string;
  /** Same translateX as MonthCardPager’s track. */
  translateX: SharedValue<number>;
  /** Pager width SharedValue from MonthCardPager. */
  pagerWidth: SharedValue<number>;
};

type FixedLabelProps = {
  label: string;
};

/**
 * Single month/year label in a September-width slot (static path when there is
 * no swipe motion — Yearly, or Monthly before the pager mounts).
 */
export function FixedMonthNavLabel({ label }: FixedLabelProps) {
  const [slotW, setSlotW] = useState(0);

  const onMeasure = useCallback((event: LayoutChangeEvent) => {
    const w = Math.ceil(event.nativeEvent.layout.width);
    if (!(w > 0)) return;
    setSlotW((prevW) => (prevW === w ? prevW : w));
  }, []);

  return (
    <View
      style={[styles.wrap, slotW > 0 ? { width: slotW } : null]}
      collapsable={false}
    >
      <SeptemberWidthProbe onLayout={onMeasure} />
      <Text
        style={[styles.label, slotW > 0 ? { width: slotW } : null]}
        numberOfLines={1}
        accessibilityRole="header"
        accessibilityLabel={label}
      >
        {label}
      </Text>
    </View>
  );
}

/**
 * Month title strip that tracks the card pager’s translateX so
 * ‹ November › slides toward October with the swipe (not after settle).
 *
 * Slot width is locked to “September” (longest English month) so chevrons
 * stay put when swiping May ↔ September. Labels are centered in that slot.
 *
 * Shared values are only written from layout/effects (never during render).
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

  // Mirror React width into the shared value after commit — never in render.
  useLayoutEffect(() => {
    slotSV.value = slotW;
  }, [slotW, slotSV]);

  const onMeasure = useCallback((event: LayoutChangeEvent) => {
    const w = Math.ceil(event.nativeEvent.layout.width);
    if (!(w > 0)) return;
    setSlotW((prevW) => (prevW === w ? prevW : w));
  }, []);

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
    <View
      style={[styles.wrap, slotW > 0 ? { width: slotW } : null]}
      // Content-sized — never grow into the header leftover (that pushed › away).
      collapsable={false}
    >
      <SeptemberWidthProbe onLayout={onMeasure} />

      {slotW <= 0 ? (
        <Text
          style={styles.label}
          numberOfLines={1}
          accessibilityRole="header"
          accessibilityLabel={navLabel}
        >
          {navLabel}
        </Text>
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

function SeptemberWidthProbe({
  onLayout,
}: {
  onLayout: (event: LayoutChangeEvent) => void;
}) {
  return (
    <View
      style={styles.measureLayer}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Text
        style={styles.measureLabel}
        numberOfLines={1}
        onLayout={onLayout}
      >
        {LONGEST_MONTH_NAV_LABEL}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexGrow: 0,
    flexShrink: 0,
    flexBasis: 'auto',
    alignSelf: 'center',
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
  },
  viewport: {
    flexGrow: 0,
    flexShrink: 0,
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
    textAlign: 'center',
    fontFamily: fonts.bodyStrong,
  },
});
