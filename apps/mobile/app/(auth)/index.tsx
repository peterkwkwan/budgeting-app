import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, fonts, radius, space, typography } from '@/constants/theme';
import { useAuth } from '@/lib/auth';

const MARK = require('../../assets/images/fudget-mark-g.png');

export default function LoginScreen() {
  const router = useRouter();
  const { signInWithGoogle, configured } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onGooglePress() {
    setBusy(true);
    setError(null);
    const result = await signInWithGoogle();
    if (result.error) {
      setError(result.error);
      setBusy(false);
      return;
    }
    // Belt-and-suspenders with auth/callback Redirect: if the WebBrowser
    // return path did not navigate the router, land on Transactions (`/`).
    router.replace('/');
    setBusy(false);
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.hero}>
          <Image
            source={MARK}
            style={styles.mark}
            accessibilityLabel="Fudget"
            accessibilityRole="image"
          />
          <Text style={styles.brand}>Fudget</Text>
          <View
            style={styles.sloganRow}
            accessible
            accessibilityRole="text"
            accessibilityLabel="Track. Save. Grow."
          >
            <Text style={[styles.sloganWord, styles.sloganTrack]}>Track.</Text>
            <Text style={[styles.sloganWord, styles.sloganSave]}>Save.</Text>
            <Text style={[styles.sloganWord, styles.sloganGrow]}>Grow.</Text>
          </View>
          <Text style={styles.sub}>
            Sign in with Google to sync your transactions across devices.
          </Text>

          {!configured ? (
            <Text style={styles.hint}>
              Env not set yet. Copy apps/mobile/.env.example → .env and add your
              Supabase URL + anon key. See the root README founder checklist.
            </Text>
          ) : null}

          <Pressable
            style={({ pressed }) => [
              styles.button,
              busy && styles.buttonDisabled,
              pressed && !busy && styles.buttonPressed,
            ]}
            onPress={onGooglePress}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel="Sign in with Google"
          >
            {busy ? (
              <ActivityIndicator color={colors.inkInverse} />
            ) : (
              <Text style={styles.buttonText}>Continue with Google</Text>
            )}
          </Pressable>

          {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  container: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: space.lg,
  },
  hero: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    // Nudge the cluster slightly above true center (Centered Mark mockup).
    marginTop: -24,
  },
  mark: {
    width: 148,
    height: 148,
    marginBottom: space.md,
  },
  brand: {
    ...typography.display,
    color: colors.green[950],
    textAlign: 'center',
    // Full hero width. A shrink-wrapped box is measured short on Android, so
    // the last glyph is clipped ("Fudget" draws as "Fudge").
    alignSelf: 'stretch',
    marginBottom: 8,
  },
  sloganRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 14,
  },
  sloganWord: {
    fontFamily: fonts.bodyStrong,
    fontSize: 15,
    lineHeight: 22,
    letterSpacing: 0.4,
  },
  sloganTrack: {
    color: colors.green[950],
  },
  sloganSave: {
    color: colors.green[700],
  },
  sloganGrow: {
    color: colors.green[400],
  },
  sub: {
    ...typography.body,
    fontSize: 15,
    lineHeight: 22,
    color: colors.inkMuted,
    textAlign: 'center',
    maxWidth: 260,
  },
  hint: {
    ...typography.caption,
    color: colors.warning,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.sm + 4,
    borderRadius: radius.sm,
    marginTop: space.md,
    alignSelf: 'stretch',
    textAlign: 'center',
  },
  button: {
    marginTop: 28,
    alignSelf: 'stretch',
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
  buttonDisabled: {
    backgroundColor: colors.surfaceMuted,
  },
  buttonText: {
    fontFamily: fonts.bodyStrong,
    fontSize: 16,
    lineHeight: 24,
    color: colors.inkInverse,
    letterSpacing: 0.1,
    textAlign: 'center',
    // Same Android clip as the wordmark: "Continue with Google" draws as
    // "Continue with Goog" when the label hugs its measured width.
    alignSelf: 'stretch',
  },
  error: {
    ...typography.caption,
    color: colors.danger,
    textAlign: 'center',
    marginTop: space.sm,
  },
});
