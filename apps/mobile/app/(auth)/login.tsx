import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/lib/auth';

export default function LoginScreen() {
  const { signInWithGoogle, configured } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onGooglePress() {
    setBusy(true);
    setError(null);
    const result = await signInWithGoogle();
    if (result.error) {
      setError(result.error);
    }
    setBusy(false);
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.brand}>Budgeting</Text>
        <Text style={styles.sub}>
          Sign in with Google to sync your ledger across devices.
        </Text>

        {!configured ? (
          <Text style={styles.hint}>
            Env not set yet. Copy apps/mobile/.env.example → .env and add your
            Supabase URL + anon key. See the root README founder checklist.
          </Text>
        ) : null}

        <Pressable
          style={[styles.button, busy && styles.buttonDisabled]}
          onPress={onGooglePress}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel="Sign in with Google"
        >
          {busy ? (
            <ActivityIndicator color="#fff" />
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
    backgroundColor: '#0f1c14',
  },
  container: {
    flex: 1,
    paddingHorizontal: 28,
    justifyContent: 'center',
    gap: 16,
  },
  brand: {
    fontSize: 40,
    fontWeight: '700',
    color: '#e8f5e9',
    letterSpacing: -0.5,
  },
  sub: {
    fontSize: 16,
    lineHeight: 24,
    color: '#b7c9bb',
    marginBottom: 12,
  },
  hint: {
    fontSize: 13,
    lineHeight: 20,
    color: '#c9a227',
    backgroundColor: '#1a2a1f',
    padding: 12,
    borderRadius: 8,
  },
  button: {
    marginTop: 8,
    backgroundColor: '#2e7d4f',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  error: {
    color: '#ff8a80',
    fontSize: 14,
    lineHeight: 20,
  },
});
