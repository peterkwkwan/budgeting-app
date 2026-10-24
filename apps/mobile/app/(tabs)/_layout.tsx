import { Tabs } from 'expo-router';

import { FudgetTabBar } from '@/components/FudgetTabBar';
import { useColorScheme } from '@/components/useColorScheme';
import { Colors, fonts, navHeaderStyle, space } from '@/constants/theme';

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
          borderTopColor: palette.chromeBorder,
        },
        tabBarLabelStyle: {
          fontFamily: fonts.caption,
          fontSize: 12,
          letterSpacing: 0.2,
        },
        headerStyle: {
          ...navHeaderStyle,
          backgroundColor: palette.background,
          borderBottomColor: palette.chromeBorder,
        },
        headerTitleStyle: {
          fontFamily: fonts.title,
          color: palette.text,
        },
        // Planner / Account use this title. Left edge is 16px, same inset as
        // the Transactions / Stats period header (see PeriodNavHeader).
        headerTitleAlign: 'left',
        headerTitleContainerStyle: {
          marginHorizontal: space.md,
        },
        headerShadowVisible: false,
        headerShown: true,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          // No page title — period month nav is the header (set in screen).
          title: '',
          headerTitle: '',
        }}
      />
      <Tabs.Screen
        name="stats"
        options={{
          // No page title — period nav is the header (set in screen).
          title: '',
          headerTitle: '',
        }}
      />
      <Tabs.Screen
        name="planner"
        options={{
          title: 'Planner',
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
