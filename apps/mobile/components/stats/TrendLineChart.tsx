import { StyleSheet, View } from 'react-native';
import { CartesianChart, Line } from 'victory-native';

import { CaptionText } from '@/components/StyledText';
import { colors, space } from '@/constants/theme';
import type { TrendPoint } from '@/lib/stats';

type Props = {
  data: TrendPoint[];
  emptyLabel: string;
  strokeColor?: string;
};

export function TrendLineChart({
  data,
  emptyLabel,
  strokeColor = colors.green[700],
}: Props) {
  if (data.length === 0) {
    return (
      <View style={styles.empty}>
        <CaptionText style={styles.emptyText}>{emptyLabel}</CaptionText>
      </View>
    );
  }

  // Single point: duplicate so the line has length.
  const points =
    data.length === 1
      ? [
          { x: 0, y: data[0]!.total },
          { x: 1, y: data[0]!.total },
        ]
      : data.map((p, index) => ({ x: index, y: p.total }));

  return (
    <View style={styles.wrap} accessibilityLabel="Spending trend chart">
      <CartesianChart data={points} xKey="x" yKeys={['y']}>
        {({ points: chartPoints }) => (
          <Line
            points={chartPoints.y}
            color={strokeColor}
            strokeWidth={2.5}
            curveType="natural"
          />
        )}
      </CartesianChart>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    height: 180,
    width: '100%',
  },
  empty: {
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.lg,
  },
  emptyText: {
    color: colors.inkMuted,
    textAlign: 'center',
  },
});
