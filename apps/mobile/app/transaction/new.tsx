import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  TransactionForm,
  type TransactionFormSubmit,
} from '@/components/TransactionForm';
import { colors } from '@/constants/theme';
import { useCreateRecurringSeries } from '@/hooks/useRecurring';
import { useCreateTransaction } from '@/hooks/useTransactions';
import { useAuth } from '@/lib/auth';
import { deviceTimezone } from '@/lib/profile';

export default function NewTransactionScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const createTxn = useCreateTransaction();
  const createSeries = useCreateRecurringSeries();
  const [error, setError] = useState<string | null>(null);
  const timezone = profile?.timezone || deviceTimezone();
  const busy = createTxn.isPending || createSeries.isPending;

  async function onSubmit(input: TransactionFormSubmit) {
    setError(null);
    try {
      if (input.repeat?.cadence) {
        await createSeries.mutateAsync({
          amount: input.amount,
          type: input.type,
          category: input.category,
          note: input.note,
          cadence: input.repeat.cadence,
          byweekday: input.repeat.byweekday,
          anchor_at: input.occurred_at,
          timezone,
        });
      } else {
        await createTxn.mutateAsync({
          amount: input.amount,
          type: input.type,
          category: input.category,
          note: input.note,
          occurred_at: input.occurred_at,
        });
      }
      router.back();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not save transaction.'
      );
    }
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Add transaction' }} />
      <TransactionForm
        allowRepeat
        submitLabel="Save"
        busy={busy}
        error={error}
        onSubmit={(input) => void onSubmit(input)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.green[50],
  },
});
