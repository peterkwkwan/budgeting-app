import { StyleSheet, View } from 'react-native';

import { CaptionText, StrongText } from '@/components/StyledText';
import type { TransactionType } from '@/constants/categories';
import { colorForCategory } from '@/constants/chartColors';
import { colors, fonts, space, typography } from '@/constants/theme';
import { formatUsd } from '@/lib/money';
import type { CategoryTotal } from '@/lib/stats';

type Props = {
  data: CategoryTotal[];
  emptyLabel: string;
  /** Active Stats type — drives green (income) vs rust (expense) wedges. */
  type: TransactionType;
  /**
   * Active-mode period total shown in the donut hole
   * (Spent for expenses, Earned for income).
   */
  centerTotal: number;
};

/** Matches mockup D: 168 outer / 104 hole. */
const SIZE = 168;
const INNER_RATIO = 104 / 168;
/** Radial wedges — View-only donut (no Skia / SVG). */
const WEDGES = 90;

function formatCenterMoney(n: number): string {
  const sign = n < 0 ? '−' : '';
  return `${sign}${formatUsd(Math.abs(n))}`;
}

export function CategoryPieChart({
  data,
  emptyLabel,
  type,
  centerTotal,
}: Props) {
  const centerLabel = type === 'expense' ? 'Spent' : 'Earned';
  const centerColor = type === 'expense' ? colors.expense : colors.income;

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
    <View
      style={styles.wrap}
      accessibilityLabel={`${centerLabel} ${formatCenterMoney(centerTotal)}. Category breakdown chart`}
    >
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
        <View style={styles.hole} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <CaptionText style={styles.centerLabel}>{centerLabel}</CaptionText>
          <StrongText style={[styles.centerValue, { color: centerColor }]}>
            {formatCenterMoney(centerTotal)}
          </StrongText>
        </View>
      </View>
    </View>
  );
}

const holeSize = SIZE * INNER_RATIO;

const styles = StyleSheet.create({
  wrap: {
    height: SIZE + 12,
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
    width: holeSize,
    height: holeSize,
    borderRadius: holeSize / 2,
    backgroundColor: colors.canvas,
    top: (SIZE - holeSize) / 2,
    left: (SIZE - holeSize) / 2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.xs,
  },
  centerLabel: {
    color: colors.inkMuted,
    fontSize: 12,
    lineHeight: 16,
    fontFamily: fonts.caption,
  },
  centerValue: {
    ...typography.amount,
    fontSize: 18,
    lineHeight: 22,
    textAlign: 'center',
  },
  empty: {
    height: 168,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.lg,
  },
  emptyText: {
    color: colors.inkMuted,
    textAlign: 'center',
  },
});
