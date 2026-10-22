import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  View,
} from 'react-native';

import { CaptionText, TitleText } from '@/components/StyledText';
import { RecurringForm } from '@/components/RecurringForm';
import { colors, space } from '@/constants/theme';
import {
  useRecurringSeries,
  useStopRecurringSeries,
  useUpdateRecurringSeries,
} from '@/hooks/useRecurring';
import { repeatRuleFromSeries } from '@/lib/recurring';
import type { RecurringSeriesUpdateInput } from '@/lib/recurring';

export default function EditRecurringScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data, isLoading, isError, error } = useRecurringSeries(id);
  const update = useUpdateRecurringSeries(id ?? '');
  const stop = useStopRecurringSeries();
  const [formError, setFormError] = useState<string | null>(null);

  async function onSubmit(input: RecurringSeriesUpdateInput) {
    if (!id) return;
    setFormError(null);
    try {
      await update.mutateAsync(input);
      router.back();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not update.');
    }
  }

  function confirmStop() {
    if (!id) return;
    Alert.alert(
      'Stop this series?',
      'The rule will be removed. Future ledger entries go away. Past entries stay in your ledger.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Stop series',
          style: 'destructive',
          onPress: () => {
            void stop.mutateAsync(id).then(
              () => router.back(),
              (err: unknown) => {
                setFormError(
                  err instanceof Error ? err.message : 'Could not stop series.'
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
        <Stack.Screen options={{ title: 'Edit recurring' }} />
        <ActivityIndicator size="large" color={colors.green[700]} />
      </View>
    );
  }

  if (isError || !data) {
    return (
      <View style={styles.centered}>
        <Stack.Screen options={{ title: 'Edit recurring' }} />
        <TitleText style={{ color: colors.green[950] }}>Not found</TitleText>
        <CaptionText style={{ color: colors.inkMuted, textAlign: 'center' }}>
          {error instanceof Error
            ? error.message
            : 'This recurring rule may have been removed.'}
        </CaptionText>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Edit recurring' }} />
      <RecurringForm
        mode="edit"
        timezone={data.timezone}
        initial={{
          amount: String(data.amount),
          type: data.type,
          category: data.category,
          note: data.note ?? '',
          cadence: data.cadence,
          anchorAt: new Date(data.anchor_at),
          ...(() => {
            const r = repeatRuleFromSeries(data);
            return {
              endsMode: r.endsMode,
              endsOn: r.endsOn,
              endsAfterCount: r.endsAfterCount,
            };
          })(),
        }}
        submitLabel="Save changes"
        busy={update.isPending}
        stopBusy={stop.isPending}
        error={formError}
        onSubmit={(input) => void onSubmit(input)}
        onStop={confirmStop}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.green[50],
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
