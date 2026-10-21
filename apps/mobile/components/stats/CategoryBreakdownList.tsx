import { Pressable, StyleSheet, View } from 'react-native';

import { CaptionText, StrongText } from '@/components/StyledText';
import { colorForCategory } from '@/constants/chartColors';
import { colors, radius, space, typography } from '@/constants/theme';
import type { CategoryTotal } from '@/lib/stats';

type Props = {
  data: CategoryTotal[];
  onSelect: (row: CategoryTotal) => void;
};

function formatMoney(n: number): string {
  return `$${n.toFixed(2)}`;
}

export function CategoryBreakdownList({ data, onSelect }: Props) {
  if (data.length === 0) {
    return null;
  }

  const total = data.reduce((acc, row) => acc + row.sum, 0) || 1;

  return (
    <View style={styles.list}>
      {data.map((row, index) => {
        const pct = Math.round((row.sum / total) * 100);
        return (
          <Pressable
            key={row.category}
            onPress={() => onSelect(row)}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={`${row.category}, ${formatMoney(row.sum)}, ${pct} percent. Open transactions.`}
          >
            <View
              style={[styles.swatch, { backgroundColor: colorForCategory(index) }]}
            />
            <View style={styles.mid}>
              <StrongText style={styles.category}>{row.category}</StrongText>
              <CaptionText style={styles.meta}>
                {row.count} {row.count === 1 ? 'entry' : 'entries'} · {pct}%
              </CaptionText>
            </View>
            <StrongText style={styles.amount}>{formatMoney(row.sum)}</StrongText>
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
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingVertical: space.sm + 2,
    borderBottomWidth: 1,
    borderBottomColor: colors.green[200],
  },
  pressed: {
    backgroundColor: colors.surfaceMuted,
  },
  swatch: {
    width: 12,
    height: 12,
    borderRadius: radius.sm / 2,
  },
  mid: {
    flex: 1,
    gap: 2,
  },
  category: {
    color: colors.ink,
  },
  meta: {
    color: colors.inkMuted,
  },
  amount: {
    ...typography.amount,
    fontSize: 16,
    lineHeight: 22,
    color: colors.ink,
  },
});
