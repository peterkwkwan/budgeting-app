-- M3: recurring_series + transaction occurrence linkage (own-row RLS)
-- Founder: apply after profiles + transactions (+ personal stats).
-- Generation is done by Edge Functions (cron + app-open catch-up); this migration
-- only adds schema, RLS, and helpers for edit-future / stop-series.

-- ---------------------------------------------------------------------------
-- recurring_series
-- ---------------------------------------------------------------------------
create table if not exists public.recurring_series (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  amount numeric(12, 2) not null,
  type text not null,
  category text not null,
  note text,
  cadence text not null,
  anchor_at timestamptz not null,
  timezone text not null default 'UTC',
  active boolean not null default true,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint recurring_series_amount_positive check (amount > 0),
  constraint recurring_series_type_valid check (type in ('expense', 'income')),
  constraint recurring_series_cadence_valid check (
    cadence in ('daily', 'weekly', 'monthly', 'yearly')
  ),
  constraint recurring_series_note_length check (
    note is null or char_length(note) <= 500
  ),
  constraint recurring_series_category_matches_type check (
    (
      type = 'expense'
      and category in (
        'Groceries',
        'Social Life',
        'Pets',
        'Transport',
        'Household',
        'Apparel',
        'Beauty',
        'Health',
        'Education',
        'Gift',
        'Other',
        'Kids',
        'Gaming',
        'Rent and Bills',
        'Eating out',
        'Vacation',
        'Donation'
      )
    )
    or (
      type = 'income'
      and category in ('Salary', 'Freelance', 'Other income')
    )
  )
);

comment on table public.recurring_series is
  'Recurring rules (D/W/M/Y); Edge Functions materialize ledger rows for a rolling 90d horizon';
comment on column public.recurring_series.anchor_at is
  'First occurrence basis; cadence advances from this instant in series timezone';
comment on column public.recurring_series.timezone is
  'IANA TZ copied from profile at create (editable); used for occurrence local dates';
comment on column public.recurring_series.active is
  'Stop-series sets false; generators skip inactive series';
comment on column public.recurring_series.deleted_at is
  'Soft-delete of the rule itself (hidden from default lists)';

create index if not exists recurring_series_user_active_idx
  on public.recurring_series (user_id, updated_at desc)
  where deleted_at is null and active = true;

create index if not exists recurring_series_user_list_idx
  on public.recurring_series (user_id, updated_at desc)
  where deleted_at is null;

drop trigger if exists recurring_series_set_updated_at on public.recurring_series;
create trigger recurring_series_set_updated_at
  before update on public.recurring_series
  for each row
  execute function public.set_updated_at();

alter table public.recurring_series enable row level security;

drop policy if exists "recurring_series_select_own" on public.recurring_series;
create policy "recurring_series_select_own"
  on public.recurring_series
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "recurring_series_insert_own" on public.recurring_series;
create policy "recurring_series_insert_own"
  on public.recurring_series
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "recurring_series_update_own" on public.recurring_series;
create policy "recurring_series_update_own"
  on public.recurring_series
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- No hard-delete policy: clients soft-delete or stop-series via update.

-- ---------------------------------------------------------------------------
-- transactions: link to series + idempotent occurrence key
-- ---------------------------------------------------------------------------
alter table public.transactions
  add column if not exists recurring_series_id uuid
    references public.recurring_series (id) on delete set null;

alter table public.transactions
  add column if not exists occurrence_key text;

comment on column public.transactions.recurring_series_id is
  'When set, row was auto-generated (or linked) from a recurring rule';
comment on column public.transactions.occurrence_key is
  'Idempotency key within a series (local date YYYY-MM-DD in series TZ)';

-- Include soft-deleted rows so a soft-deleted instance is never regenerated.
-- NULLs are distinct in Postgres unique indexes, so one-off ledger rows (null series)
-- do not collide.
create unique index if not exists transactions_series_occurrence_uidx
  on public.transactions (recurring_series_id, occurrence_key);

create index if not exists transactions_series_future_idx
  on public.transactions (recurring_series_id, occurred_at)
  where recurring_series_id is not null and deleted_at is null;

-- ---------------------------------------------------------------------------
-- Helpers: edit future instances / stop series (security invoker, own rows)
-- ---------------------------------------------------------------------------

-- Update amount/type/category/note on future non-deleted instances only.
create or replace function public.update_recurring_series_future(
  p_series_id uuid,
  p_amount numeric,
  p_type text,
  p_category text,
  p_note text
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not exists (
    select 1
    from public.recurring_series s
    where s.id = p_series_id
      and s.user_id = auth.uid()
      and s.deleted_at is null
  ) then
    raise exception 'Series not found';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Amount must be greater than zero';
  end if;
  if p_type is null or p_type not in ('expense', 'income') then
    raise exception 'Type must be expense or income';
  end if;

  update public.recurring_series
  set
    amount = p_amount,
    type = p_type,
    category = p_category,
    note = nullif(trim(p_note), '')
  where id = p_series_id
    and user_id = auth.uid()
    and deleted_at is null;

  update public.transactions
  set
    amount = p_amount,
    type = p_type,
    category = p_category,
    note = nullif(trim(p_note), '')
  where recurring_series_id = p_series_id
    and user_id = auth.uid()
    and deleted_at is null
    and occurred_at > now();
end;
$$;

comment on function public.update_recurring_series_future(uuid, numeric, text, text, text) is
  'M3: edit series fields + future ledger instances only; past instances unchanged';

-- Deactivate series and soft-delete future instances (past stay).
create or replace function public.stop_recurring_series(p_series_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  update public.recurring_series
  set active = false
  where id = p_series_id
    and user_id = auth.uid()
    and deleted_at is null;

  if not found then
    raise exception 'Series not found';
  end if;

  update public.transactions
  set deleted_at = now()
  where recurring_series_id = p_series_id
    and user_id = auth.uid()
    and deleted_at is null
    and occurred_at > now();
end;
$$;

comment on function public.stop_recurring_series(uuid) is
  'M3: stop-series — deactivate rule and soft-delete future instances only';

grant execute on function public.update_recurring_series_future(uuid, numeric, text, text, text)
  to authenticated;
grant execute on function public.stop_recurring_series(uuid)
  to authenticated;
