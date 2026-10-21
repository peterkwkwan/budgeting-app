import { Tabs } from 'expo-router';

import { useColorScheme } from '@/components/useColorScheme';
import { Colors, fonts } from '@/constants/theme';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const palette = Colors[colorScheme ?? 'light'];

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: palette.tint,
        tabBarInactiveTintColor: palette.tabIconDefault,
        tabBarStyle: {
          backgroundColor: palette.surface,
          borderTopColor: palette.border,
        },
        tabBarLabelStyle: {
          fontFamily: fonts.caption,
          fontSize: 12,
        },
        headerStyle: {
          backgroundColor: palette.background,
        },
        headerTitleStyle: {
          fontFamily: fonts.title,
          color: palette.text,
        },
        headerShadowVisible: false,
        headerShown: true,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
        }}
      />
    </Tabs>
  );
}
