import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, radius, space } from '@/constants/theme';

type MonthSwipeSkeletonProps = {
  /** Layout hint for the peek card. */
  variant: 'transactions' | 'stats';
  style?: StyleProp<ViewStyle>;
};

/**
 * Soft paper placeholders for an adjacent month while its data loads.
 * Amounts / list rows / chart blocks — not a spinner.
 */
export function MonthSwipeSkeleton({
  variant,
  style,
}: MonthSwipeSkeletonProps) {
  if (variant === 'stats') {
    return (
      <View style={[styles.pad, style]} accessibilityLabel="Loading month">
        <View style={styles.chartBlock} />
        <View style={styles.rateBar} />
        <View style={styles.peerRow}>
          <View style={styles.peer} />
          <View style={styles.peer} />
          <View style={styles.peer} />
        </View>
        <View style={styles.listBar} />
        <View style={[styles.listBar, styles.listBarShort]} />
        <View style={[styles.listBar, styles.listBarMid]} />
      </View>
    );
  }

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
  chartBlock: {
    ...bone,
    height: 180,
    borderRadius: radius.md,
    alignSelf: 'center',
    width: '72%',
  },
  rateBar: {
    ...bone,
    height: 14,
    width: '40%',
    alignSelf: 'center',
  },
  peerRow: {
    flexDirection: 'row',
    gap: space.md,
  },
  peer: {
    ...bone,
    flex: 1,
    height: 44,
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
