import { colors, space } from '@/constants/theme';

/**
 * Shared header chrome so Transactions + Stats put period nav in the top bar
 * (no large page title, full-width title slot).
 */
export const periodNavHeaderOptions = {
  title: '',
  headerTitleAlign: 'left' as const,
  headerTitleContainerStyle: {
    left: 0,
    right: 0,
    marginHorizontal: 0,
    paddingHorizontal: space.md,
    maxWidth: '100%' as const,
    width: '100%' as const,
  },
  headerStyle: {
    backgroundColor: colors.canvas,
  },
  headerShadowVisible: false,
};
