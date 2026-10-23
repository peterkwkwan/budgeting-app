-- Planner P0: personal financial vehicles, goals, contribution events (own-row RLS)
-- Founder: apply with `npx supabase db push` (see root README / supabase/README).

-- ---------------------------------------------------------------------------
-- Vehicles (savings, investments, cash, debt, mortgage, other)
-- ---------------------------------------------------------------------------
create table if not exists public.planner_vehicles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  vehicle_type text not null,
  balance numeric(14, 2) not null default 0,
  annual_rate numeric(8, 4) not null default 0,
  growth_mode text not null,
  plan_amount numeric(12, 2),
  plan_cadence text,
  notes text,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint planner_vehicles_name_length check (
    char_length(trim(name)) >= 1 and char_length(name) <= 80
  ),
  constraint planner_vehicles_type_valid check (
    vehicle_type in (
      'savings',
      'investment',
      'cash',
      'debt',
      'mortgage',
      'other'
    )
  ),
  constraint planner_vehicles_growth_mode_valid check (
    growth_mode in ('grow', 'shrink')
  ),
  constraint planner_vehicles_balance_nonneg check (balance >= 0),
  constraint planner_vehicles_rate_nonneg check (annual_rate >= 0 and annual_rate <= 100),
  constraint planner_vehicles_plan_amount_positive check (
    plan_amount is null or plan_amount > 0
  ),
  constraint planner_vehicles_plan_cadence_valid check (
    plan_cadence is null
    or plan_cadence in ('weekly', 'biweekly', 'monthly')
  ),
  constraint planner_vehicles_plan_pair check (
    (plan_amount is null and plan_cadence is null)
    or (plan_amount is not null and plan_cadence is not null)
  ),
  constraint planner_vehicles_notes_length check (
    notes is null or char_length(notes) <= 500
  ),
  constraint planner_vehicles_debt_shrink check (
    (vehicle_type in ('debt', 'mortgage') and growth_mode = 'shrink')
    or (vehicle_type not in ('debt', 'mortgage') and growth_mode = 'grow')
  )
);

comment on table public.planner_vehicles is
  'Personal financial vehicles for Planner projections; soft-delete via deleted_at';
comment on column public.planner_vehicles.annual_rate is
  'User-entered APR/APY percent (e.g. 5.25); monthly compound / amortization-lite';
comment on column public.planner_vehicles.plan_amount is
  'Planned contribution (grow) or payment (shrink); does not create Transactions';

create index if not exists planner_vehicles_user_active_idx
  on public.planner_vehicles (user_id, updated_at desc)
  where deleted_at is null;

drop trigger if exists planner_vehicles_set_updated_at on public.planner_vehicles;
create trigger planner_vehicles_set_updated_at
  before update on public.planner_vehicles
  for each row
  execute function public.set_updated_at();

alter table public.planner_vehicles enable row level security;

drop policy if exists "planner_vehicles_select_own" on public.planner_vehicles;
create policy "planner_vehicles_select_own"
  on public.planner_vehicles
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "planner_vehicles_insert_own" on public.planner_vehicles;
create policy "planner_vehicles_insert_own"
  on public.planner_vehicles
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "planner_vehicles_update_own" on public.planner_vehicles;
create policy "planner_vehicles_update_own"
  on public.planner_vehicles
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Goals (personal only in P0)
-- ---------------------------------------------------------------------------
create table if not exists public.planner_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  goal_type text not null,
  target_amount numeric(14, 2) not null,
  target_date date,
  current_saved numeric(14, 2) not null default 0,
  plan_amount numeric(12, 2),
  plan_cadence text,
  notes text,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint planner_goals_name_length check (
    char_length(trim(name)) >= 1 and char_length(name) <= 80
  ),
  constraint planner_goals_type_valid check (
    goal_type in (
      'emergency',
      'vacation',
      'home',
      'education',
      'retirement',
      'debt_payoff',
      'custom'
    )
  ),
  constraint planner_goals_target_positive check (target_amount > 0),
  constraint planner_goals_saved_nonneg check (current_saved >= 0),
  constraint planner_goals_plan_amount_positive check (
    plan_amount is null or plan_amount > 0
  ),
  constraint planner_goals_plan_cadence_valid check (
    plan_cadence is null
    or plan_cadence in ('weekly', 'biweekly', 'monthly')
  ),
  constraint planner_goals_plan_pair check (
    (plan_amount is null and plan_cadence is null)
    or (plan_amount is not null and plan_cadence is not null)
  ),
  constraint planner_goals_notes_length check (
    notes is null or char_length(notes) <= 500
  )
);

