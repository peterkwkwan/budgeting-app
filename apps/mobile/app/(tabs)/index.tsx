import { Pressable, StyleSheet } from 'react-native';

import { Text, View } from '@/components/Themed';
import { colors, fonts, radius, space, typography } from '@/constants/theme';
import { useAuth } from '@/lib/auth';

export default function HomeScreen() {
  const { user, profile, signOut } = useAuth();

  return (
    <View style={styles.container} lightColor={colors.green[50]} darkColor={colors.green[950]}>
      <Text style={styles.title}>You are signed in</Text>

      <View style={styles.block} lightColor={colors.surfaceMuted} darkColor="#1a2a1f">
        <Text style={styles.label} lightColor={colors.inkMuted} darkColor={colors.green[200]}>
          Email
        </Text>
        <Text style={styles.value}>{user?.email ?? '—'}</Text>

        <Text style={styles.label} lightColor={colors.inkMuted} darkColor={colors.green[200]}>
          Display name
        </Text>
        <Text style={styles.value}>{profile?.display_name ?? '—'}</Text>

        <Text style={styles.label} lightColor={colors.inkMuted} darkColor={colors.green[200]}>
          Timezone
        </Text>
        <Text style={styles.value}>{profile?.timezone ?? '—'}</Text>
      </View>

      <Text style={styles.note} lightColor={colors.inkMuted} darkColor={colors.green[200]}>
        M0 scaffold: auth + profile only. Ledger, stats, recurring, and partner
        land in later milestones.
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
    ...typography.title,
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
    ...typography.caption,
    textTransform: 'uppercase',
  },
  value: {
    ...typography.bodyStrong,
  },
  note: {
    ...typography.body,
    fontSize: 14,
    lineHeight: 20,
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
