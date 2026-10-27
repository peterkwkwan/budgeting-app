import { StyleSheet, View } from 'react-native';

import { CaptionText } from '@/components/StyledText';
import { colors, space } from '@/constants/theme';
import { useOfflineGates } from '@/hooks/useOfflineGates';

/**
 * Thin status line on Transactions and Add/Edit.
 * Renders nothing while the flag is off, and while online with an empty outbox.
 */
export function OfflineBanner() {
  const { banner } = useOfflineGates();
  if (!banner) return null;

  return (
    <View style={styles.bar} accessibilityRole="text">
      <CaptionText style={styles.text}>{banner}</CaptionText>
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
