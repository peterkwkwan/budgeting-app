import { Pressable, StyleSheet, View } from 'react-native';

import { CaptionText, StrongText } from '@/components/StyledText';
import { colors, space, typography } from '@/constants/theme';
import type { Transaction } from '@/lib/transactions';

function formatAmount(txn: Transaction): string {
  const sign = txn.type === 'expense' ? '−' : '+';
  return `${sign}$${txn.amount.toFixed(2)}`;
}

function formatOccurredAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

type Props = {
  transaction: Transaction;
  onPress: () => void;
};

export function TransactionRow({ transaction, onPress }: Props) {
  const amountColor =
    transaction.type === 'income' ? colors.income : colors.expense;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={`${transaction.category}, ${formatAmount(transaction)}`}
    >
      <View style={styles.left}>
        <StrongText style={styles.category}>{transaction.category}</StrongText>
        {transaction.note ? (
          <CaptionText style={styles.note} numberOfLines={1}>
            {transaction.note}
          </CaptionText>
        ) : null}
        <CaptionText style={styles.meta}>
          {formatOccurredAt(transaction.occurred_at)} ·{' '}
          {transaction.type === 'income' ? 'Income' : 'Expense'}
          {transaction.recurring_series_id ? ' · Recurring' : ''}
        </CaptionText>
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
    borderBottomColor: colors.green[200],
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
