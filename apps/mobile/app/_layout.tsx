import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_600SemiBold,
  DMSans_700Bold,
} from '@expo-google-fonts/dm-sans';
import { Fraunces_600SemiBold } from '@expo-google-fonts/fraunces';
import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, type ReactNode } from 'react';
import { ActivityIndicator, View } from 'react-native';
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

function AuthGate({
  children,
  fontsReady,
}: {
  children: ReactNode;
  fontsReady: boolean;
}) {
  const { session, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const ready = fontsReady && !loading;

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!session && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (session && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [session, loading, segments, router]);

  useEffect(() => {
    if (ready) {
      SplashScreen.hideAsync();
    }
  }, [ready]);

  if (!ready) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.green[50],
        }}
      >
        <ActivityIndicator size="large" color={colors.green[700]} />
      </View>
    );
  }

  return <>{children}</>;
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
          <AuthGate fontsReady={fontsReady}>
            <Stack>
              <Stack.Screen name="(auth)" options={{ headerShown: false }} />
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="transaction" options={{ headerShown: false }} />
            </Stack>
          </AuthGate>
        </ThemeProvider>
      </AuthProvider>
    </AppQueryProvider>
  );
}
