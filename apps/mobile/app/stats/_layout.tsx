import { Stack } from 'expo-router';

import { colors, fonts, navHeaderStyle } from '@/constants/theme';

export default function StatsStackLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: navHeaderStyle,
        headerTitleStyle: {
          fontFamily: fonts.title,
          color: colors.ink,
        },
        headerTintColor: colors.green[700],
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.canvas },
      }}
    >
      <Stack.Screen
        name="category"
        options={{ title: 'Category' }}
      />
    </Stack>
  );
}