comment on table public.planner_goals is
  'Personal savings/debt-payoff goals; P0 is owner-only (no pair-shared goals)';
comment on column public.planner_goals.current_saved is
  'Manual progress; updated when contribution events are logged';

create index if not exists planner_goals_user_active_idx
  on public.planner_goals (user_id, updated_at desc)
  where deleted_at is null;

drop trigger if exists planner_goals_set_updated_at on public.planner_goals;
create trigger planner_goals_set_updated_at
  before update on public.planner_goals
  for each row
  execute function public.set_updated_at();

alter table public.planner_goals enable row level security;

drop policy if exists "planner_goals_select_own" on public.planner_goals;
create policy "planner_goals_select_own"
  on public.planner_goals
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "planner_goals_insert_own" on public.planner_goals;
create policy "planner_goals_insert_own"
  on public.planner_goals
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "planner_goals_update_own" on public.planner_goals;
create policy "planner_goals_update_own"
  on public.planner_goals
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Contribution events (log against a goal; does NOT create transactions)
-- ---------------------------------------------------------------------------
create table if not exists public.planner_contribution_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  goal_id uuid not null references public.planner_goals (id) on delete cascade,
  amount numeric(12, 2) not null,
  contributed_at date not null,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint planner_contribution_events_amount_positive check (amount > 0),
  constraint planner_contribution_events_note_length check (
    note is null or char_length(note) <= 500
  )
);

comment on table public.planner_contribution_events is
  'Logged goal contributions; Planner-local only — no Transactions rows in P0';

create index if not exists planner_contribution_events_goal_idx
  on public.planner_contribution_events (goal_id, contributed_at desc);

create index if not exists planner_contribution_events_user_idx
  on public.planner_contribution_events (user_id, contributed_at desc);

drop trigger if exists planner_contribution_events_set_updated_at
  on public.planner_contribution_events;
create trigger planner_contribution_events_set_updated_at
  before update on public.planner_contribution_events
  for each row
  execute function public.set_updated_at();

alter table public.planner_contribution_events enable row level security;

drop policy if exists "planner_contribution_events_select_own"
  on public.planner_contribution_events;
create policy "planner_contribution_events_select_own"
  on public.planner_contribution_events
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "planner_contribution_events_insert_own"
  on public.planner_contribution_events;
create policy "planner_contribution_events_insert_own"
  on public.planner_contribution_events
  for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.planner_goals g
      where g.id = goal_id
        and g.user_id = auth.uid()
        and g.deleted_at is null
    )
  );

drop policy if exists "planner_contribution_events_update_own"
  on public.planner_contribution_events;
create policy "planner_contribution_events_update_own"
  on public.planner_contribution_events
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "planner_contribution_events_delete_own"
  on public.planner_contribution_events;
create policy "planner_contribution_events_delete_own"
  on public.planner_contribution_events
  for delete
  to authenticated
  using (auth.uid() = user_id);

-- Apply contribution to goal.current_saved (insert/delete only; updates rare)
create or replace function public.planner_apply_contribution_delta()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.planner_goals
      set current_saved = current_saved + new.amount
    where id = new.goal_id
      and user_id = new.user_id
      and deleted_at is null;
    return new;
  elsif tg_op = 'DELETE' then
    update public.planner_goals
      set current_saved = greatest(0, current_saved - old.amount)
    where id = old.goal_id
      and user_id = old.user_id;
    return old;
  elsif tg_op = 'UPDATE' then
    if old.goal_id is distinct from new.goal_id then
      raise exception 'Cannot move a contribution to another goal';
    end if;
    update public.planner_goals
      set current_saved = greatest(0, current_saved - old.amount + new.amount)
    where id = new.goal_id
      and user_id = new.user_id
      and deleted_at is null;
    return new;
  end if;
  return null;
end;
$$;

drop trigger if exists planner_contribution_events_apply_delta
  on public.planner_contribution_events;
create trigger planner_contribution_events_apply_delta
  after insert or update or delete on public.planner_contribution_events
  for each row
  execute function public.planner_apply_contribution_delta();
