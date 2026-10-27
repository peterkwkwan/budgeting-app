import { StyleSheet, View } from 'react-native';

import { CaptionText } from '@/components/StyledText';
import { colors, space } from '@/constants/theme';
import { useOfflineGates } from '@/hooks/useOfflineGates';

type OfflineBannerProps = {
  /**
   * `transactions` — Transactions / Add / Edit sync status.
   * `settings` — Account / Settings: offline disables some controls.
   */
  variant?: 'transactions' | 'settings';
};

/**
 * Thin paper status line. Transactions also shows pending/sync errors;
 * settings shows only while offline.
 */
export function OfflineBanner({ variant = 'transactions' }: OfflineBannerProps) {
  const { banner, settingsBanner } = useOfflineGates();
  const text = variant === 'settings' ? settingsBanner : banner;
  if (!text) return null;

  return (
    <View style={styles.bar} accessibilityRole="text">
      <CaptionText style={styles.text}>{text}</CaptionText>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: colors.surfaceMuted,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
  text: {
    color: colors.ink,
  },
});
