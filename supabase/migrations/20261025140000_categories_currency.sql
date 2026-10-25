-- Custom categories + one currency per account (default HKD).
-- Founder: `npx supabase db push` — see docs/categories-currency-apply.md

-- ---------------------------------------------------------------------------
-- profiles.currency (+ optional FX audit)
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists currency text;

alter table public.profiles
  alter column currency set default 'HKD';

update public.profiles
set currency = 'HKD'
where currency is null or btrim(currency) = '';

alter table public.profiles
  alter column currency set not null;

alter table public.profiles
  drop constraint if exists profiles_currency_valid;

alter table public.profiles
  add constraint profiles_currency_valid check (
    currency in (
      'HKD', 'USD', 'CNY', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'SGD', 'CHF',
      'INR', 'KRW', 'TWD', 'THB', 'MYR', 'PHP', 'IDR', 'NZD', 'SEK', 'NOK'
    )
  );

alter table public.profiles
  add column if not exists currency_converted_at timestamptz;

alter table public.profiles
  add column if not exists last_fx_from text;

alter table public.profiles
  add column if not exists last_fx_to text;

alter table public.profiles
  add column if not exists last_fx_rate numeric(18, 8);

comment on column public.profiles.currency is
  'Account display/ledger currency (one per account). Default HKD.';
comment on column public.profiles.currency_converted_at is
  'When amounts were last converted via set_account_currency (support/debug).';
comment on column public.profiles.last_fx_rate is
  'Last convert rate as 1 last_fx_from = last_fx_rate last_fx_to.';

-- ---------------------------------------------------------------------------
-- transactions: drop USD-only + fixed category checks
-- ---------------------------------------------------------------------------
alter table public.transactions
  drop constraint if exists transactions_currency_usd;

alter table public.transactions
  alter column currency set default 'HKD';

update public.transactions t
set currency = coalesce(p.currency, 'HKD')
from public.profiles p
where t.user_id = p.id
  and (t.currency is distinct from p.currency);

alter table public.transactions
  drop constraint if exists transactions_category_matches_type;

comment on column public.transactions.currency is
  'Matches profiles.currency; one currency per account (no per-txn FX).';

-- ---------------------------------------------------------------------------
-- recurring_series: drop fixed category check
-- ---------------------------------------------------------------------------
alter table public.recurring_series
  drop constraint if exists recurring_series_category_matches_type;

-- ---------------------------------------------------------------------------
-- user_categories (customs on top of system 17 expense + 3 income)
-- ---------------------------------------------------------------------------
create table if not exists public.user_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null,
  name text not null,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_categories_type_valid check (type in ('expense', 'income')),
  constraint user_categories_name_length check (
    char_length(trim(name)) >= 1 and char_length(name) <= 40
  ),
  constraint user_categories_user_type_name_unique unique (user_id, type, name)
);

comment on table public.user_categories is
  'User-defined categories layered on fixed system lists; archive instead of delete.';
comment on column public.user_categories.archived_at is
  'When set, hidden from pickers; existing txn/recurring names remain valid.';

create index if not exists user_categories_user_type_active_idx
  on public.user_categories (user_id, type, created_at asc)
  where archived_at is null;

drop trigger if exists user_categories_set_updated_at on public.user_categories;
create trigger user_categories_set_updated_at
  before update on public.user_categories
  for each row
  execute function public.set_updated_at();

alter table public.user_categories enable row level security;

drop policy if exists "user_categories_select_own" on public.user_categories;
create policy "user_categories_select_own"
  on public.user_categories
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "user_categories_insert_own" on public.user_categories;
create policy "user_categories_insert_own"
  on public.user_categories
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "user_categories_update_own" on public.user_categories;
create policy "user_categories_update_own"
  on public.user_categories
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "user_categories_delete_own" on public.user_categories;
create policy "user_categories_delete_own"
  on public.user_categories
  for delete
  to authenticated
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Category allow-list helpers + triggers
-- ---------------------------------------------------------------------------
create or replace function public.is_system_category(p_type text, p_category text)
returns boolean
language sql
immutable
as $$
  select case
    when p_type = 'expense' then p_category in (
      'Groceries', 'Social Life', 'Pets', 'Transport', 'Household', 'Apparel',
      'Beauty', 'Health', 'Education', 'Gift', 'Other', 'Kids', 'Gaming',
      'Rent and Bills', 'Eating out', 'Vacation', 'Donation'
    )
    when p_type = 'income' then p_category in (
      'Salary', 'Freelance', 'Other income'
    )
    else false
  end;
