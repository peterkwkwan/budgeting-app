import { StyleSheet, View } from 'react-native';

import { colors, space } from '@/constants/theme';

const ROW_COUNT = 5;
/** Vary label bone widths so the stack reads as real rows, not a solid block. */
const LABEL_WIDTHS = ['58%', '72%', '46%', '64%', '52%'] as const;

/**
 * Five category-row bones (label + amount + track) for below-donut loading.
 * Matches CategoryBreakdownList row rhythm so the list does not jump in.
 */
export function CategoryListSkeleton() {
  return (
    <View
      style={styles.list}
      accessibilityLabel="Loading categories"
      accessibilityRole="progressbar"
    >
      {Array.from({ length: ROW_COUNT }, (_, i) => (
        <View key={i} style={styles.row}>
          <View style={styles.top}>
            <View style={[styles.labelBone, { width: LABEL_WIDTHS[i] }]} />
            <View style={styles.amountBone} />
          </View>
          <View style={styles.track} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: 0,
  },
  row: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 6,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
  },
  labelBone: {
    height: 14,
    borderRadius: 4,
    backgroundColor: colors.surfaceMuted,
  },
  amountBone: {
    height: 14,
    width: 56,
    borderRadius: 4,
    backgroundColor: colors.surfaceMuted,
    flexShrink: 0,
  },
  track: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.surfaceMuted,
    width: '100%',
  },
});
