/** Planner P0 enums — keep in sync with supabase/migrations/20261023120000_planner.sql */

export const GOAL_TYPES = [
  'emergency',
  'vacation',
  'home',
  'education',
  'retirement',
  'debt_payoff',
  'custom',
] as const;

export type GoalType = (typeof GOAL_TYPES)[number];

export const GOAL_TYPE_LABELS: Record<GoalType, string> = {
  emergency: 'Emergency',
  vacation: 'Vacation',
  home: 'Home',
  education: 'Education',
  retirement: 'Retirement',
  debt_payoff: 'Debt payoff',
  custom: 'Custom',
};

export const VEHICLE_TYPES = [
  'savings',
  'investment',
  'cash',
  'debt',
  'mortgage',
  'other',
] as const;

export type VehicleType = (typeof VEHICLE_TYPES)[number];

export const VEHICLE_TYPE_LABELS: Record<VehicleType, string> = {
  savings: 'Savings',
  investment: 'Investment',
  cash: 'Cash',
  debt: 'Debt / loan',
  mortgage: 'Mortgage',
  other: 'Other',
};

export type GrowthMode = 'grow' | 'shrink';

export const PLAN_CADENCES = ['weekly', 'biweekly', 'monthly'] as const;

export type PlanCadence = (typeof PLAN_CADENCES)[number];

export const PLAN_CADENCE_LABELS: Record<PlanCadence, string> = {
  weekly: 'Weekly',
  biweekly: 'Every 2 weeks',
  monthly: 'Monthly',
};

/** Default growth mode from vehicle type (debt/mortgage shrink; else grow). */
export function defaultGrowthMode(type: VehicleType): GrowthMode {
  return type === 'debt' || type === 'mortgage' ? 'shrink' : 'grow';
}

export function isGoalType(v: string): v is GoalType {
  return (GOAL_TYPES as readonly string[]).includes(v);
}

export function isVehicleType(v: string): v is VehicleType {
  return (VEHICLE_TYPES as readonly string[]).includes(v);
}

export function isPlanCadence(v: string): v is PlanCadence {
  return (PLAN_CADENCES as readonly string[]).includes(v);
}

export const HORIZON_PRESETS = [
  { key: '5y', label: '5 years', months: 60 },
  { key: '10y', label: '10 years', months: 120 },
  { key: '25y', label: '25 years', months: 300 },
  { key: 'custom', label: 'Custom', months: null },
] as const;

export type HorizonPresetKey = (typeof HORIZON_PRESETS)[number]['key'];

export const DISCLAIMER =
  'Not financial advice. Projections are simple estimates from the balances, rates, and plans you enter.';