$$;

create or replace function public.category_allowed_for_user(
  p_user uuid,
  p_type text,
  p_category text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_system_category(p_type, p_category)
    or exists (
      select 1
      from public.user_categories uc
      where uc.user_id = p_user
        and uc.type = p_type
        and uc.name = p_category
    );
$$;

revoke all on function public.is_system_category(text, text) from public;
revoke all on function public.category_allowed_for_user(uuid, text, text) from public;
grant execute on function public.is_system_category(text, text) to authenticated;
grant execute on function public.category_allowed_for_user(uuid, text, text) to authenticated;

create or replace function public.enforce_category_allowed()
returns trigger
language plpgsql
as $$
begin
  if not public.category_allowed_for_user(new.user_id, new.type, new.category) then
    raise exception 'Category "%" is not allowed for %', new.category, new.type;
  end if;
  return new;
end;
$$;

drop trigger if exists transactions_enforce_category on public.transactions;
create trigger transactions_enforce_category
  before insert or update of type, category
  on public.transactions
  for each row
  execute function public.enforce_category_allowed();

drop trigger if exists recurring_series_enforce_category on public.recurring_series;
create trigger recurring_series_enforce_category
  before insert or update of type, category
  on public.recurring_series
  for each row
  execute function public.enforce_category_allowed();

-- Block customs that collide with system names (case-insensitive).
create or replace function public.enforce_user_category_not_system()
returns trigger
language plpgsql
as $$
begin
  new.name := trim(new.name);
  if new.name = '' then
    raise exception 'Category name is required';
  end if;
  if public.is_system_category(new.type, new.name) then
    raise exception '“%” is a built-in category', new.name;
  end if;
  -- Also reject case-insensitive match against system list
  if exists (
    select 1
    where public.is_system_category(new.type, initcap(lower(new.name)))
       or (
         new.type = 'expense'
         and lower(new.name) in (
           lower('Groceries'), lower('Social Life'), lower('Pets'),
           lower('Transport'), lower('Household'), lower('Apparel'),
           lower('Beauty'), lower('Health'), lower('Education'), lower('Gift'),
           lower('Other'), lower('Kids'), lower('Gaming'),
           lower('Rent and Bills'), lower('Eating out'), lower('Vacation'),
           lower('Donation')
         )
       )
       or (
         new.type = 'income'
         and lower(new.name) in (
           lower('Salary'), lower('Freelance'), lower('Other income')
         )
       )
  ) and not public.is_system_category(new.type, new.name) then
    -- Exact system names already blocked; catch casing variants via lower compare:
    null;
  end if;
  if (
    new.type = 'expense'
    and lower(new.name) in (
      'groceries', 'social life', 'pets', 'transport', 'household', 'apparel',
      'beauty', 'health', 'education', 'gift', 'other', 'kids', 'gaming',
      'rent and bills', 'eating out', 'vacation', 'donation'
    )
  ) or (
    new.type = 'income'
    and lower(new.name) in ('salary', 'freelance', 'other income')
  ) then
    raise exception '“%” is a built-in category', new.name;
  end if;
  return new;
end;
$$;

drop trigger if exists user_categories_not_system on public.user_categories;
create trigger user_categories_not_system
  before insert or update of type, name
  on public.user_categories
  for each row
  execute function public.enforce_user_category_not_system();

-- Rename custom: retarget ledger + recurring labels
create or replace function public.rename_user_category(
  p_id uuid,
  p_new_name text
)
returns public.user_categories
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.user_categories%rowtype;
  v_new text := trim(p_new_name);
  v_old_name text;
  v_type text;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;
  if v_new = '' or char_length(v_new) > 40 then
    raise exception 'Name must be 1–40 characters';
  end if;

  select * into v_row
  from public.user_categories
  where id = p_id and user_id = v_uid
  for update;

  if not found then
    raise exception 'Category not found';
  end if;

  if (
    v_row.type = 'expense'
    and lower(v_new) in (
      'groceries', 'social life', 'pets', 'transport', 'household', 'apparel',
      'beauty', 'health', 'education', 'gift', 'other', 'kids', 'gaming',
      'rent and bills', 'eating out', 'vacation', 'donation'
    )
  ) or (
    v_row.type = 'income'
    and lower(v_new) in ('salary', 'freelance', 'other income')
  ) then
    raise exception '“%” is a built-in category', v_new;
  end if;

  if exists (
    select 1 from public.user_categories
    where user_id = v_uid
      and type = v_row.type
      and name = v_new
      and id <> p_id
  ) then
    raise exception 'You already have a category named “%”', v_new;
  end if;

  v_old_name := v_row.name;
  v_type := v_row.type;

  -- Rename the custom row first so category triggers accept the new label.
  update public.user_categories
  set name = v_new
  where id = p_id and user_id = v_uid
  returning * into v_row;

  update public.transactions
  set category = v_new
  where user_id = v_uid
    and type = v_type
    and category = v_old_name;

  update public.recurring_series
  set category = v_new
  where user_id = v_uid
    and type = v_type
    and category = v_old_name;

  return v_row;
end;
$$;

grant execute on function public.rename_user_category(uuid, text) to authenticated;
revoke all on function public.rename_user_category(uuid, text) from public;

-- ---------------------------------------------------------------------------
-- Currency change: keep label or convert all money fields
-- ---------------------------------------------------------------------------
create or replace function public.set_account_currency(
  p_new_currency text,
  p_mode text,
  p_rate numeric default null
)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_old text;
  v_new text := upper(trim(p_new_currency));
  v_mode text := lower(trim(p_mode));
  v_rate numeric;
  v_profile public.profiles%rowtype;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if v_new not in (
    'HKD', 'USD', 'CNY', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'SGD', 'CHF',
    'INR', 'KRW', 'TWD', 'THB', 'MYR', 'PHP', 'IDR', 'NZD', 'SEK', 'NOK'
  ) then
    raise exception 'Unsupported currency';
  end if;

  if v_mode not in ('keep', 'convert') then
    raise exception 'Mode must be keep or convert';
  end if;

  select * into v_profile
  from public.profiles
  where id = v_uid
  for update;

  if not found then
    raise exception 'Profile not found';
  end if;

  v_old := v_profile.currency;
  if v_old = v_new then
    return v_profile;
  end if;

  if v_mode = 'keep' then
    update public.profiles
    set currency = v_new
    where id = v_uid
    returning * into v_profile;

    update public.transactions
    set currency = v_new
    where user_id = v_uid;

    return v_profile;
  end if;

  -- convert
  if p_rate is null or p_rate <= 0 or p_rate <> p_rate then
    raise exception 'Enter a rate greater than zero';
  end if;
  v_rate := p_rate;

  alter table public.planner_contribution_events
    disable trigger planner_contribution_events_apply_delta;

  begin
    update public.transactions
    set
      amount = greatest(round(amount * v_rate, 2), 0.01),
      currency = v_new
    where user_id = v_uid;

    update public.recurring_series
    set amount = greatest(round(amount * v_rate, 2), 0.01)
    where user_id = v_uid;

    update public.planner_vehicles
    set
      balance = round(balance * v_rate, 2),
      plan_amount = case
        when plan_amount is null then null
        else greatest(round(plan_amount * v_rate, 2), 0.01)
      end
    where user_id = v_uid;

    update public.planner_goals
    set
      target_amount = greatest(round(target_amount * v_rate, 2), 0.01),
      current_saved = round(current_saved * v_rate, 2),
      plan_amount = case
        when plan_amount is null then null
        else greatest(round(plan_amount * v_rate, 2), 0.01)
      end
    where user_id = v_uid;

    update public.planner_contribution_events
    set amount = case
      when amount = 0 then 0
      when amount > 0 then greatest(round(amount * v_rate, 2), 0.01)
      else least(round(amount * v_rate, 2), -0.01)
    end
    where user_id = v_uid;

    update public.profiles
    set
      currency = v_new,
      currency_converted_at = now(),
      last_fx_from = v_old,
      last_fx_to = v_new,
      last_fx_rate = v_rate
    where id = v_uid
    returning * into v_profile;
  exception
    when others then
      alter table public.planner_contribution_events
        enable trigger planner_contribution_events_apply_delta;
      raise;
  end;

  alter table public.planner_contribution_events
    enable trigger planner_contribution_events_apply_delta;

  return v_profile;
end;
$$;

comment on function public.set_account_currency(text, text, numeric) is
  'Change account currency: keep amounts as-is, or convert all money fields by one rate (1 old = rate new).';

grant execute on function public.set_account_currency(text, text, numeric) to authenticated;
revoke all on function public.set_account_currency(text, text, numeric) from public;

-- ---------------------------------------------------------------------------
-- Wipe backup v2: include user_categories + currency
-- ---------------------------------------------------------------------------
create or replace function public._account_snapshot_payload(p_user uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_payload jsonb;
  v_currency text;
begin
  select currency into v_currency from public.profiles where id = p_user;

  select jsonb_build_object(
    'version', 2,
    'currency', coalesce(v_currency, 'HKD'),
    'user_categories', coalesce(
      (
        select jsonb_agg(to_jsonb(c) order by c.created_at, c.id)
        from public.user_categories c
        where c.user_id = p_user
      ),
      '[]'::jsonb
    ),
    'transactions', coalesce(
      (
        select jsonb_agg(to_jsonb(t) order by t.created_at, t.id)
        from public.transactions t
        where t.user_id = p_user
      ),
      '[]'::jsonb
    ),
    'recurring_series', coalesce(
      (
        select jsonb_agg(to_jsonb(s) order by s.created_at, s.id)
        from public.recurring_series s
        where s.user_id = p_user
      ),
      '[]'::jsonb
    ),
    'planner_vehicles', coalesce(
      (
        select jsonb_agg(to_jsonb(v) order by v.created_at, v.id)
        from public.planner_vehicles v
        where v.user_id = p_user
      ),
      '[]'::jsonb
    ),
    'planner_goals', coalesce(
      (
        select jsonb_agg(to_jsonb(g) order by g.created_at, g.id)
        from public.planner_goals g
        where g.user_id = p_user
      ),
      '[]'::jsonb
    ),
    'planner_goal_vehicles', coalesce(
      (
        select jsonb_agg(to_jsonb(gv) order by gv.created_at, gv.goal_id, gv.vehicle_id)
        from public.planner_goal_vehicles gv
        where gv.user_id = p_user
      ),
      '[]'::jsonb
    ),
    'planner_contribution_events', coalesce(
      (
        select jsonb_agg(to_jsonb(e) order by e.created_at, e.id)
        from public.planner_contribution_events e
        where e.user_id = p_user
      ),
      '[]'::jsonb
    )
  )
  into v_payload;

  return v_payload;
end;
$$;

revoke all on function public._account_snapshot_payload(uuid) from public, anon, authenticated;

create or replace function public._account_hard_clear_product_data(p_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.partner_links
  set
    status = 'ended',
    ended_at = coalesce(ended_at, now()),
    invite_code = null
  where status in ('pending', 'active')
    and (user_a = p_user or user_b = p_user);

  delete from public.planner_contribution_events where user_id = p_user;
  delete from public.planner_goal_vehicles where user_id = p_user;
  delete from public.planner_goals where user_id = p_user;
  delete from public.planner_vehicles where user_id = p_user;

  delete from public.transactions where user_id = p_user;
  delete from public.recurring_series where user_id = p_user;
  delete from public.user_categories where user_id = p_user;
end;
$$;

revoke all on function public._account_hard_clear_product_data(uuid)
  from public, anon, authenticated;

create or replace function public._account_restore_from_payload(
  p_user uuid,
  p_payload jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_version int;
  r jsonb;
  v_currency text;
begin
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'Invalid backup payload';
  end if;

  v_version := coalesce((p_payload ->> 'version')::int, 0);
  if v_version not in (1, 2) then
    raise exception 'Unsupported backup version';
  end if;

  if v_version >= 2 then
    v_currency := nullif(trim(coalesce(p_payload ->> 'currency', '')), '');
    if v_currency is not null then
      update public.profiles
      set currency = v_currency
      where id = p_user
        and v_currency in (
          'HKD', 'USD', 'CNY', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'SGD', 'CHF',
          'INR', 'KRW', 'TWD', 'THB', 'MYR', 'PHP', 'IDR', 'NZD', 'SEK', 'NOK'
        );
    end if;

    for r in
      select value
      from jsonb_array_elements(coalesce(p_payload -> 'user_categories', '[]'::jsonb))
    loop
      insert into public.user_categories (
        id, user_id, type, name, archived_at, created_at, updated_at
      )
      values (
        (r ->> 'id')::uuid,
        p_user,
        r ->> 'type',
        r ->> 'name',
        nullif(r ->> 'archived_at', '')::timestamptz,
        coalesce((r ->> 'created_at')::timestamptz, now()),
        coalesce((r ->> 'updated_at')::timestamptz, now())
      );
    end loop;
  end if;

  alter table public.planner_contribution_events
    disable trigger planner_contribution_events_apply_delta;

  begin
    for r in
      select value
      from jsonb_array_elements(coalesce(p_payload -> 'recurring_series', '[]'::jsonb))
    loop
      insert into public.recurring_series (
        id, user_id, amount, type, category, note, cadence, anchor_at, timezone,
        active, deleted_at, created_at, updated_at, byweekday, ends_on, ends_after_count
      )
      values (
        (r ->> 'id')::uuid,
        p_user,
        (r ->> 'amount')::numeric,
        r ->> 'type',
        r ->> 'category',
        r ->> 'note',
        r ->> 'cadence',
        (r ->> 'anchor_at')::timestamptz,
        coalesce(nullif(r ->> 'timezone', ''), 'UTC'),
        coalesce((r ->> 'active')::boolean, true),
        nullif(r ->> 'deleted_at', '')::timestamptz,
        coalesce((r ->> 'created_at')::timestamptz, now()),
        coalesce((r ->> 'updated_at')::timestamptz, now()),
        case
          when r -> 'byweekday' is null or jsonb_typeof(r -> 'byweekday') = 'null'
            then null
          else (
            select array_agg(x::smallint)
            from jsonb_array_elements_text(r -> 'byweekday') as x
          )
        end,
        nullif(r ->> 'ends_on', '')::date,
        nullif(r ->> 'ends_after_count', '')::integer
      );
    end loop;

    for r in
      select value
      from jsonb_array_elements(coalesce(p_payload -> 'transactions', '[]'::jsonb))
    loop
      insert into public.transactions (
        id, user_id, amount, type, category, note, currency, occurred_at,
        deleted_at, created_at, updated_at, recurring_series_id, occurrence_key
      )
      values (
        (r ->> 'id')::uuid,
        p_user,
        (r ->> 'amount')::numeric,
        r ->> 'type',
        r ->> 'category',
        r ->> 'note',
        coalesce(
          nullif(r ->> 'currency', ''),
          (select currency from public.profiles where id = p_user),
          'HKD'
        ),
        (r ->> 'occurred_at')::timestamptz,
        nullif(r ->> 'deleted_at', '')::timestamptz,
        coalesce((r ->> 'created_at')::timestamptz, now()),
        coalesce((r ->> 'updated_at')::timestamptz, now()),
        nullif(r ->> 'recurring_series_id', '')::uuid,
        nullif(r ->> 'occurrence_key', '')
      );
    end loop;

    for r in
      select value
      from jsonb_array_elements(coalesce(p_payload -> 'planner_vehicles', '[]'::jsonb))
    loop
      insert into public.planner_vehicles (
        id, user_id, name, vehicle_type, balance, annual_rate, growth_mode,
        plan_amount, plan_cadence, notes, deleted_at, created_at, updated_at,
        compound_period
      )
      values (
        (r ->> 'id')::uuid,
        p_user,
        r ->> 'name',
        r ->> 'vehicle_type',
        coalesce((r ->> 'balance')::numeric, 0),
        coalesce((r ->> 'annual_rate')::numeric, 0),
        r ->> 'growth_mode',
        nullif(r ->> 'plan_amount', '')::numeric,
        nullif(r ->> 'plan_cadence', ''),
        r ->> 'notes',
        nullif(r ->> 'deleted_at', '')::timestamptz,
        coalesce((r ->> 'created_at')::timestamptz, now()),
        coalesce((r ->> 'updated_at')::timestamptz, now()),
        coalesce(nullif(r ->> 'compound_period', ''), 'yearly')
      );
    end loop;

    for r in
      select value
      from jsonb_array_elements(coalesce(p_payload -> 'planner_goals', '[]'::jsonb))
    loop
      insert into public.planner_goals (
        id, user_id, name, goal_type, target_amount, target_date, current_saved,
        plan_amount, plan_cadence, notes, deleted_at, created_at, updated_at
      )
      values (
        (r ->> 'id')::uuid,
        p_user,
        r ->> 'name',
        r ->> 'goal_type',
        (r ->> 'target_amount')::numeric,
        nullif(r ->> 'target_date', '')::date,
        coalesce((r ->> 'current_saved')::numeric, 0),
        nullif(r ->> 'plan_amount', '')::numeric,
        nullif(r ->> 'plan_cadence', ''),
        r ->> 'notes',
        nullif(r ->> 'deleted_at', '')::timestamptz,
        coalesce((r ->> 'created_at')::timestamptz, now()),
        coalesce((r ->> 'updated_at')::timestamptz, now())
      );
    end loop;

    for r in
      select value
      from jsonb_array_elements(coalesce(p_payload -> 'planner_goal_vehicles', '[]'::jsonb))
    loop
      insert into public.planner_goal_vehicles (
        goal_id, vehicle_id, user_id, created_at
      )
      values (
        (r ->> 'goal_id')::uuid,
        (r ->> 'vehicle_id')::uuid,
        p_user,
        coalesce((r ->> 'created_at')::timestamptz, now())
      );
    end loop;

    for r in
      select value
      from jsonb_array_elements(
        coalesce(p_payload -> 'planner_contribution_events', '[]'::jsonb)
      )
    loop
      insert into public.planner_contribution_events (
        id, user_id, goal_id, amount, contributed_at, note, created_at, updated_at
      )
      values (
        (r ->> 'id')::uuid,
        p_user,
        (r ->> 'goal_id')::uuid,
        (r ->> 'amount')::numeric,
        (r ->> 'contributed_at')::date,
        r ->> 'note',
        coalesce((r ->> 'created_at')::timestamptz, now()),
        coalesce((r ->> 'updated_at')::timestamptz, now())
      );
    end loop;
  exception
    when others then
      alter table public.planner_contribution_events
        enable trigger planner_contribution_events_apply_delta;
      raise;
  end;

  alter table public.planner_contribution_events
    enable trigger planner_contribution_events_apply_delta;

  for r in
    select value
    from jsonb_array_elements(coalesce(p_payload -> 'planner_goals', '[]'::jsonb))
  loop
    update public.planner_goals
    set current_saved = coalesce((r ->> 'current_saved')::numeric, 0)
    where id = (r ->> 'id')::uuid
      and user_id = p_user;
  end loop;
end;
$$;

revoke all on function public._account_restore_from_payload(uuid, jsonb)
  from public, anon, authenticated;
