import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, space } from '@/constants/theme';

/** Reserve room so left-aligned period controls don’t sit under a top-right gear. */
const TRAILING_SLOT = 44;

/**
 * Shared header chrome: period nav replaces the page title on
 * Transactions + Stats. Full custom header so titles cannot linger.
 * Period cluster is left-aligned; optional `trailing` (gear) stays right.
 */
export function PeriodNavHeader({
  children,
  trailing,
}: {
  children: ReactNode;
  /** Optional top-right control (e.g. settings gear) on the same row. */
  trailing?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        styles.wrap,
        {
          paddingTop: Math.max(insets.top, space.sm),
          backgroundColor: colors.canvas,
        },
      ]}
    >
      <View style={styles.row}>
        <View style={styles.nav}>{children}</View>
        <View style={styles.trailingSlot}>
          {trailing ? trailing : null}
        </View>
      </View>
    </View>
  );
}

/** Options that hide the default title and install our full header. */
export function periodNavScreenOptions(header: () => ReactNode) {
  return {
    title: '',
    headerTitle: '',
    headerShown: true as const,
    headerShadowVisible: false,
    headerStyle: {
      backgroundColor: colors.canvas,
    },
    header,
  };
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.canvas,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  row: {
    minHeight: 44,
    paddingLeft: space.md,
    paddingRight: space.sm,
    paddingBottom: space.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  nav: {
    flex: 1,
    minWidth: 0,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  trailingSlot: {
    width: TRAILING_SLOT,
    minHeight: TRAILING_SLOT,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
