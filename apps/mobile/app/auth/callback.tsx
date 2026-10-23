import { Redirect } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { colors } from '@/constants/theme';
import { useAuth } from '@/lib/auth';

/**
 * OAuth return path for `fudget://auth/callback` (see makeRedirectUri in
 * lib/auth.tsx). Expo Router joins host+pathname → `/auth/callback`. Without
 * this screen, Google sign-in lands on +not-found (“Oops!”).
 *
 * Tokens are applied by AuthProvider; once `session` exists, send the user to
 * `/` → `(tabs)/index` (Transactions).
 */
export default function AuthCallbackScreen() {
  const { session } = useAuth();

  if (session) {
    return <Redirect href="/" />;
  }

  return (
    <View style={styles.centered} accessibilityLabel="Finishing sign-in">
      <ActivityIndicator size="large" color={colors.green[700]} />
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.canvas,
  },
});
