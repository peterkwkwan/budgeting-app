import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';

import { OfflineBanner } from '@/components/OfflineBanner';
import { CaptionText, StrongText, TitleText } from '@/components/StyledText';
import {
  TransactionForm,
  type TransactionFormSubmit,
} from '@/components/TransactionForm';
import { colors, radius, space } from '@/constants/theme';
import { useOfflineGates } from '@/hooks/useOfflineGates';
import { CATEGORY_FIX_COPY, REPEAT_BLOCKED_COPY } from '@/lib/offline/ux';
import { userFacingOfflineWriteError } from '@/lib/offline/writeError';
import {
  useSoftDeleteTransaction,
  useTransaction,
  useUpdateTransaction,
} from '@/hooks/useTransactions';

export default function EditTransactionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data, isLoading, isError, error } = useTransaction(id);
  const update = useUpdateTransaction(id ?? '');
  const softDelete = useSoftDeleteTransaction();
  const { pendingIds, categoryFixIds, recurringBlocked } = useOfflineGates();
  const pending = Boolean(id && pendingIds.has(id));
  const categoryFix = Boolean(id && categoryFixIds.has(id));
  const [formError, setFormError] = useState<string | null>(null);

  async function onSubmit(input: TransactionFormSubmit) {
    if (!id) return;
    setFormError(null);
    try {
      await update.mutateAsync({
        amount: input.amount,
        type: input.type,
        category: input.category,
        note: input.note,
        occurred_at: input.occurred_at,
      });
      router.back();
    } catch (err) {
      setFormError(userFacingOfflineWriteError(err, 'Could not update.'));
    }
  }

  function confirmDelete() {
    if (!id) return;
    Alert.alert(
      'Delete transaction?',
      'It will be hidden from Transactions (soft-delete). It is not permanently removed.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void softDelete.mutateAsync(id).then(
              () => router.back(),
              (err: unknown) => {
                const message = userFacingOfflineWriteError(
                  err,
                  'Could not delete.'
                );
                setFormError(message);
                Alert.alert('Could not delete', message);
              }
            );
          },
        },
      ]
    );
  }

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <Stack.Screen options={{ title: 'Edit transaction' }} />
        <ActivityIndicator size="large" color={colors.green[700]} />
      </View>
    );
  }

  if (isError || !data) {
    return (
      <View style={styles.centered}>
        <Stack.Screen options={{ title: 'Edit transaction' }} />
        <TitleText style={{ color: colors.green[950] }}>Not found</TitleText>
        <CaptionText style={{ color: colors.inkMuted, textAlign: 'center' }}>
          {error instanceof Error
            ? error.message
            : 'This transaction may have been deleted or is no longer on this device.'}
        </CaptionText>
        <Pressable
          style={({ pressed }) => [
            styles.backBtn,
            pressed && styles.backBtnPressed,
          ]}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Back to Transactions"
        >
          <StrongText style={{ color: colors.green[700] }}>Back</StrongText>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Edit transaction' }} />
      <OfflineBanner />
      {categoryFix ? (
        <CaptionText style={styles.pending}>{CATEGORY_FIX_COPY}</CaptionText>
      ) : null}
      {data.recurring_series_id ? (
        <Pressable
          style={({ pressed }) => [
            styles.seriesLink,
            pressed && !recurringBlocked && styles.seriesLinkPressed,
            recurringBlocked && styles.seriesLinkDisabled,
          ]}
          onPress={() => {
            if (recurringBlocked) return;
            router.push(`/recurring/${data.recurring_series_id}`);
          }}
          disabled={recurringBlocked}
          accessibilityRole="button"
          accessibilityState={{ disabled: recurringBlocked }}
          accessibilityLabel="Edit or stop this recurring rule"
        >
          <StrongText style={styles.seriesLinkTitle}>
            Part of a recurring rule
          </StrongText>
          <CaptionText style={styles.seriesLinkMeta}>
            {recurringBlocked
              ? REPEAT_BLOCKED_COPY
              : 'Edit future entries or stop the series'}
          </CaptionText>
        </Pressable>
      ) : null}
      <TransactionForm
        initial={{
          amount: String(data.amount),
          type: data.type,
          category: data.category,
          note: data.note ?? '',
          occurredAt: new Date(data.occurred_at),
        }}
        submitLabel="Save changes"
        busy={update.isPending}
        deleteBusy={softDelete.isPending}
        error={formError}
        pendingSync={pending && !categoryFix}
        onSubmit={(input) => void onSubmit(input)}
        onDelete={confirmDelete}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  seriesLink: {
    marginHorizontal: space.md,
    marginTop: space.md,
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    gap: 2,
  },
  seriesLinkPressed: {
    backgroundColor: colors.surfaceMuted,
  },
  seriesLinkTitle: {
    color: colors.green[700],
  },
  seriesLinkMeta: {
    color: colors.inkMuted,
  },
  seriesLinkDisabled: {
    opacity: 0.6,
  },
  pending: {
    color: colors.inkMuted,
    paddingHorizontal: space.md,
    paddingTop: space.md,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.lg,
    gap: space.sm,
    backgroundColor: colors.canvas,
  },
  backBtn: {
    marginTop: space.sm,
    height: 40,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtnPressed: {
    backgroundColor: colors.surfaceMuted,
  },
});
