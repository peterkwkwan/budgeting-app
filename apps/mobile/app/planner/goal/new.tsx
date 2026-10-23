import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { GoalForm } from '@/components/planner/GoalForm';
import { colors } from '@/constants/theme';
import { useCreatePlannerGoal } from '@/hooks/usePlanner';
import type { PlannerGoalInput } from '@/lib/plannerGoals';

export default function NewGoalScreen() {
  const router = useRouter();
  const create = useCreatePlannerGoal();
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(input: PlannerGoalInput) {
    setError(null);
    try {
      const goal = await create.mutateAsync(input);
      router.replace(`/planner/goal/${goal.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save goal.');
    }
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Add goal' }} />
      <GoalForm
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
