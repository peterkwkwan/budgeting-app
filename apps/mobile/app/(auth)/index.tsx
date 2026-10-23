import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, fonts, radius, space, typography } from '@/constants/theme';
import { useAuth } from '@/lib/auth';

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
        <Text style={styles.brand}>Fudget</Text>
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
    paddingHorizontal: space.md,
    justifyContent: 'center',
    gap: space.md,
  },
  brand: {
    ...typography.display,
    fontSize: 40,
    lineHeight: 46,
    color: colors.green[950],
  },
  sub: {
    ...typography.body,
    color: colors.inkMuted,
    marginBottom: space.sm,
  },
  hint: {
    ...typography.caption,
    color: colors.warning,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.sm + 4,
    borderRadius: radius.sm,
  },
  button: {
    marginTop: space.sm,
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
  },
  error: {
    ...typography.caption,
    color: colors.danger,
  },
});
