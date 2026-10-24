import { Pressable, StyleSheet, View } from 'react-native';

import { CaptionText, StrongText } from '@/components/StyledText';
import type { TransactionType } from '@/constants/categories';
import { colorForCategory } from '@/constants/chartColors';
import { colors, fonts, space, typography } from '@/constants/theme';
import { formatUsd } from '@/lib/money';
import type { CategoryTotal } from '@/lib/stats';

type Props = {
  data: CategoryTotal[];
  /** When omitted, rows are display-only (e.g. pair aggregates — no txn drill-down). */
  onSelect?: (row: CategoryTotal) => void;
  /** Active Stats type — drives green (income) vs rust (expense) bars. */
  type: TransactionType;
};

export function CategoryBreakdownList({ data, onSelect, type }: Props) {
  if (data.length === 0) {
    return null;
  }

  const total = data.reduce((acc, row) => acc + row.sum, 0) || 1;
  const selectable = typeof onSelect === 'function';
  const amountColor = type === 'expense' ? colors.expense : colors.income;
  /** Income: bold the dominant source (RPC orders by sum desc). */
  const emphasizeDominant = type === 'income';

  return (
    <View style={styles.list}>
      {data.map((row, index) => {
        const pct = Math.round((row.sum / total) * 100);
        const emphasis = emphasizeDominant && index === 0;
        const label = `${row.category}, ${pct} percent, ${formatUsd(row.sum)}${
          selectable ? '. Open transactions.' : '.'
        }`;
        const body = (
          <>
            <View style={styles.top}>
              <StrongText
                style={[styles.category, emphasis && styles.categoryEmphasis]}
                numberOfLines={1}
              >
                {row.category}
              </StrongText>
              <View style={styles.figures}>
                <StrongText style={[styles.pct, { color: amountColor }]}>
                  {pct}%
                </StrongText>
                <CaptionText style={styles.amount}>
                  {formatUsd(row.sum)}
                </CaptionText>
              </View>
            </View>
            <View style={styles.track}>
              <View
                style={[
                  styles.fill,
                  {
                    width: `${Math.min(100, Math.max(0, pct))}%`,
                    backgroundColor: colorForCategory(index, type),
                  },
                ]}
              />
            </View>
          </>
        );

        if (!selectable) {
          return (
            <View
              key={row.category}
              style={styles.row}
              accessibilityLabel={label}
            >
              {body}
            </View>
          );
        }

        return (
          <Pressable
            key={row.category}
            onPress={() => onSelect(row)}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={label}
          >
            {body}
          </Pressable>
        );
      })}
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
  pressed: {
    backgroundColor: colors.surfaceMuted,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: space.sm,
  },
  category: {
    flex: 1,
    color: colors.ink,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: fonts.bodyStrong,
  },
  categoryEmphasis: {
    fontSize: 15,
    lineHeight: 20,
    fontFamily: fonts.amount,
  },
  figures: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: space.sm,
    flexShrink: 0,
  },
  pct: {
    ...typography.amount,
    fontSize: 13,
    lineHeight: 18,
  },
  amount: {
    color: colors.inkMuted,
    fontSize: 13,
    lineHeight: 18,
    fontVariant: ['tabular-nums'],
  },
  track: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.surfaceMuted,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 3,
  },
});
