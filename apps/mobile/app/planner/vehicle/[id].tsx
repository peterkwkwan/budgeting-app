import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';

import { VehicleForm } from '@/components/planner/VehicleForm';
import { CaptionText, TitleText } from '@/components/StyledText';
import { colors, fonts, radius, space } from '@/constants/theme';
import {
  usePlannerVehicle,
  useSoftDeletePlannerVehicle,
  useUpdatePlannerVehicle,
} from '@/hooks/usePlanner';
import type { PlannerVehicleInput } from '@/lib/plannerVehicles';

export default function VehicleDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const query = usePlannerVehicle(id);
  const update = useUpdatePlannerVehicle(id!);
  const remove = useSoftDeletePlannerVehicle();
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(input: PlannerVehicleInput) {
    setError(null);
    try {
      await update.mutateAsync(input);
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace('/(tabs)/planner');
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not update account.'
      );
    }
  }

  function onDelete() {
    Alert.alert('Delete account?', 'This hides the account from Planner.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            try {
              await remove.mutateAsync(id!);
              router.back();
            } catch (err) {
              setError(
                err instanceof Error
                  ? err.message
                  : 'Could not delete account.'
              );
            }
          })();
        },
      },
    ]);
  }

  if (query.isLoading) {
    return (
      <View style={styles.centered}>
        <Stack.Screen options={{ title: 'Account' }} />
        <ActivityIndicator size="large" color={colors.green[700]} />
      </View>
    );
  }

  const vehicle = query.data;
  if (!vehicle) {
    return (
      <View style={styles.centered}>
        <Stack.Screen options={{ title: 'Account' }} />
        <TitleText>Account not found</TitleText>
        <Pressable style={styles.secondary} onPress={() => router.back()}>
          <CaptionText style={styles.secondaryText}>Back</CaptionText>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: vehicle.name }} />
      <VehicleForm
        initial={{
          name: vehicle.name,
          vehicle_type: vehicle.vehicle_type,
          balance: String(vehicle.balance),
          annual_rate: String(vehicle.annual_rate),
          compound_period: vehicle.compound_period,
          plan_amount:
            vehicle.plan_amount != null ? String(vehicle.plan_amount) : '',
          plan_cadence: vehicle.plan_cadence,
          notes: vehicle.notes ?? '',
        }}
        submitLabel="Save"
        busy={update.isPending}
        error={error}
        onSubmit={(input) => void onSubmit(input)}
        onDelete={onDelete}
        deleteBusy={remove.isPending}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.canvas },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    backgroundColor: colors.canvas,
  },
  secondary: {
    paddingHorizontal: space.md,
    height: 40,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: {
    color: colors.green[700],
    fontFamily: fonts.bodyStrong,
  },
});
