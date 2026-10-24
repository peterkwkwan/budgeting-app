import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Stack } from 'expo-router';

import { DateViewToggle } from '@/components/DateViewToggle';
import {
  ScrollEdgeHost,
  useScrollEdges,
} from '@/components/ScrollEdgeShadows';
import { CaptionText, StrongText } from '@/components/StyledText';
import { colors, radius, space } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import {
  DEFAULT_TRANSACTIONS_DATE_VIEW,
  parseTransactionsDateView,
  updateTransactionsDateView,
  type TransactionsDateView,
} from '@/lib/profile';

/**
 * Account → Settings / Preferences.
 * Transactions date layout (List · Week · Month) lives here; Transactions
 * reads the saved preference from the profile.
 */
export default function SettingsScreen() {
  const { user, profile, refreshProfile } = useAuth();
  const { edges, scrollProps } = useScrollEdges();
  const [dateView, setDateView] = useState<TransactionsDateView>(
    DEFAULT_TRANSACTIONS_DATE_VIEW
  );
  const hydrated = useRef(false);

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
      <ScrollEdgeHost edges={edges} style={styles.host}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          {...scrollProps}
        >
          <View style={styles.block}>
            <CaptionText style={styles.label}>Transactions layout</CaptionText>
            <StrongText style={styles.blockTitle}>Date view</StrongText>
            <CaptionText style={styles.hint}>
              List by day, week strip, or month calendar on the Transactions
              tab.
            </CaptionText>
            <DateViewToggle value={dateView} onChange={setDateView} />
          </View>
        </ScrollView>
      </ScrollEdgeHost>
    </>
  );
}

const styles = StyleSheet.create({
  host: {
    flex: 1,
    backgroundColor: colors.canvas,
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
