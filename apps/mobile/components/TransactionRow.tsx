import { useRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { CaptionText, StrongText } from '@/components/StyledText';
import { colors, space, typography } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { formatDisplayDate } from '@/lib/dates';
import { formatUsd } from '@/lib/money';
import { deviceTimezone } from '@/lib/profile';
import type { Transaction } from '@/lib/transactions';

function formatAmount(txn: Transaction): string {
  const sign = txn.type === 'expense' ? '−' : '+';
  return `${sign}${formatUsd(txn.amount)}`;
}

type Props = {
  transaction: Transaction;
  onPress: () => void;
  onLongPress?: () => void;
  selected?: boolean;
  selectionMode?: boolean;
  /** When grouped under a day heading, omit the date from the meta line. */
  hideDate?: boolean;
};

export function TransactionRow({
  transaction,
  onPress,
  onLongPress,
  selected = false,
  selectionMode = false,
  hideDate = false,
}: Props) {
  const { profile } = useAuth();
  const timeZone = profile?.timezone || deviceTimezone();
  const amountColor =
    transaction.type === 'income' ? colors.income : colors.expense;
  const dateLabel = formatDisplayDate(transaction.occurred_at, timeZone);
  const typeLabel =
    transaction.type === 'income' ? 'Income' : 'Expense';
  const metaParts = [
    ...(hideDate ? [] : [dateLabel]),
    typeLabel,
    ...(transaction.recurring_series_id ? ['Recurring'] : []),
  ];
  /** RN (esp. web/emulator) often fires onPress on finger-up after onLongPress. */
  const suppressPressAfterLongPress = useRef(false);

  return (
    <Pressable
      onPress={() => {
        if (suppressPressAfterLongPress.current) {
          suppressPressAfterLongPress.current = false;
          return;
        }
        onPress();
      }}
      onLongPress={
        onLongPress
          ? () => {
              suppressPressAfterLongPress.current = true;
              onLongPress();
            }
          : undefined
      }
      delayLongPress={600}
      style={({ pressed }) => [
        styles.row,
        selected && styles.selected,
        pressed && !selected && styles.pressed,
      ]}
      accessibilityRole="button"
      accessibilityState={{ selected: selectionMode ? selected : undefined }}
      accessibilityLabel={`${transaction.category}, ${formatAmount(transaction)}, ${dateLabel}${
        selectionMode ? (selected ? ', selected' : ', not selected') : ''
      }`}
    >
      {selectionMode ? (
        <View
          style={[styles.check, selected && styles.checkSelected]}
          accessibilityElementsHidden
          importantForAccessibility="no"
        />
      ) : null}
      <View style={styles.left}>
        <StrongText style={styles.category}>{transaction.category}</StrongText>
        {transaction.note ? (
          <CaptionText style={styles.note} numberOfLines={1}>
            {transaction.note}
          </CaptionText>
        ) : null}
        <CaptionText style={styles.meta}>{metaParts.join(' · ')}</CaptionText>
      </View>
      <StrongText style={[styles.amount, { color: amountColor }]}>
        {formatAmount(transaction)}
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
  selected: {
    backgroundColor: colors.green[50],
    borderBottomColor: colors.green[200],
  },
  pressed: {
    backgroundColor: colors.surfaceMuted,
  },
  check: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.canvas,
  },
  checkSelected: {
    borderColor: colors.green[700],
    backgroundColor: colors.green[700],
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
