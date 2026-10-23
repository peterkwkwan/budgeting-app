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
      const vehicle = await create.mutateAsync(input);
      router.replace(`/planner/vehicle/${vehicle.id}`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not save vehicle.'
      );
    }
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Add vehicle' }} />
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
