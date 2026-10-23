import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { chromeHairline, colors, space } from '@/constants/theme';

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
      <View
        style={[
          styles.row,
          // No gear: tighter right gutter so Stats mode dropdown sits nearer the edge.
          // With gear: keep sm padding + reserved slot so the control stays clear.
          !trailing && styles.rowNoTrailing,
        ]}
      >
        <View style={styles.nav}>{children}</View>
        {trailing ? (
          <View style={styles.trailingSlot}>{trailing}</View>
        ) : null}
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
      // Custom header draws its own chrome hairline.
      borderBottomWidth: 0,
      elevation: 0,
      shadowOpacity: 0,
    },
    header,
  };
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.canvas,
    borderBottomWidth: chromeHairline.width,
    borderBottomColor: chromeHairline.color,
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
  rowNoTrailing: {
    // Pull period chrome (esp. Stats Monthly/Yearly/Period) closer to the edge.
    paddingRight: space.xs,
    gap: 0,
  },
  nav: {
    flex: 1,
    minWidth: 0,
    // Stretch so Stats can space-between left period + right mode dropdown.
    alignItems: 'stretch',
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
