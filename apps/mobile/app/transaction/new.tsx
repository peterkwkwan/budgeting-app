import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { TransactionForm } from '@/components/TransactionForm';
import { colors } from '@/constants/theme';
import { useCreateTransaction } from '@/hooks/useTransactions';
import type { TransactionInput } from '@/lib/transactions';

export default function NewTransactionScreen() {
  const router = useRouter();
  const create = useCreateTransaction();
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(input: TransactionInput) {
    setError(null);
    try {
      await create.mutateAsync(input);
      router.back();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save transaction.');
    }
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Add transaction' }} />
      <TransactionForm
        submitLabel="Save"
        busy={create.isPending}
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
