import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  TransactionForm,
  type TransactionFormSubmit,
  type TransactionFormValues,
} from '@/components/TransactionForm';
import { colors } from '@/constants/theme';
import { useCreateRecurringSeries } from '@/hooks/useRecurring';
import { useCreateTransaction } from '@/hooks/useTransactions';
import { useAuth } from '@/lib/auth';
import { deviceTimezone } from '@/lib/profile';
import { takePendingVoiceDraft } from '@/lib/voiceDraft';

function readVoiceInitial(): Partial<TransactionFormValues> | undefined {
  const draft = takePendingVoiceDraft();
  if (!draft) return undefined;
  return {
    amount: draft.amount,
    type: draft.type,
    category: draft.category,
    note: draft.note,
    occurredAt: new Date(),
  };
}

export default function NewTransactionScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const createTxn = useCreateTransaction();
  const createSeries = useCreateRecurringSeries();
  const [error, setError] = useState<string | null>(null);
  const [initial] = useState(() => readVoiceInitial());
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
          endsMode: input.repeat.endsMode,
          endsOn: input.repeat.endsOn,
          endsAfterCount: input.repeat.endsAfterCount,
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
        allowVoice
        initial={initial}
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
    backgroundColor: colors.canvas,
  },
});
