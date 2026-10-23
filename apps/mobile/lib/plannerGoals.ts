import {
  isGoalType,
  isPlanCadence,
  type GoalType,
  type PlanCadence,
} from '@/constants/planner';
import { formatDateOnly, parseDateOnly } from '@/lib/plannerMath';

import { supabase } from './supabase';

export type PlannerGoal = {
  id: string;
  user_id: string;
  name: string;
  goal_type: GoalType;
  target_amount: number;
  target_date: string | null;
  current_saved: number;
  plan_amount: number | null;
  plan_cadence: PlanCadence | null;
  notes: string | null;
  /** Linked vehicle ids (progress = sum of balances when non-empty). */
  vehicle_ids: string[];
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
};

export type PlannerGoalInput = {
  name: string;
  goal_type: GoalType;
  target_amount: number;
  target_date?: string | Date | null;
  current_saved?: number;
  plan_amount?: number | null;
  plan_cadence?: PlanCadence | null;
  notes?: string | null;
  /** Replace linked vehicles when provided (create/update). */
  vehicle_ids?: string[];
};

export type ContributionEvent = {
  id: string;
  user_id: string;
  goal_id: string;
  amount: number;
  contributed_at: string;
  note: string | null;
  created_at: string;
  updated_at: string;
};

export type ContributionEventInput = {
  amount: number;
  contributed_at: string | Date;
  note?: string | null;
};

