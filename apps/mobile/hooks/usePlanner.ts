import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';

import { useAuth } from '@/lib/auth';
import {
  createPlannerGoal,
  deleteContributionEvent,
  getPlannerGoal,
  listContributionEvents,
  listPlannerGoals,
  logContributionEvent,
  plannerGoalKeys,
  softDeletePlannerGoal,
  updatePlannerGoal,
  type ContributionEventInput,
  type PlannerGoalInput,
} from '@/lib/plannerGoals';
import {
  createPlannerVehicle,
  getPlannerVehicle,
  listPlannerVehicles,
  plannerVehicleKeys,
  softDeletePlannerVehicle,
  updatePlannerVehicle,
  type PlannerVehicleInput,
} from '@/lib/plannerVehicles';

function invalidatePlanner(qc: ReturnType<typeof useQueryClient>) {
  void qc.invalidateQueries({ queryKey: plannerGoalKeys.all });
  void qc.invalidateQueries({ queryKey: plannerVehicleKeys.all });
}

export function usePlannerVehicles() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: plannerVehicleKeys.list(),
    queryFn: listPlannerVehicles,
  });

  useFocusEffect(
    useCallback(() => {
      void queryClient.invalidateQueries({
        queryKey: plannerVehicleKeys.list(),
      });
    }, [queryClient])
  );

  return query;
}

export function usePlannerVehicle(id: string | undefined) {
  return useQuery({
    queryKey: plannerVehicleKeys.detail(id ?? ''),
    queryFn: () => getPlannerVehicle(id!),
    enabled: Boolean(id),
  });
}

export function useCreatePlannerVehicle() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: PlannerVehicleInput) => {
      if (!user?.id) throw new Error('You must be signed in.');
      return createPlannerVehicle(user.id, input);
    },
    onSuccess: () => invalidatePlanner(queryClient),
  });
}

export function useUpdatePlannerVehicle(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: PlannerVehicleInput) =>
      updatePlannerVehicle(id, input),
    onSuccess: () => invalidatePlanner(queryClient),
  });
}

export function useSoftDeletePlannerVehicle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => softDeletePlannerVehicle(id),
    onSuccess: () => invalidatePlanner(queryClient),
  });
}

export function usePlannerGoals() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: plannerGoalKeys.list(),
    queryFn: listPlannerGoals,
  });

  useFocusEffect(
    useCallback(() => {
      void queryClient.invalidateQueries({ queryKey: plannerGoalKeys.list() });
    }, [queryClient])
  );

  return query;
}

export function usePlannerGoal(id: string | undefined) {
  return useQuery({
    queryKey: plannerGoalKeys.detail(id ?? ''),
    queryFn: () => getPlannerGoal(id!),
    enabled: Boolean(id),
  });
}

export function useCreatePlannerGoal() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: PlannerGoalInput) => {
      if (!user?.id) throw new Error('You must be signed in.');
      return createPlannerGoal(user.id, input);
    },
    onSuccess: () => invalidatePlanner(queryClient),
  });
}

export function useUpdatePlannerGoal(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: PlannerGoalInput) => updatePlannerGoal(id, input),
    onSuccess: () => invalidatePlanner(queryClient),
  });
}

export function useSoftDeletePlannerGoal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => softDeletePlannerGoal(id),
    onSuccess: () => invalidatePlanner(queryClient),
  });
}

export function useContributionEvents(goalId: string | undefined) {
  return useQuery({
    queryKey: plannerGoalKeys.events(goalId ?? ''),
    queryFn: () => listContributionEvents(goalId!),
    enabled: Boolean(goalId),
  });
}

export function useLogContribution(goalId: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ContributionEventInput) => {
      if (!user?.id) throw new Error('You must be signed in.');
      return logContributionEvent(user.id, goalId, input);
    },
    onSuccess: () => invalidatePlanner(queryClient),
  });
}

export function useDeleteContribution() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteContributionEvent(id),
    onSuccess: () => invalidatePlanner(queryClient),
  });
}
