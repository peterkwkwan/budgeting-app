/**
 * Fudget design tokens — source of truth aligned with docs/design-system.md
 */

export const colors = {
  green: {
    950: '#004d00',
    700: '#007a33',
    400: '#66b3a1',
    200: '#b2e0d4',
    50: '#e0f7f1',
  },
  /** Warm rust scale for expense charts (spend). */
  rust: {
    950: '#7c2d12',
    700: '#9a3412',
    500: '#c2410c',
    400: '#ea580c',
    200: '#fdba74',
  },
  ink: '#0a1f14',
  inkMuted: '#3d5c4a',
  inkInverse: '#ffffff',
  surface: '#ffffff',
  surfaceMuted: '#f3faf7',
  danger: '#b42318',
  warning: '#b54708',
  /** Ledger / totals amount color for income (aligns with green.700). */
  income: '#007a33',
  /** Ledger / totals amount color for expense (aligns with rust.700). */
  expense: '#9a3412',
  overlay: 'rgba(10, 31, 20, 0.45)',
  /** @deprecated Use colors.rust[500] — kept for any stray imports. */
  chartWarm: '#c2410c',
} as const;

export const space = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 20,
  full: 999,
} as const;

/** Loaded via @expo-google-fonts — family names match useFonts keys. */
export const fonts = {
  display: 'Fraunces_600SemiBold',
  title: 'Fraunces_600SemiBold',
  body: 'DMSans_400Regular',
  bodyStrong: 'DMSans_600SemiBold',
  caption: 'DMSans_500Medium',
  amount: 'DMSans_700Bold',
} as const;

export const typography = {
  display: {
    fontFamily: fonts.display,
    fontSize: 28,
    lineHeight: 34,
  },
  title: {
    fontFamily: fonts.title,
    fontSize: 22,
    lineHeight: 28,
  },
  body: {
    fontFamily: fonts.body,
    fontSize: 16,
    lineHeight: 24,
  },
  bodyStrong: {
    fontFamily: fonts.bodyStrong,
    fontSize: 16,
    lineHeight: 24,
  },
  caption: {
    fontFamily: fonts.caption,
    fontSize: 13,
    lineHeight: 18,
  },
  amount: {
    fontFamily: fonts.amount,
    fontSize: 20,
    lineHeight: 26,
    fontVariant: ['tabular-nums'] as const,
  },
} as const;

export const shadow = {
  sm: {
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
} as const;

/** Navigation / Themed light+dark maps (MVP ships light; dark mapped to brand neutrals). */
export const Colors = {
  light: {
    text: colors.ink,
    background: colors.green[50],
    tint: colors.green[700],
    tabIconDefault: colors.inkMuted,
    tabIconSelected: colors.green[700],
    border: colors.green[200],
    surface: colors.surface,
    surfaceMuted: colors.surfaceMuted,
    danger: colors.danger,
    warning: colors.warning,
  },
  dark: {
    text: colors.inkInverse,
    background: colors.green[950],
    tint: colors.green[400],
    tabIconDefault: colors.green[200],
    tabIconSelected: colors.green[400],
    border: colors.green[700],
    surface: '#0f1c14',
    surfaceMuted: '#1a2a1f',
    danger: '#ff8a80',
    warning: '#fbbf24',
  },
} as const;

export type ThemeColorName = keyof typeof Colors.light;

export const theme = {
  colors,
  space,
  radius,
  fonts,
  typography,
  shadow,
  Colors,
} as const;

export default theme;
