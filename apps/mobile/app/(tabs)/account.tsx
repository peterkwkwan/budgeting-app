import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Pressable, ScrollView, StyleSheet } from 'react-native';

import { PartnerSection } from '@/components/PartnerSection';
import { CaptionText, StrongText, TitleText } from '@/components/StyledText';
import { Text, View } from '@/components/Themed';
import { colors, fonts, radius, space, typography } from '@/constants/theme';
import { useAuth } from '@/lib/auth';

/** Public privacy policy (GitHub Pages → /docs). Same URL as Play Console. */
const PRIVACY_POLICY_URL = 'https://peterkwkwan.github.io/fudget/privacy.html';

export default function AccountScreen() {
  const router = useRouter();
  const { user, profile, signOut } = useAuth();

  const openPrivacyPolicy = () => {
    void WebBrowser.openBrowserAsync(PRIVACY_POLICY_URL);
  };

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
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

      <PartnerSection />

      <Pressable
        style={({ pressed }) => [
          styles.linkRow,
          pressed && styles.linkRowPressed,
        ]}
        onPress={openPrivacyPolicy}
        accessibilityRole="link"
        accessibilityLabel="Open privacy policy"
      >
        <StrongText style={styles.linkTitle}>Privacy policy</StrongText>
        <CaptionText style={styles.linkMeta}>
          How Fudget handles your data · opens in your browser
        </CaptionText>
      </Pressable>

      <Text style={styles.note} lightColor={colors.inkMuted} darkColor={colors.green[200]}>
        Ledger data syncs from Supabase while online. Soft-deleted rows stay in
        the cloud but leave this device’s list. Recurring rules auto-add
        matching ledger entries about 90 days ahead (or until a series ends).
        Partner stats are combined totals only — never each other’s rows.
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: colors.green[50],
  },
  container: {
    paddingHorizontal: space.md,
    paddingVertical: space.lg,
    gap: space.md,
    paddingBottom: space.xxl,
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
    marginTop: space.md,
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
