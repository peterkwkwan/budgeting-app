import { StyleSheet, View } from 'react-native';
import { Pie, PolarChart } from 'victory-native';

import { CaptionText } from '@/components/StyledText';
import { colorForCategory } from '@/constants/chartColors';
import { colors, space } from '@/constants/theme';
import type { CategoryTotal } from '@/lib/stats';

type Props = {
  data: CategoryTotal[];
  emptyLabel: string;
};

export function CategoryPieChart({ data, emptyLabel }: Props) {
  if (data.length === 0) {
    return (
      <View style={styles.empty}>
        <CaptionText style={styles.emptyText}>{emptyLabel}</CaptionText>
      </View>
    );
  }

  const pieData = data.map((row, index) => ({
    label: row.category,
    value: row.sum,
    color: colorForCategory(index),
  }));

  return (
    <View style={styles.wrap} accessibilityLabel="Category breakdown chart">
      <PolarChart
        data={pieData}
        labelKey="label"
        valueKey="value"
        colorKey="color"
      >
        <Pie.Chart innerRadius="55%" />
      </PolarChart>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    height: 220,
    width: '100%',
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
