import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { VehicleForm } from '@/components/planner/VehicleForm';
import { colors } from '@/constants/theme';
import { useCreatePlannerVehicle } from '@/hooks/usePlanner';
import type { PlannerVehicleInput } from '@/lib/plannerVehicles';

export default function NewVehicleScreen() {
  const router = useRouter();
  const create = useCreatePlannerVehicle();
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(input: PlannerVehicleInput) {
    setError(null);
    try {
      await create.mutateAsync(input);
      // Return to Planner list (same as Transactions after Add).
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace('/(tabs)/planner');
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not save account.'
      );
    }
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Add account' }} />
      <VehicleForm
        submitLabel="Save"
        busy={create.isPending}
        error={error}
        onSubmit={(input) => void onSubmit(input)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.canvas },
});
