import { Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import { CaptionText, StrongText } from '@/components/StyledText';
import { colors, radius, space } from '@/constants/theme';
import { useAccountBackupStatus } from '@/hooks/useAccountBackup';
import { formatBackupDeadline } from '@/lib/accountData';

/**
 * Account (and similar) notice while a wipe backup is within the 30-day window.
 */
export function RestoreBackupBanner() {
  const router = useRouter();
  const { data } = useAccountBackupStatus();

  if (!data?.restoreAvailable || !data.expiresAt) {
    return null;
  }

  const until = formatBackupDeadline(data.expiresAt);

  return (
    <Pressable
      style={({ pressed }) => [styles.banner, pressed && styles.bannerPressed]}
      onPress={() => router.push('/settings')}
      accessibilityRole="button"
      accessibilityLabel={`Restore until ${until}. Open settings.`}
    >
      <View style={styles.copy}>
        <StrongText style={styles.title}>Restore until {until}</StrongText>
        <CaptionText style={styles.body}>
          You wiped your data. Open Settings to restore the backup, or keep
          using Fudget empty.
        </CaptionText>
      </View>
      <CaptionText style={styles.cta}>Settings</CaptionText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.green[200],
    backgroundColor: colors.green[50],
    padding: space.md,
    gap: space.sm,
    flexDirection: 'row',
    alignItems: 'center',
  },
  bannerPressed: {
    backgroundColor: colors.green[200],
  },
  copy: {
    flex: 1,
    gap: space.xs,
  },
  title: {
    color: colors.green[950],
  },
  body: {
    color: colors.inkMuted,
  },
  cta: {
    color: colors.green[700],
    fontWeight: '600',
  },
});
