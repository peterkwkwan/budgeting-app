import { Pressable, StyleSheet, View } from 'react-native';

import { CaptionText } from '@/components/StyledText';
import { colors, fonts, radius, space } from '@/constants/theme';

export type SegmentOption<T extends string> = {
  value: T;
  label: string;
};

type Props<T extends string> = {
  options: readonly SegmentOption<T>[];
  value: T;
  onChange?: (value: T) => void;
  /** When true, chips render selected state but ignore presses (peek chrome). */
  readOnly?: boolean;
  accessibilityLabel?: string;
};

/**
 * Centered chip row for Stats Expenses|Income (and Trend Expenses|Income|Net).
 * Always mount this row — even on quiet/loading months — so the chart/list
 * below does not jump when data arrives.
 */
export function StatsSegmentToggle<T extends string>({
  options,
  value,
  onChange,
  readOnly = false,
  accessibilityLabel,
}: Props<T>) {
  return (
    <View
      style={styles.row}
      accessibilityRole="toolbar"
      accessibilityLabel={accessibilityLabel}
    >
      {options.map((opt) => {
        const selected = value === opt.value;
        return (
          <Pressable
            key={opt.value}
            onPress={
              readOnly || !onChange ? undefined : () => onChange(opt.value)
            }
            disabled={readOnly || !onChange}
            style={[styles.chip, selected && styles.chipSelected]}
            accessibilityRole="button"
            accessibilityState={{ selected, disabled: readOnly }}
          >
            <CaptionText
              style={[styles.text, selected && styles.textSelected]}
            >
              {opt.label}
            </CaptionText>
          </Pressable>
        );
      })}
    </View>
  );
}

export const PIE_TYPE_OPTIONS = [
  { value: 'expense', label: 'Expenses' },
  { value: 'income', label: 'Income' },
] as const;

export const TREND_METRIC_OPTIONS = [
  { value: 'expense', label: 'Expenses' },
  { value: 'income', label: 'Income' },
  { value: 'net', label: 'Net' },
] as const;

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
    justifyContent: 'center',
    // Chip minHeight 36 — reserve even before first paint of children.
    minHeight: 36,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceMuted,
    minHeight: 36,
    justifyContent: 'center',
  },
  chipSelected: {
    backgroundColor: colors.green[700],
  },
  text: {
    color: colors.inkMuted,
    fontFamily: fonts.bodyStrong,
  },
  textSelected: {
    color: colors.inkInverse,
    fontFamily: fonts.bodyStrong,
  },
});
