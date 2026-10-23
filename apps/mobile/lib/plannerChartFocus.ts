/**
 * Projection chart focus: goal path (linked growth vehicles) vs single vehicle.
 * Debt/mortgage/shrink vehicles never feed a goal path sum.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import type { GrowthMode } from '@/constants/planner';

const STORAGE_KEY = '@fudget/planner.chartFocus';

export type ChartFocusKind = 'goal' | 'vehicle';

export type ChartFocusSelection = {
  kind: ChartFocusKind;
  id: string;
};

export type ChartVehicle = {
  id: string;
  name: string;
  balance: number;
  growth_mode: GrowthMode;
};

export type ChartGoal = {
  id: string;
  name: string;
  target_amount: number;
  vehicle_ids: string[];
};

/** Growth vehicles only — exclude debt / mortgage / shrink from goal paths. */
export function isGrowthVehicle(v: { growth_mode: GrowthMode }): boolean {
  return v.growth_mode === 'grow';
}

/** Linked growth vehicles for a goal (debt/shrink links ignored for the path). */
export function linkedGrowthVehicles<T extends ChartVehicle>(
  goal: { vehicle_ids: string[] },
  vehicles: T[]
): T[] {
  if (goal.vehicle_ids.length === 0) return [];
  const want = new Set(goal.vehicle_ids);
  return vehicles.filter((v) => want.has(v.id) && isGrowthVehicle(v));
}

/**
 * Chartable = ≥1 linked **growth** vehicle.
 * Goals with only debt/shrink links (or no links) are not chartable.
 */
export function isChartableGoal(
  goal: { vehicle_ids: string[] },
  vehicles: ChartVehicle[]
): boolean {
  return linkedGrowthVehicles(goal, vehicles).length > 0;
}

export function chartableGoals<T extends ChartGoal>(
  goals: T[],
  vehicles: ChartVehicle[]
): T[] {
  return goals.filter((g) => isChartableGoal(g, vehicles));
}

export type ChartMode = 'goal' | 'vehicle';

export function resolveChartMode(
  goals: ChartGoal[],
  vehicles: ChartVehicle[]
): ChartMode {
  return chartableGoals(goals, vehicles).length > 0 ? 'goal' : 'vehicle';
}

/**
 * Default / repair selection:
 * last valid → first chartable goal → largest growth vehicle balance.
 * Falls back to any vehicle if none are growth.
 */
export function resolveChartFocus(args: {
  mode: ChartMode;
  goals: ChartGoal[];
  vehicles: ChartVehicle[];
  stored: ChartFocusSelection | null;
}): ChartFocusSelection | null {
  const { mode, goals, vehicles, stored } = args;
  const chartable = chartableGoals(goals, vehicles);

  if (mode === 'goal') {
    if (
      stored?.kind === 'goal' &&
      chartable.some((g) => g.id === stored.id)
    ) {
      return stored;
    }
    const first = chartable[0];
    return first ? { kind: 'goal', id: first.id } : null;
  }

  // Vehicle mode
  if (
    stored?.kind === 'vehicle' &&
    vehicles.some((v) => v.id === stored.id)
  ) {
    return stored;
  }

  const growth = vehicles.filter(isGrowthVehicle);
  const pool = growth.length > 0 ? growth : vehicles;
  if (pool.length === 0) return null;
  const largest = [...pool].sort((a, b) => b.balance - a.balance)[0]!;
  return { kind: 'vehicle', id: largest.id };
}

export async function loadChartFocus(): Promise<ChartFocusSelection | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ChartFocusSelection;
    if (
      (parsed.kind === 'goal' || parsed.kind === 'vehicle') &&
      typeof parsed.id === 'string' &&
      parsed.id.length > 0
    ) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export async function saveChartFocus(
  selection: ChartFocusSelection
): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(selection));
  } catch {
    // Prefs are best-effort; chart still works without persistence.
  }
}
