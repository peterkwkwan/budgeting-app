import { Stack } from 'expo-router';

import { colors, fonts } from '@/constants/theme';

export default function TransactionLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.green[50] },
        headerTitleStyle: {
          fontFamily: fonts.title,
          color: colors.ink,
        },
        headerShadowVisible: false,
        headerTintColor: colors.green[700],
        contentStyle: { backgroundColor: colors.green[50] },
      }}
    />
  );
}
