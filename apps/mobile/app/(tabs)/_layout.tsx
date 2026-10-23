import { Tabs } from 'expo-router';

import { FudgetTabBar } from '@/components/FudgetTabBar';
import { useColorScheme } from '@/components/useColorScheme';
import { Colors, fonts } from '@/constants/theme';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const palette = Colors[colorScheme ?? 'light'];

  return (
    <Tabs
      tabBar={(props) => (
        <FudgetTabBar
          state={props.state}
          onTabPress={(routeKey) => {
            const route = props.state.routes.find((r) => r.key === routeKey);
            if (!route) return;
            const event = props.emitter.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!event.defaultPrevented) {
              props.navigateToTab(route.key);
            }
          }}
        />
      )}
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
          letterSpacing: 0.2,
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
          title: 'Transactions',
        }}
      />
      <Tabs.Screen
        name="stats"
        options={{
          title: 'Stats',
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: 'Account',
        }}
      />
    </Tabs>
  );
}
