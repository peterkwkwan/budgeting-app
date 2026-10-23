-- Planner P0: link goals ↔ vehicles (many vehicles per goal).
-- When linked, app progress = sum of those vehicle balances (no double-count with manual logs).

create table if not exists public.planner_goal_vehicles (
  goal_id uuid not null references public.planner_goals (id) on delete cascade,
  vehicle_id uuid not null references public.planner_vehicles (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (goal_id, vehicle_id)
);

comment on table public.planner_goal_vehicles is
  'Earmark vehicles toward a personal goal; progress = sum of linked vehicle balances';

create index if not exists planner_goal_vehicles_user_idx
  on public.planner_goal_vehicles (user_id);

create index if not exists planner_goal_vehicles_vehicle_idx
  on public.planner_goal_vehicles (vehicle_id);

alter table public.planner_goal_vehicles enable row level security;

drop policy if exists "planner_goal_vehicles_select_own" on public.planner_goal_vehicles;
create policy "planner_goal_vehicles_select_own"
  on public.planner_goal_vehicles
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "planner_goal_vehicles_insert_own" on public.planner_goal_vehicles;
create policy "planner_goal_vehicles_insert_own"
  on public.planner_goal_vehicles
  for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.planner_goals g
      where g.id = goal_id
        and g.user_id = auth.uid()
        and g.deleted_at is null
    )
    and exists (
      select 1 from public.planner_vehicles v
      where v.id = vehicle_id
        and v.user_id = auth.uid()
        and v.deleted_at is null
    )
  );

drop policy if exists "planner_goal_vehicles_delete_own" on public.planner_goal_vehicles;
create policy "planner_goal_vehicles_delete_own"
  on public.planner_goal_vehicles
  for delete
  to authenticated
  using (auth.uid() = user_id);
