import { Stack } from 'expo-router';

export default function AuthDeepLinkLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="callback" />
    </Stack>
  );
}
