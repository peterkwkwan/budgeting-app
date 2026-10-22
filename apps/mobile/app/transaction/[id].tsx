import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';

import { CaptionText, StrongText, TitleText } from '@/components/StyledText';
import {
  TransactionForm,
  type TransactionFormSubmit,
} from '@/components/TransactionForm';
import { colors, radius, space } from '@/constants/theme';
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
      setFormError(err instanceof Error ? err.message : 'Could not update.');
    }
  }

  function confirmDelete() {
    if (!id) return;
    Alert.alert(
      'Delete transaction?',
      'It will be hidden from your ledger (soft-delete). It is not permanently removed.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void softDelete.mutateAsync(id).then(
              () => router.back(),
              (err: unknown) => {
                setFormError(
                  err instanceof Error ? err.message : 'Could not delete.'
                );
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
            : 'This transaction may have been deleted.'}
        </CaptionText>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Edit transaction' }} />
      {data.recurring_series_id ? (
        <Pressable
          style={({ pressed }) => [
            styles.seriesLink,
            pressed && styles.seriesLinkPressed,
          ]}
          onPress={() =>
            router.push(`/recurring/${data.recurring_series_id}`)
          }
          accessibilityRole="button"
          accessibilityLabel="Edit or stop this recurring rule"
        >
          <StrongText style={styles.seriesLinkTitle}>
            Part of a recurring rule
          </StrongText>
          <CaptionText style={styles.seriesLinkMeta}>
            Edit future entries or stop the series
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
        onSubmit={(input) => void onSubmit(input)}
        onDelete={confirmDelete}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.green[50],
  },
  seriesLink: {
    marginHorizontal: space.md,
    marginTop: space.md,
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.green[200],
    backgroundColor: colors.surfaceMuted,
    gap: 2,
  },
  seriesLinkPressed: {
    backgroundColor: colors.green[200],
  },
  seriesLinkTitle: {
    color: colors.green[700],
  },
  seriesLinkMeta: {
    color: colors.inkMuted,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.lg,
    gap: space.sm,
    backgroundColor: colors.green[50],
  },
});
