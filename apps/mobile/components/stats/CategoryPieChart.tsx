import { StyleSheet, View } from 'react-native';

import { CaptionText } from '@/components/StyledText';
import { colorForCategory } from '@/constants/chartColors';
import { colors, space } from '@/constants/theme';
import type { CategoryTotal } from '@/lib/stats';

type Props = {
  data: CategoryTotal[];
  emptyLabel: string;
};

const SIZE = 200;
const INNER_RATIO = 0.56;
/** Radial wedges — View-only donut (no Skia / SVG). */
const WEDGES = 72;

export function CategoryPieChart({ data, emptyLabel }: Props) {
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
    stops.push({ end: cumulative, color: colorForCategory(index) });
  });

  const colorAt = (t: number): string => {
    for (const stop of stops) {
      if (t <= stop.end + 1e-9) return stop.color;
    }
    return stops[stops.length - 1]!.color;
  };

  const outerR = SIZE / 2;
  const barHeight = outerR * (1 - INNER_RATIO);
  const barWidth = Math.max(3.5, (Math.PI * SIZE) / WEDGES + 0.75);
  const pivot = outerR - barHeight / 2;

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
                  height: barHeight,
                  left: outerR - barWidth / 2,
                  top: 0,
                  backgroundColor: colorAt(t),
                  // RN transforms apply right-to-left: move pivot to center, rotate, restore.
                  transform: [
                    { translateY: -pivot },
                    { rotate: `${deg}deg` },
                    { translateY: pivot },
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
    backgroundColor: colors.green[200],
  },
  wedge: {
    position: 'absolute',
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
  },
  hole: {
    position: 'absolute',
    width: SIZE * INNER_RATIO,
    height: SIZE * INNER_RATIO,
    borderRadius: (SIZE * INNER_RATIO) / 2,
    backgroundColor: colors.green[50],
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
