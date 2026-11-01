import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
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
 * Viewport width is the natural width of the longest of prev/current/next —
 * never the flex leftover in the header — so › packs beside the month.
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

  // Remeasure when the trio changes; plain-text fallback keeps › packed
  // until the new max lands (no flex-grown gap).
  useEffect(() => {
    slotSV.value = 0;
    setSlotW(0);
  }, [prevLabel, navLabel, nextLabel, slotSV]);

  const onProbeLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const w = Math.ceil(event.nativeEvent.layout.width);
      if (!(w > 0)) return;
      setSlotW((prev) => {
        const next = Math.max(prev, w);
        if (next !== prev) {
          slotSV.value = next;
        }
        return next;
      });
    },
    [slotSV]
  );

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
      {/*
        Off-flow probes: each label at its natural text width (not clipped to
        the visible slot). Max width becomes the swipe viewport.
      */}
      <View
        style={styles.measureLayer}
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {[prevLabel, navLabel, nextLabel].map((label, index) => (
          <Text
            key={`${index}-${label}`}
            style={styles.measureLabel}
            numberOfLines={1}
            onLayout={onProbeLayout}
          >
            {label}
          </Text>
        ))}
      </View>

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

const styles = StyleSheet.create({
  wrap: {
    flexGrow: 0,
    flexShrink: 1,
    flexBasis: 'auto',
    minWidth: 0,
    maxWidth: '100%',
    alignSelf: 'flex-start',
    position: 'relative',
  },
  measureLayer: {
    position: 'absolute',
    opacity: 0,
    left: 0,
    top: 0,
    // Stack probes at intrinsic width; do not constrain to the visible slot.
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
    textAlign: 'left',
    fontFamily: fonts.bodyStrong,
  },
});
