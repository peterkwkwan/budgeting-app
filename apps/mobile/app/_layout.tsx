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
import 'react-native-reanimated';

import { colors } from '@/constants/theme';
import { AuthProvider, useAuth } from '@/lib/auth';
import { AppQueryProvider } from '@/lib/query';

export { ErrorBoundary } from 'expo-router';

SplashScreen.preventAutoHideAsync();

const FudgetNavTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: colors.green[700],
    background: colors.green[50],
    card: colors.surface,
    text: colors.ink,
    border: colors.green[200],
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
 * Stack for a spinner, which left screens (e.g. Ledger) calling useRouter()
 * outside NavigationContainer.
 */
function RootNavigator() {
  const { session } = useAuth();

  return (
    <Stack>
      <Stack.Protected guard={!!session}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="transaction" options={{ headerShown: false }} />
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
    <AppQueryProvider>
      <AuthProvider>
        <ThemeProvider value={FudgetNavTheme}>
          <SplashController fontsReady={fontsReady} />
          <RootNavigator />
        </ThemeProvider>
      </AuthProvider>
    </AppQueryProvider>
  );
}
