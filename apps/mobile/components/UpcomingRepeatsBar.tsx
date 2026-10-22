import { Pressable, StyleSheet, View } from 'react-native';

import { CaptionText, StrongText } from '@/components/StyledText';
import { colors, fonts, radius, space, typography } from '@/constants/theme';
import type { UpcomingRepeatsSummary } from '@/lib/transactions';

type Props = {
  summary: UpcomingRepeatsSummary;
  onPress: () => void;
};

function formatMoney(n: number): string {
  return `$${n.toFixed(2)}`;
}

export function UpcomingRepeatsBar({ summary, onPress }: Props) {
  const parts: string[] = [];
  if (summary.expenseSum > 0) {
    parts.push(`−${formatMoney(summary.expenseSum)} expenses`);
  }
  if (summary.incomeSum > 0) {
    parts.push(`+${formatMoney(summary.incomeSum)} income`);
  }
  const totalsLine =
    parts.length > 0
      ? parts.join(' · ')
      : `${summary.count} upcoming`;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.bar, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={`Upcoming repeats this month. ${summary.namesLabel}. ${totalsLine}. Manage recurring rules.`}
    >
      <View style={styles.textCol}>
        <StrongText style={styles.title}>Upcoming repeats</StrongText>
        <CaptionText style={styles.names} numberOfLines={1}>
          {summary.namesLabel}
          {summary.datesLabel ? ` · ${summary.datesLabel}` : ''}
        </CaptionText>
        <CaptionText style={styles.meta}>
          {summary.count} this month · {totalsLine}
        </CaptionText>
      </View>
      <CaptionText style={styles.chevron}>Manage</CaptionText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    marginHorizontal: space.md,
    marginTop: space.md,
    marginBottom: space.sm,
    paddingVertical: space.sm + 4,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.green[200],
    backgroundColor: colors.surfaceMuted,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  pressed: {
    backgroundColor: colors.green[200],
  },
  textCol: {
    flex: 1,
    gap: 2,
  },
  title: {
    color: colors.green[950],
    fontSize: 15,
    lineHeight: 20,
  },
  names: {
    color: colors.ink,
  },
  meta: {
    color: colors.inkMuted,
    ...typography.caption,
  },
  chevron: {
    color: colors.green[700],
    fontFamily: fonts.bodyStrong,
  },
});
