import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { chromeHairline, colors, fonts, space } from '@/constants/theme';

/** Reserve room so left-aligned period controls don’t sit under a top-right gear. */
const TRAILING_SLOT = 44;

type NavHeaderChromeProps = {
  children: ReactNode;
  /** Optional top-right control (e.g. settings gear) on the same row. */
  trailing?: ReactNode;
};

/**
 * Shared tab header chrome (safe-area + 44pt row + bottom pad + hairline).
 * Source of truth for header bar height across Transactions, Stats, Planner,
 * and Account — keep padding/minHeight in sync here only.
 */
function NavHeaderChrome({ children, trailing }: NavHeaderChromeProps) {
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
        {trailing ? (
          <View style={styles.trailingSlot}>{trailing}</View>
        ) : null}
      </View>
    </View>
  );
}

/**
 * Period nav replaces the page title on Transactions + Stats.
 * Full custom header so default titles cannot linger.
 * Period cluster is left-aligned; optional `trailing` (gear) stays right.
 */
export function PeriodNavHeader({
  children,
  trailing,
}: NavHeaderChromeProps) {
  return <NavHeaderChrome trailing={trailing}>{children}</NavHeaderChrome>;
}

/**
 * Titled tab header (Planner / Account) — same chrome height as PeriodNavHeader.
 */
export function TitleNavHeader({
  title,
  trailing,
}: {
  title: string;
  trailing?: ReactNode;
}) {
  return (
    <NavHeaderChrome trailing={trailing}>
      <Text
        style={styles.title}
        numberOfLines={1}
        accessibilityRole="header"
      >
        {title}
      </Text>
    </NavHeaderChrome>
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
    // Symmetric insets: left chevron cluster and right mode dropdown share md.
    paddingLeft: space.md,
    paddingRight: space.md,
    paddingBottom: space.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
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
  title: {
    color: colors.ink,
    fontFamily: fonts.title,
    // Match PeriodSelector navLabel so titled tabs share the period row height.
    fontSize: 17,
    lineHeight: 22,
    textAlign: 'left',
  },
});
