import { StyleSheet, View } from 'react-native';

import { CaptionText } from '@/components/StyledText';
import { colors, space } from '@/constants/theme';

/** Match TrendLineChart plot height so loading does not collapse then expand. */
export const STATS_TREND_CHART_H = 176;

type Props = {
  /** Optional muted caption under the well (defaults to loading). */
  label?: string;
};

/**
 * Soft full-bleed well for the Trend section while the series loads.
 * Same height as TrendLineChart so swipe/settle does not blank then pop-in.
 */
export function StatsTrendPlaceholder({
  label = 'Loading trend…',
}: Props) {
  return (
    <View
      style={styles.wrap}
      accessibilityLabel={label}
      accessibilityRole="progressbar"
    >
      <View style={styles.well}>
        <View style={styles.ghostLine} />
        <View style={[styles.dot, styles.dotA]} />
        <View style={[styles.dot, styles.dotB]} />
        <View style={[styles.dot, styles.dotC]} />
        <View style={[styles.dot, styles.dotD]} />
        <View style={[styles.dot, styles.dotE]} />
      </View>
      <CaptionText style={styles.caption}>{label}</CaptionText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    gap: space.sm,
  },
  well: {
    height: STATS_TREND_CHART_H,
    width: '100%',
    backgroundColor: colors.canvas,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  ghostLine: {
    position: 'absolute',
    left: '8%',
    right: '8%',
    height: StyleSheet.hairlineWidth * 2,
    top: '48%',
    backgroundColor: colors.border,
    opacity: 0.7,
  },
  dot: {
    position: 'absolute',
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  dotA: { left: '10%', top: '52%' },
  dotB: { left: '30%', top: '40%' },
  dotC: { left: '50%', top: '46%' },
  dotD: { left: '70%', top: '34%' },
  dotE: { left: '88%', top: '42%' },
  caption: {
    color: colors.inkMuted,
    textAlign: 'center',
    fontSize: 13,
    lineHeight: 18,
    paddingHorizontal: space.md,
  },
});
