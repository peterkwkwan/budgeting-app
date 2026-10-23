import { Stack } from 'expo-router';

import { colors, fonts, navHeaderStyle } from '@/constants/theme';

export default function RecurringLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: navHeaderStyle,
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