function mapGoal(
  row: Record<string, unknown>,
  vehicleIds: string[] = []
): PlannerGoal {
  const type = String(row.goal_type);
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    name: String(row.name),
    goal_type: (isGoalType(type) ? type : 'custom') as GoalType,
    target_amount: Number(row.target_amount),
    target_date: (row.target_date as string | null) ?? null,
    current_saved: Number(row.current_saved ?? 0),
    plan_amount:
      row.plan_amount == null ? null : Number(row.plan_amount),
    plan_cadence:
      row.plan_cadence != null && isPlanCadence(String(row.plan_cadence))
        ? (String(row.plan_cadence) as PlanCadence)
        : null,
    notes: (row.notes as string | null) ?? null,
    vehicle_ids: vehicleIds,
    deleted_at: (row.deleted_at as string | null) ?? null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

function mapEvent(row: Record<string, unknown>): ContributionEvent {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    goal_id: String(row.goal_id),
    amount: Number(row.amount),
    contributed_at: String(row.contributed_at),
    note: (row.note as string | null) ?? null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

function toDateOnly(v: string | Date | null | undefined): string | null {
  if (v == null) return null;
  if (typeof v === 'string') {
    const trimmed = v.trim();
    if (!trimmed) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
    const parsed = parseDateOnly(trimmed);
    return parsed ? formatDateOnly(parsed) : null;
  }
  return formatDateOnly(v);
}

function validateGoal(input: PlannerGoalInput): string | null {
  const name = input.name.trim();
  if (!name || name.length > 80) {
    return 'Name is required (80 characters or fewer).';
  }
  if (!isGoalType(input.goal_type)) {
    return 'Choose a valid goal type.';
  }
  if (!(input.target_amount > 0) || Number.isNaN(input.target_amount)) {
    return 'Target amount must be greater than zero.';
  }
  if (
    input.current_saved != null &&
    (!(input.current_saved >= 0) || Number.isNaN(input.current_saved))
  ) {
    return 'Current saved must be zero or greater.';
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
  if (input.target_date != null && input.target_date !== '') {
    const d = toDateOnly(input.target_date);
    if (!d) return 'Target date is invalid.';
  }
  return null;
}

async function fetchLinksByGoalIds(
  goalIds: string[]
): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  if (goalIds.length === 0) return map;

  const { data, error } = await supabase
    .from('planner_goal_vehicles')
    .select('goal_id, vehicle_id')
    .in('goal_id', goalIds);

  if (error) throw new Error(error.message);

  for (const row of data ?? []) {
    const gid = String((row as { goal_id: string }).goal_id);
    const vid = String((row as { vehicle_id: string }).vehicle_id);
    const list = map.get(gid) ?? [];
    list.push(vid);
    map.set(gid, list);
  }
  return map;
}

async function replaceGoalVehicles(
  userId: string,
  goalId: string,
  vehicleIds: string[]
): Promise<void> {
  const unique = [...new Set(vehicleIds.filter(Boolean))];

  const { error: delError } = await supabase
    .from('planner_goal_vehicles')
    .delete()
    .eq('goal_id', goalId);

  if (delError) throw new Error(delError.message);

  if (unique.length === 0) return;

  const { error: insError } = await supabase.from('planner_goal_vehicles').insert(
    unique.map((vehicle_id) => ({
      goal_id: goalId,
      vehicle_id,
      user_id: userId,
    }))
  );

  if (insError) throw new Error(insError.message);
}

export async function listPlannerGoals(): Promise<PlannerGoal[]> {
  const { data, error } = await supabase
    .from('planner_goals')
    .select('*')
    .is('deleted_at', null)
    .order('updated_at', { ascending: false });

  if (error) throw new Error(error.message);
  const rows = data ?? [];
  const ids = rows.map((r) => String((r as { id: string }).id));
  const links = await fetchLinksByGoalIds(ids);
  return rows.map((row) => {
    const r = row as Record<string, unknown>;
    return mapGoal(r, links.get(String(r.id)) ?? []);
  });
}

export async function getPlannerGoal(id: string): Promise<PlannerGoal | null> {
  const { data, error } = await supabase
    .from('planner_goals')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;
  const links = await fetchLinksByGoalIds([id]);
  return mapGoal(data as Record<string, unknown>, links.get(id) ?? []);
}

export async function createPlannerGoal(
  userId: string,
  input: PlannerGoalInput
): Promise<PlannerGoal> {
  const validationError = validateGoal(input);
  if (validationError) throw new Error(validationError);

  const notes = input.notes?.trim() ? input.notes.trim() : null;
  const vehicleIds = input.vehicle_ids ?? [];
  // Linked goals ignore manual current_saved for display; store 0 when linked.
  const current_saved =
    vehicleIds.length > 0 ? 0 : (input.current_saved ?? 0);

  const { data, error } = await supabase
    .from('planner_goals')
    .insert({
      user_id: userId,
      name: input.name.trim(),
      goal_type: input.goal_type,
      target_amount: input.target_amount,
      target_date: toDateOnly(input.target_date ?? null),
      current_saved,
      plan_amount: input.plan_amount ?? null,
      plan_cadence: input.plan_cadence ?? null,
      notes,
    })
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  const goal = mapGoal(data as Record<string, unknown>, []);
  if (vehicleIds.length > 0) {
    await replaceGoalVehicles(userId, goal.id, vehicleIds);
  }
  return { ...goal, vehicle_ids: vehicleIds };
}

export async function updatePlannerGoal(
  id: string,
  input: PlannerGoalInput
): Promise<PlannerGoal> {
  const validationError = validateGoal(input);
  if (validationError) throw new Error(validationError);

  const notes = input.notes?.trim() ? input.notes.trim() : null;
  const patch: Record<string, unknown> = {
    name: input.name.trim(),
    goal_type: input.goal_type,
    target_amount: input.target_amount,
    target_date: toDateOnly(input.target_date ?? null),
    plan_amount: input.plan_amount ?? null,
    plan_cadence: input.plan_cadence ?? null,
    notes,
  };

  const vehicleIds = input.vehicle_ids;
  if (vehicleIds != null && vehicleIds.length > 0) {
    // Linked: don't rely on manual saved for display
    patch.current_saved = input.current_saved ?? 0;
  } else if (input.current_saved != null) {
    patch.current_saved = input.current_saved;
  }

  const { data, error } = await supabase
    .from('planner_goals')
    .update(patch)
    .eq('id', id)
    .is('deleted_at', null)
    .select('*')
    .single();

  if (error) throw new Error(error.message);

  const userId = String((data as { user_id: string }).user_id);
  let links: string[] = [];
  if (vehicleIds != null) {
    await replaceGoalVehicles(userId, id, vehicleIds);
    links = vehicleIds;
  } else {
    const map = await fetchLinksByGoalIds([id]);
    links = map.get(id) ?? [];
  }

  return mapGoal(data as Record<string, unknown>, links);
}

export async function softDeletePlannerGoal(id: string): Promise<void> {
  const { error } = await supabase
    .from('planner_goals')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .is('deleted_at', null);

  if (error) throw new Error(error.message);
}

export async function listContributionEvents(
  goalId: string
): Promise<ContributionEvent[]> {
  const { data, error } = await supabase
    .from('planner_contribution_events')
    .select('*')
    .eq('goal_id', goalId)
    .order('contributed_at', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => mapEvent(row as Record<string, unknown>));
}

export async function logContributionEvent(
  userId: string,
  goalId: string,
  input: ContributionEventInput
): Promise<ContributionEvent> {
  if (!(input.amount > 0) || Number.isNaN(input.amount)) {
    throw new Error('Amount must be greater than zero.');
  }
  const contributed_at = toDateOnly(input.contributed_at);
  if (!contributed_at) {
    throw new Error('Contribution date is required.');
  }
  const note = input.note?.trim() ? input.note.trim() : null;
  if (note && note.length > 500) {
    throw new Error('Note must be 500 characters or fewer.');
  }

  // Block logging when goal is vehicle-linked (option A — no double-count).
  const links = await fetchLinksByGoalIds([goalId]);
  if ((links.get(goalId) ?? []).length > 0) {
    throw new Error(
      'Progress comes from linked accounts. Unlink accounts to log manual contributions.'
    );
  }

  const { data, error } = await supabase
    .from('planner_contribution_events')
    .insert({
      user_id: userId,
      goal_id: goalId,
      amount: input.amount,
      contributed_at,
      note,
    })
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return mapEvent(data as Record<string, unknown>);
}

export async function deleteContributionEvent(id: string): Promise<void> {
  const { error } = await supabase
    .from('planner_contribution_events')
    .delete()
    .eq('id', id);

  if (error) throw new Error(error.message);
}

export const plannerGoalKeys = {
  all: ['planner_goals'] as const,
  list: () => [...plannerGoalKeys.all, 'list'] as const,
  detail: (id: string) => [...plannerGoalKeys.all, 'detail', id] as const,
  events: (goalId: string) =>
    [...plannerGoalKeys.all, 'events', goalId] as const,
};
