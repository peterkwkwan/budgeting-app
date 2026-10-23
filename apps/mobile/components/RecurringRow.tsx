import { Pressable, StyleSheet, View } from 'react-native';

import { CaptionText, StrongText } from '@/components/StyledText';
import { colors, space, typography } from '@/constants/theme';
import { seriesRepeatLabel } from '@/constants/repeatPresets';
import { formatUsd } from '@/lib/money';
import type { RecurringSeries } from '@/lib/recurring';

function formatAmount(series: RecurringSeries): string {
  const sign = series.type === 'expense' ? '−' : '+';
  return `${sign}${formatUsd(series.amount)}`;
}

type Props = {
  series: RecurringSeries;
  onPress: () => void;
};

export function RecurringRow({ series, onPress }: Props) {
  const amountColor =
    series.type === 'income' ? colors.income : colors.expense;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={`${series.category}, ${seriesRepeatLabel(series.cadence, series.byweekday, series.ends_on, series.ends_after_count)}, ${formatAmount(series)}`}
    >
      <View style={styles.left}>
        <StrongText style={styles.category}>{series.category}</StrongText>
        {series.note ? (
          <CaptionText style={styles.note} numberOfLines={1}>
            {series.note}
          </CaptionText>
        ) : null}
        <CaptionText style={styles.meta}>
          {seriesRepeatLabel(
            series.cadence,
            series.byweekday,
            series.ends_on,
            series.ends_after_count
          )}{' '}
          · {series.type === 'income' ? 'Income' : 'Expense'}
        </CaptionText>
      </View>
      <StrongText style={[styles.amount, { color: amountColor }]}>
        {formatAmount(series)}
      </StrongText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 56,
    paddingVertical: space.sm + 4,
    paddingHorizontal: space.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  pressed: {
    backgroundColor: colors.surfaceMuted,
  },
  left: {
    flex: 1,
    gap: 2,
  },
  category: {
    color: colors.ink,
  },
  note: {
    color: colors.inkMuted,
  },
  meta: {
    color: colors.inkMuted,
  },
  amount: {
    ...typography.amount,
    fontSize: 18,
    lineHeight: 24,
  },
});
