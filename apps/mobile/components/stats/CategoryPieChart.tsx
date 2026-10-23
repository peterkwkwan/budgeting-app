import { StyleSheet, View } from 'react-native';

import { CaptionText } from '@/components/StyledText';
import type { TransactionType } from '@/constants/categories';
import { colorForCategory } from '@/constants/chartColors';
import { colors, space } from '@/constants/theme';
import type { CategoryTotal } from '@/lib/stats';

type Props = {
  data: CategoryTotal[];
  emptyLabel: string;
  /** Active Stats type — drives green (income) vs rust (expense) wedges. */
  type: TransactionType;
};

const SIZE = 200;
const INNER_RATIO = 0.56;
/** Radial wedges — View-only donut (no Skia / SVG). */
const WEDGES = 90;

export function CategoryPieChart({ data, emptyLabel, type }: Props) {
  if (data.length === 0) {
    return (
      <View style={styles.empty}>
        <CaptionText style={styles.emptyText}>{emptyLabel}</CaptionText>
      </View>
    );
  }

  const total = data.reduce((acc, row) => acc + row.sum, 0) || 1;
  const stops: { end: number; color: string }[] = [];
  let cumulative = 0;
  data.forEach((row, index) => {
    cumulative += row.sum / total;
    stops.push({ end: cumulative, color: colorForCategory(index, type) });
  });

  const colorAt = (t: number): string => {
    for (const stop of stops) {
      if (t <= stop.end + 1e-9) return stop.color;
    }
    return stops[stops.length - 1]!.color;
  };

  const outerR = SIZE / 2;
  // Full spoke from rim to center; hole View masks the inner disk into a donut.
  const spokeHeight = outerR;
  // Chord width at the rim + overlap so wedges leave no gaps.
  const barWidth = 2 * outerR * Math.tan(Math.PI / WEDGES) + 1.5;
  // RN applies transforms left-to-right; default origin is the view center.
  // Spoke center is at y = spokeHeight/2; circle center is spokeHeight below top
  // (= outerR). Delta from view-center → circle-center = outerR/2.
  const pivot = outerR / 2;

  return (
    <View style={styles.wrap} accessibilityLabel="Category breakdown chart">
      <View style={styles.disk}>
        {Array.from({ length: WEDGES }, (_, i) => {
          const t = (i + 0.5) / WEDGES;
          const deg = (i / WEDGES) * 360;
          return (
            <View
              key={i}
              style={[
                styles.wedge,
                {
                  width: barWidth,
                  height: spokeHeight,
                  left: outerR - barWidth / 2,
                  top: 0,
                  backgroundColor: colorAt(t),
                  transform: [
                    { translateY: pivot },
                    { rotate: `${deg}deg` },
                    { translateY: -pivot },
                  ],
                },
              ]}
            />
          );
        })}
        <View style={styles.hole} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    height: 220,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  disk: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    overflow: 'hidden',
    backgroundColor: colors.canvas,
  },
  wedge: {
    position: 'absolute',
  },
  hole: {
    position: 'absolute',
    width: SIZE * INNER_RATIO,
    height: SIZE * INNER_RATIO,
    borderRadius: (SIZE * INNER_RATIO) / 2,
    backgroundColor: colors.canvas,
    top: (SIZE * (1 - INNER_RATIO)) / 2,
    left: (SIZE * (1 - INNER_RATIO)) / 2,
  },
  empty: {
    height: 180,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.lg,
  },
  emptyText: {
    color: colors.inkMuted,
    textAlign: 'center',
  },
});
