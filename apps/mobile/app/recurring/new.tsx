import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ConnectionRequired } from '@/components/ConnectionRequired';
import { RecurringForm } from '@/components/RecurringForm';
import { colors } from '@/constants/theme';
import { useOfflineGates } from '@/hooks/useOfflineGates';
import { useCreateRecurringSeries } from '@/hooks/useRecurring';
import { useAuth } from '@/lib/auth';
import { REPEAT_BLOCKED_COPY } from '@/lib/offline/ux';
import { deviceTimezone } from '@/lib/profile';
import type { RecurringSeriesInput } from '@/lib/recurring';

export default function NewRecurringScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const create = useCreateRecurringSeries();
  const { recurringBlocked } = useOfflineGates();
  const [error, setError] = useState<string | null>(null);
  const timezone = profile?.timezone || deviceTimezone();

  if (recurringBlocked) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: 'Add recurring' }} />
        <ConnectionRequired message={REPEAT_BLOCKED_COPY} />
      </View>
    );
  }

  async function onSubmit(input: RecurringSeriesInput) {
    setError(null);
    try {
      await create.mutateAsync(input);
      router.back();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not save recurring rule.'
      );
    }
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Add recurring' }} />
      <RecurringForm
        mode="create"
        timezone={timezone}
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
    backgroundColor: colors.canvas,
  },
});
