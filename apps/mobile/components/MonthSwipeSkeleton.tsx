import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, radius, space } from '@/constants/theme';

type MonthSwipeSkeletonProps = {
  style?: StyleProp<ViewStyle>;
};

/**
 * Soft paper placeholders for an adjacent Transactions month while the
 * shared list is still cold. Last resort — warm cache peeks render real rows.
 */
export function MonthSwipeSkeleton({ style }: MonthSwipeSkeletonProps) {
  return (
    <View style={[styles.pad, style]} accessibilityLabel="Loading month">
      <View style={styles.calGrid}>
        {Array.from({ length: 7 }, (_, i) => (
          <View key={`h-${i}`} style={styles.calHead} />
        ))}
        {Array.from({ length: 28 }, (_, i) => (
          <View key={`d-${i}`} style={styles.calCell} />
        ))}
      </View>
      <View style={styles.dayHead} />
      <View style={styles.listBar} />
      <View style={[styles.listBar, styles.listBarMid]} />
      <View style={[styles.listBar, styles.listBarShort]} />
    </View>
  );
}

const bone = {
  backgroundColor: colors.surfaceMuted,
  borderRadius: radius.sm,
} as const;

const styles = StyleSheet.create({
  pad: {
    flex: 1,
    backgroundColor: colors.canvas,
    paddingHorizontal: space.md,
    paddingTop: space.md,
    gap: space.md,
  },
  listBar: {
    ...bone,
    height: 18,
    width: '100%',
  },
  listBarMid: {
    width: '78%',
  },
  listBarShort: {
    width: '56%',
  },
  calGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
    justifyContent: 'space-between',
  },
  calHead: {
    ...bone,
    width: '12%',
    height: 10,
  },
  calCell: {
    ...bone,
    width: '12%',
    height: 36,
  },
  dayHead: {
    ...bone,
    height: 16,
    width: '48%',
  },
});
