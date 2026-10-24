import 'react-native-gesture-handler';

import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_600SemiBold,
  DMSans_700Bold,
} from '@expo-google-fonts/dm-sans';
import { Fraunces_600SemiBold } from '@expo-google-fonts/fraunces';
import { useFonts } from 'expo-font';
import { DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';

import { colors } from '@/constants/theme';
import { useCatchUpRecurring } from '@/hooks/useCatchUpRecurring';
import { AuthProvider, useAuth } from '@/lib/auth';
import { AppQueryProvider } from '@/lib/query';

export { ErrorBoundary } from 'expo-router';

SplashScreen.preventAutoHideAsync();

const FudgetNavTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: colors.green[700],
    background: colors.canvas,
    card: colors.surface,
    text: colors.ink,
    border: colors.chromeBorder,
    notification: colors.green[700],
  },
};

/** Keep native splash up until fonts + auth session are ready. */
function SplashController({ fontsReady }: { fontsReady: boolean }) {
  const { loading } = useAuth();

  useEffect(() => {
    if (fontsReady && !loading) {
      void SplashScreen.hideAsync();
    }
  }, [fontsReady, loading]);

  return null;
}

/**
 * Always mount the root Stack on first render. AuthGate used to swap the
 * Stack for a spinner, which left screens (e.g. Transactions) calling useRouter()
 * outside NavigationContainer.
 */
function RootNavigator() {
  const { session } = useAuth();
  // Fill missing recurring transaction rows when signed in / returning to app.
  useCatchUpRecurring();

  return (
    <Stack>
      {/* Cold launch resolves `/`. `(tabs)/index` owns `/` when signed in;
          `(auth)/index` must own `/` when signed out (session is null on
          first paint), or Expo Router shows +not-found. */}
      {/* Always mounted: Google OAuth returns to fudget://auth/callback →
          `/auth/callback`. Must not live under Stack.Protected or the handoff
          404s before session flips. */}
      <Stack.Screen name="auth" options={{ headerShown: false }} />
      <Stack.Protected guard={!!session}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="transaction" options={{ headerShown: false }} />
        <Stack.Screen name="stats" options={{ headerShown: false }} />
        <Stack.Screen name="planner" options={{ headerShown: false }} />
        <Stack.Screen name="recurring" options={{ headerShown: false }} />
        <Stack.Screen name="settings" options={{ headerShown: false }} />
      </Stack.Protected>
      <Stack.Protected guard={!session}>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Fraunces_600SemiBold,
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_600SemiBold,
    DMSans_700Bold,
  });

  const fontsReady = fontsLoaded || fontError != null;

  return (
    <GestureHandlerRootView style={styles.root}>
      <AppQueryProvider>
        <AuthProvider>
          <ThemeProvider value={FudgetNavTheme}>
            <SplashController fontsReady={fontsReady} />
            <RootNavigator />
          </ThemeProvider>
        </AuthProvider>
      </AppQueryProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
