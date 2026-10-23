import {
  defaultGrowthMode,
  isCompoundPeriod,
  isPlanCadence,
  isVehicleType,
  type CompoundPeriod,
  type GrowthMode,
  type PlanCadence,
  type VehicleType,
} from '@/constants/planner';

import { supabase } from './supabase';

export type PlannerVehicle = {
  id: string;
  user_id: string;
  name: string;
  vehicle_type: VehicleType;
  balance: number;
  annual_rate: number;
  growth_mode: GrowthMode;
  compound_period: CompoundPeriod;
  plan_amount: number | null;
  plan_cadence: PlanCadence | null;
  notes: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
};

export type PlannerVehicleInput = {
  name: string;
  vehicle_type: VehicleType;
  balance: number;
  annual_rate: number;
  growth_mode?: GrowthMode;
  compound_period?: CompoundPeriod;
  plan_amount?: number | null;
  plan_cadence?: PlanCadence | null;
  notes?: string | null;
};

function mapRow(row: Record<string, unknown>): PlannerVehicle {
  const type = String(row.vehicle_type);
  const period = String(row.compound_period ?? 'yearly');
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    name: String(row.name),
    vehicle_type: (isVehicleType(type) ? type : 'other') as VehicleType,
    balance: Number(row.balance),
    annual_rate: Number(row.annual_rate),
    growth_mode: row.growth_mode === 'shrink' ? 'shrink' : 'grow',
    compound_period: isCompoundPeriod(period) ? period : 'yearly',
    plan_amount:
      row.plan_amount == null ? null : Number(row.plan_amount),
    plan_cadence:
      row.plan_cadence != null && isPlanCadence(String(row.plan_cadence))
        ? (String(row.plan_cadence) as PlanCadence)
        : null,
    notes: (row.notes as string | null) ?? null,
    deleted_at: (row.deleted_at as string | null) ?? null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

function validateInput(input: PlannerVehicleInput): string | null {
  const name = input.name.trim();
  if (!name || name.length > 80) {
    return 'Name is required (80 characters or fewer).';
  }
  if (!isVehicleType(input.vehicle_type)) {
    return 'Choose a valid vehicle type.';
  }
  if (!(input.balance >= 0) || Number.isNaN(input.balance)) {
    return 'Balance must be zero or greater.';
  }
  if (
    !(input.annual_rate >= 0) ||
    input.annual_rate > 100 ||
    Number.isNaN(input.annual_rate)
  ) {
    return 'Rate must be between 0 and 100%.';
  }
  if (
    input.compound_period != null &&
    !isCompoundPeriod(input.compound_period)
  ) {
    return 'Choose monthly or yearly compounding.';
  }
  const planAmount = input.plan_amount ?? null;
  const planCadence = input.plan_cadence ?? null;
  if ((planAmount == null) !== (planCadence == null)) {
    return 'Planned amount and cadence must both be set, or both empty.';
  }
  if (planAmount != null && (!(planAmount > 0) || Number.isNaN(planAmount))) {
    return 'Plan amount must be greater than zero.';
  }
  if (planCadence != null && !isPlanCadence(planCadence)) {
    return 'Choose a valid plan cadence.';
  }
  const notes = input.notes?.trim() ?? '';
  if (notes.length > 500) {
    return 'Notes must be 500 characters or fewer.';
  }
  return null;
}

function growthFor(input: PlannerVehicleInput): GrowthMode {
  return input.growth_mode ?? defaultGrowthMode(input.vehicle_type);
}

export async function listPlannerVehicles(): Promise<PlannerVehicle[]> {
  const { data, error } = await supabase
    .from('planner_vehicles')
    .select('*')
    .is('deleted_at', null)
    .order('updated_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => mapRow(row as Record<string, unknown>));
}

export async function getPlannerVehicle(
  id: string
): Promise<PlannerVehicle | null> {
  const { data, error } = await supabase
    .from('planner_vehicles')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;
  return mapRow(data as Record<string, unknown>);
}

export async function createPlannerVehicle(
  userId: string,
  input: PlannerVehicleInput
): Promise<PlannerVehicle> {
  const validationError = validateInput(input);
  if (validationError) throw new Error(validationError);

  const growth_mode = growthFor(input);
  const compound_period = input.compound_period ?? 'yearly';
  const notes = input.notes?.trim() ? input.notes.trim() : null;

  const { data, error } = await supabase
    .from('planner_vehicles')
    .insert({
      user_id: userId,
      name: input.name.trim(),
      vehicle_type: input.vehicle_type,
      balance: input.balance,
      annual_rate: input.annual_rate,
      growth_mode,
      compound_period,
      plan_amount: input.plan_amount ?? null,
      plan_cadence: input.plan_cadence ?? null,
      notes,
    })
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return mapRow(data as Record<string, unknown>);
}

export async function updatePlannerVehicle(
  id: string,
  input: PlannerVehicleInput
): Promise<PlannerVehicle> {
  const validationError = validateInput(input);
  if (validationError) throw new Error(validationError);

  const growth_mode = growthFor(input);
  const compound_period = input.compound_period ?? 'yearly';
  const notes = input.notes?.trim() ? input.notes.trim() : null;

  const { data, error } = await supabase
    .from('planner_vehicles')
    .update({
      name: input.name.trim(),
      vehicle_type: input.vehicle_type,
      balance: input.balance,
      annual_rate: input.annual_rate,
      growth_mode,
      compound_period,
      plan_amount: input.plan_amount ?? null,
      plan_cadence: input.plan_cadence ?? null,
      notes,
    })
    .eq('id', id)
    .is('deleted_at', null)
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return mapRow(data as Record<string, unknown>);
}

export async function softDeletePlannerVehicle(id: string): Promise<void> {
  const { error } = await supabase
    .from('planner_vehicles')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .is('deleted_at', null);

  if (error) throw new Error(error.message);
}

export const plannerVehicleKeys = {
  all: ['planner_vehicles'] as const,
  list: () => [...plannerVehicleKeys.all, 'list'] as const,
  detail: (id: string) => [...plannerVehicleKeys.all, 'detail', id] as const,
};
