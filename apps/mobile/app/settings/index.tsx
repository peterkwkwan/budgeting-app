import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';

import { AccountDangerZone } from '@/components/AccountDangerZone';
import { DateViewToggle } from '@/components/DateViewToggle';
import { OfflineBanner } from '@/components/OfflineBanner';
import {
  ScrollEdgeHost,
  useScrollEdges,
} from '@/components/ScrollEdgeShadows';
import { CaptionText, StrongText } from '@/components/StyledText';
import { currencyLabel } from '@/constants/currencies';
import { colors, radius, space } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { profileCurrency } from '@/lib/currency';
import {
  DEFAULT_TRANSACTIONS_DATE_VIEW,
  parseTransactionsDateView,
  updateTransactionsDateView,
  type TransactionsDateView,
} from '@/lib/profile';

/**
 * Account → Settings / Preferences.
 * Currency, categories, date layout, danger zone.
 */
export default function SettingsScreen() {
  const router = useRouter();
  const { user, profile, refreshProfile } = useAuth();
  const { edges, scrollProps } = useScrollEdges();
  const [dateView, setDateView] = useState<TransactionsDateView>(
    DEFAULT_TRANSACTIONS_DATE_VIEW
  );
  const hydrated = useRef(false);
  const currency = profileCurrency(profile);

  useEffect(() => {
    if (!profile || hydrated.current) return;
    setDateView(parseTransactionsDateView(profile.transactions_date_view));
    hydrated.current = true;
  }, [profile]);

  useEffect(() => {
    if (!user?.id || !hydrated.current) return;
    if (
      parseTransactionsDateView(profile?.transactions_date_view) === dateView
    ) {
      return;
    }
    const handle = setTimeout(() => {
      void updateTransactionsDateView(user.id, dateView)
        .then(() => refreshProfile())
        .catch((err: unknown) => {
          console.warn(
            '[settings] date view save failed',
            err instanceof Error ? err.message : err
          );
        });
    }, 400);
    return () => clearTimeout(handle);
  }, [dateView, user?.id, profile?.transactions_date_view, refreshProfile]);

  return (
    <>
      <Stack.Screen options={{ title: 'Settings' }} />
      <View style={styles.host}>
        <OfflineBanner variant="settings" />
        <ScrollEdgeHost edges={edges} style={styles.scrollHost}>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.container}
            keyboardShouldPersistTaps="handled"
            {...scrollProps}
          >
            <Pressable
              style={styles.block}
              onPress={() => router.push('/settings/currency')}
              accessibilityRole="button"
              accessibilityLabel={`Currency, ${currency}`}
            >
              <CaptionText style={styles.label}>Money</CaptionText>
              <StrongText style={styles.blockTitle}>Currency</StrongText>
              <CaptionText style={styles.hint}>
                {currency} — {currencyLabel(currency)}. Tap to change.
              </CaptionText>
            </Pressable>

            <Pressable
              style={styles.block}
              onPress={() => router.push('/settings/categories')}
              accessibilityRole="button"
              accessibilityLabel="Categories"
            >
              <CaptionText style={styles.label}>Organize</CaptionText>
              <StrongText style={styles.blockTitle}>Categories</StrongText>
              <CaptionText style={styles.hint}>
                Built-in lists plus your own. Add, rename, or archive customs.
              </CaptionText>
            </Pressable>

            <View style={styles.block}>
              <CaptionText style={styles.label}>Transactions layout</CaptionText>
              <StrongText style={styles.blockTitle}>Date view</StrongText>
              <CaptionText style={styles.hint}>
                List by day, week strip, or month calendar on the Transactions
                tab.
              </CaptionText>
              <DateViewToggle value={dateView} onChange={setDateView} />
            </View>

            <AccountDangerZone />
          </ScrollView>
        </ScrollEdgeHost>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  host: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  scrollHost: {
    flex: 1,
  },
  scroll: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  container: {
    paddingHorizontal: space.md,
    paddingVertical: space.lg,
    gap: space.md,
    paddingBottom: space.xxl,
  },
  block: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: space.md,
    gap: space.sm,
  },
  label: {
    color: colors.inkMuted,
    textTransform: 'uppercase',
  },
  blockTitle: {
    color: colors.green[700],
  },
  hint: {
    color: colors.inkMuted,
    marginBottom: space.xs,
  },
});
