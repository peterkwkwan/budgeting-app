import { useRouter } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';

import { CaptionText, StrongText, TitleText } from '@/components/StyledText';
import { Text, View } from '@/components/Themed';
import { colors, fonts, radius, space, typography } from '@/constants/theme';
import { useAuth } from '@/lib/auth';

export default function AccountScreen() {
  const router = useRouter();
  const { user, profile, signOut } = useAuth();

  return (
    <View style={styles.container} lightColor={colors.green[50]} darkColor={colors.green[950]}>
      <TitleText style={styles.title}>Account</TitleText>

      <View style={styles.block} lightColor={colors.surfaceMuted} darkColor="#1a2a1f">
        <CaptionText style={styles.label}>Email</CaptionText>
        <StrongText style={styles.value}>{user?.email ?? '—'}</StrongText>

        <CaptionText style={styles.label}>Display name</CaptionText>
        <StrongText style={styles.value}>{profile?.display_name ?? '—'}</StrongText>

        <CaptionText style={styles.label}>Timezone</CaptionText>
        <StrongText style={styles.value}>{profile?.timezone ?? '—'}</StrongText>
      </View>

      <Pressable
        style={({ pressed }) => [
          styles.linkRow,
          pressed && styles.linkRowPressed,
        ]}
        onPress={() => router.push('/recurring')}
        accessibilityRole="button"
        accessibilityLabel="Manage recurring rules"
      >
        <StrongText style={styles.linkTitle}>Recurring rules</StrongText>
        <CaptionText style={styles.linkMeta}>
          Edit or stop series · add new ones from Ledger → Add → Repeat
        </CaptionText>
      </Pressable>

      <Text style={styles.note} lightColor={colors.inkMuted} darkColor={colors.green[200]}>
        Ledger data syncs from Supabase while online. Soft-deleted rows stay in
        the cloud but leave this device’s list. Recurring rules auto-add
        matching ledger entries for the next 90 days.
      </Text>

      <Pressable
        style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
        onPress={() => void signOut()}
        accessibilityRole="button"
        accessibilityLabel="Sign out"
      >
        <Text style={styles.buttonText} lightColor={colors.inkInverse} darkColor={colors.inkInverse}>
          Sign out
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: space.md,
    paddingVertical: space.lg,
    gap: space.md,
  },
  title: {
    color: colors.green[950],
  },
  block: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.green[200],
    padding: space.md,
    gap: space.xs,
  },
  label: {
    marginTop: space.sm,
    color: colors.inkMuted,
    textTransform: 'uppercase',
  },
  value: {
    color: colors.ink,
  },
  note: {
    ...typography.body,
    fontSize: 14,
    lineHeight: 20,
  },
  linkRow: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.green[200],
    backgroundColor: colors.surface,
    padding: space.md,
    gap: space.xs,
  },
  linkRowPressed: {
    backgroundColor: colors.surfaceMuted,
  },
  linkTitle: {
    color: colors.green[700],
  },
  linkMeta: {
    color: colors.inkMuted,
  },
  button: {
    marginTop: 'auto',
    backgroundColor: colors.green[700],
    height: 48,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPressed: {
    backgroundColor: colors.green[950],
    transform: [{ scale: 0.98 }],
  },
  buttonText: {
    fontFamily: fonts.bodyStrong,
    fontSize: 16,
    lineHeight: 24,
  },
});
