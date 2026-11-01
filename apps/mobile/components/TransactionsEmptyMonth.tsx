import { StyleSheet, View } from 'react-native';

import { CaptionText, TitleText } from '@/components/StyledText';
import { colors, space, typography } from '@/constants/theme';

type Props = {
  /** Period nav label, e.g. "December". */
  periodLabel: string;
};

/**
 * Full empty-month screen for Transactions (current card + adjacent peeks).
 * Title + supporting copy — same pattern as the settled empty list state.
 */
export function TransactionsEmptyMonth({ periodLabel }: Props) {
  return (
    <View style={styles.empty} accessibilityRole="summary">
      <TitleText style={styles.emptyTitle}>
        No transactions in {periodLabel}
      </TitleText>
      <CaptionText style={styles.emptyBody}>
        Tap + to add an expense or income. On the Add screen you can type it, or
        tap the mic to speak a draft before saving. It syncs for every device on
        this account.
      </CaptionText>
    </View>
  );
}

const styles = StyleSheet.create({
  empty: {
    // flexGrow so ListEmptyComponent and full-screen loading share centering.
    flexGrow: 1,
    width: '100%',
    paddingHorizontal: space.xl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
  },
  emptyTitle: {
    color: colors.green[950],
    textAlign: 'center',
  },
  emptyBody: {
    color: colors.inkMuted,
    textAlign: 'center',
    ...typography.body,
    fontSize: 14,
    lineHeight: 20,
  },
});
