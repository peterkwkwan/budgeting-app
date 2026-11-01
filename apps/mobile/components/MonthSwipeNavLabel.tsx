import { useCallback, useState } from 'react';
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
 */
export function MonthSwipeNavLabel({
  prevLabel,
  navLabel,
  nextLabel,
  translateX,
  pagerWidth,
}: Props) {
  const viewportSV = useSharedValue(0);
  const [viewportW, setViewportW] = useState(0);

  const onLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const w = event.nativeEvent.layout.width;
      if (!(w > 0) || w === viewportW) return;
      viewportSV.value = w;
      setViewportW(w);
    },
    [viewportSV, viewportW]
  );

  const stripStyle = useAnimatedStyle(() => {
    const pw = pagerWidth.value;
    const lw = viewportSV.value;
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

  const slotStyle = viewportW > 0 ? { width: viewportW } : styles.slotFallback;

  return (
    <View
      style={styles.viewport}
      onLayout={onLayout}
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
  );
}

const styles = StyleSheet.create({
  viewport: {
    flexShrink: 1,
    minWidth: 0,
    overflow: 'hidden',
  },
  strip: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  slotFallback: {
    // Before first layout, keep current label visible roughly in place.
    flexShrink: 0,
  },
  label: {
    color: colors.ink,
    fontSize: 17,
    lineHeight: 22,
    textAlign: 'left',
    fontFamily: fonts.bodyStrong,
  },
});
