import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { GoalForm } from '@/components/planner/GoalForm';
import { colors } from '@/constants/theme';
import {
  useCreatePlannerGoal,
  usePlannerVehicles,
} from '@/hooks/usePlanner';
import type { PlannerGoalInput } from '@/lib/plannerGoals';

export default function NewGoalScreen() {
  const router = useRouter();
  const create = useCreatePlannerGoal();
  const vehicles = usePlannerVehicles();
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(input: PlannerGoalInput) {
    setError(null);
    try {
      await create.mutateAsync(input);
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace('/(tabs)/planner');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save goal.');
    }
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Add goal' }} />
      <GoalForm
        vehicles={vehicles.data ?? []}
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
