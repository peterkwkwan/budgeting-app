import { Stack } from 'expo-router';

import { colors, fonts } from '@/constants/theme';

export default function PlannerStackLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.canvas },
        headerTitleStyle: {
          fontFamily: fonts.title,
          color: colors.ink,
        },
        headerShadowVisible: false,
        headerTintColor: colors.green[700],
        contentStyle: { backgroundColor: colors.canvas },
      }}
    />
  );
}
