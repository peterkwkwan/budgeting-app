import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  BarsIcon,
  FlagIcon,
  ListIcon,
  PlusIcon,
  UserIcon,
} from '@/components/icons';
import { colors, fonts, space } from '@/constants/theme';

const FAB_SIZE = 60;
const FAB_GAP = 56;

type FudgetTabBarProps = {
  state: {
    index: number;
    routes: { key: string; name: string }[];
  };
  /** Called with the route key; parent handles emit + navigateToTab. */
  onTabPress: (routeKey: string) => void;
};

const TABS: {
  route: string;
  label: string;
  Icon: typeof ListIcon;
}[] = [
  { route: 'index', label: 'Transactions', Icon: ListIcon },
  { route: 'stats', label: 'Stats', Icon: BarsIcon },
  { route: 'planner', label: 'Planner', Icon: FlagIcon },
  { route: 'account', label: 'Account', Icon: UserIcon },
];

/**
 * Concept B tab bar: Transactions · raised Add FAB · Stats · Planner · Account.
 * FAB gently pulses brand rings/scale unless reduce-motion is on.
 */
export function FudgetTabBar({ state, onTabPress }: FudgetTabBarProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [reduceMotion, setReduceMotion] = useState(false);
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) setReduceMotion(enabled);
    });
    const sub = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduceMotion
    );
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);

  useEffect(() => {
    if (reduceMotion) {
      pulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1400,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 1400,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, reduceMotion]);

  const fabScale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.06],
  });
  const ringScale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1.08, 1.22],
  });
  const ringOpacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.18, 0.46],
  });
  const softRingOpacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.08, 0.2],
  });

  function renderTab(routeName: string) {
    const meta = TABS.find((t) => t.route === routeName);
    if (!meta) return null;
    const routeIndex = state.routes.findIndex((r) => r.name === routeName);
    if (routeIndex < 0) return null;
    const route = state.routes[routeIndex];
    const focused = state.index === routeIndex;
    const color = focused ? colors.green[700] : colors.inkMuted;
    const { Icon } = meta;

    return (
      <Pressable
        key={routeName}
        style={styles.tab}
        onPress={() => {
          if (!focused) onTabPress(route.key);
        }}
        accessibilityRole="button"
        accessibilityState={{ selected: focused }}
        accessibilityLabel={meta.label}
      >
        <Icon color={color} size={22} />
        <Text
          style={[
            styles.tabLabel,
            { color, fontFamily: focused ? fonts.bodyStrong : fonts.caption },
          ]}
        >
          {meta.label}
        </Text>
      </Pressable>
    );
  }

  return (
    <View
      style={[
        styles.bar,
        { paddingBottom: Math.max(insets.bottom, space.sm) },
      ]}
    >
      <View style={styles.fabWrap} pointerEvents="box-none">
        {!reduceMotion ? (
          <>
            <Animated.View
              pointerEvents="none"
              style={[
                styles.fabSoftRing,
                {
                  opacity: softRingOpacity,
                  transform: [{ scale: ringScale }],
                },
              ]}
            />
            <Animated.View
              pointerEvents="none"
              style={[
                styles.fabRing,
                {
                  opacity: ringOpacity,
                  transform: [
                    {
                      scale: pulse.interpolate({
                        inputRange: [0, 1],
                        outputRange: [1.02, 1.12],
                      }),
                    },
                  ],
                },
              ]}
            />
          </>
        ) : null}
        <Animated.View
          style={{ transform: [{ scale: reduceMotion ? 1 : fabScale }] }}
        >
          <Pressable
            style={({ pressed }) => [
              styles.fab,
              pressed && styles.fabPressed,
            ]}
            onPress={() => router.push('/transaction/new')}
            accessibilityRole="button"
            accessibilityLabel="Add transaction"
          >
            <PlusIcon color={colors.inkInverse} size={30} />
          </Pressable>
        </Animated.View>
      </View>

      <View style={styles.row}>
        {renderTab('index')}
        <View style={styles.fabGap} />
        {renderTab('stats')}
        {renderTab('planner')}
        {renderTab('account')}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 4,
    paddingTop: 10,
    paddingBottom: 6,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 4,
    minHeight: 44,
  },
  tabLabel: {
    fontSize: 11,
    letterSpacing: 0.2,
  },
  fabGap: {
    width: FAB_GAP,
    flexShrink: 0,
  },
  fabWrap: {
    position: 'absolute',
    left: '50%',
    top: -28,
    marginLeft: -FAB_SIZE / 2,
    width: FAB_SIZE,
    height: FAB_SIZE,
    zIndex: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabSoftRing: {
    position: 'absolute',
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    backgroundColor: colors.green[700],
  },
  fabRing: {
    position: 'absolute',
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    borderWidth: 2,
    borderColor: colors.green[700],
  },
  fab: {
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    backgroundColor: colors.green[700],
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: colors.canvas,
  },
  fabPressed: {
    backgroundColor: colors.green[950],
    transform: [{ scale: 0.98 }],
  },
});
