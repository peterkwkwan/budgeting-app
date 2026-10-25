-- Account wipe + 30-day backup/restore + helpers for Delete Account.
-- Wipe keeps Google Auth + profiles; clears product data into legal-hold backup.
-- Founder: `npx supabase db push`, then deploy purge-account-backups (+ delete-account).
-- See root README / docs/account-wipe-apply.md.

-- ---------------------------------------------------------------------------
-- Backup / legal-hold (one active row per user; replaced on second wipe)
-- ---------------------------------------------------------------------------
create table if not exists public.account_data_backups (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  wiped_at timestamptz not null default now(),
  expires_at timestamptz not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  constraint account_data_backups_expires_after_wipe check (expires_at > wiped_at),
  constraint account_data_backups_payload_object check (jsonb_typeof(payload) = 'object')
);

comment on table public.account_data_backups is
  '30-day legal-hold snapshot after Wipe my data; purged by cron or on restore/delete';
comment on column public.account_data_backups.payload is
  'versioned jsonb: transactions, recurring_series, planner_* (no Auth/profile)';
comment on column public.account_data_backups.expires_at is
  'wiped_at + 30 days; restore CTA only while now() < expires_at';

create index if not exists account_data_backups_expires_at_idx
  on public.account_data_backups (expires_at);

alter table public.account_data_backups enable row level security;

-- Owners may read metadata only via RPC; no direct table access for clients.
revoke all on table public.account_data_backups from anon, authenticated, public;
grant all on table public.account_data_backups to service_role;

-- ---------------------------------------------------------------------------
-- Internal: snapshot + hard-clear product data for auth.uid() / p_user
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
begin
  select jsonb_build_object(
    'version', 1,
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
  -- Partner: end pending/active links involving this user (both sides).
  update public.partner_links
  set
    status = 'ended',
    ended_at = coalesce(ended_at, now()),
    invite_code = null
  where status in ('pending', 'active')
    and (user_a = p_user or user_b = p_user);

  -- Planner (FK order)
  delete from public.planner_contribution_events where user_id = p_user;
  delete from public.planner_goal_vehicles where user_id = p_user;
  delete from public.planner_goals where user_id = p_user;
  delete from public.planner_vehicles where user_id = p_user;

  -- Ledger + recurring (txn FK to series is ON DELETE SET NULL; clear both)
  delete from public.transactions where user_id = p_user;
  delete from public.recurring_series where user_id = p_user;
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
begin
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'Invalid backup payload';
  end if;

  v_version := coalesce((p_payload ->> 'version')::int, 0);
  if v_version <> 1 then
    raise exception 'Unsupported backup version';
  end if;

  -- Avoid double-counting current_saved while replaying contribution events.
  alter table public.planner_contribution_events
    disable trigger planner_contribution_events_apply_delta;

  begin
    -- Recurring rules before transactions (occurrence FK)
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
        coalesce(nullif(r ->> 'currency', ''), 'USD'),
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

  -- Re-assert goal progress from backup (trigger was disabled during event insert).
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

-- ---------------------------------------------------------------------------
-- Public RPCs (security definer, auth.uid())
-- ---------------------------------------------------------------------------
create or replace function public.wipe_my_data()
returns table (
  wiped_at timestamptz,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_wiped timestamptz := now();
  v_expires timestamptz;
  v_payload jsonb;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  v_expires := v_wiped + interval '30 days';
  v_payload := public._account_snapshot_payload(v_uid);

  insert into public.account_data_backups (user_id, wiped_at, expires_at, payload)
  values (v_uid, v_wiped, v_expires, v_payload)
  on conflict (user_id) do update
  set
    wiped_at = excluded.wiped_at,
    expires_at = excluded.expires_at,
    payload = excluded.payload,
    created_at = now();

  perform public._account_hard_clear_product_data(v_uid);

  return query select v_wiped, v_expires;
end;
$$;

comment on function public.wipe_my_data() is
  'Snapshot product data for 30 days, hard-clear ledger/recurring/planner, unlink partner; keep Auth + profile';

create or replace function public.restore_my_data()
returns table (
  wiped_at timestamptz,
  restored_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.account_data_backups%rowtype;
  v_restored timestamptz := now();
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_row
  from public.account_data_backups b
  where b.user_id = v_uid
  for update;

  if not found then
    raise exception 'No backup to restore';
  end if;

  if v_row.expires_at <= now() then
    delete from public.account_data_backups where user_id = v_uid;
    raise exception 'Restore window ended';
  end if;

  -- Replace: discard anything created after wipe.
  perform public._account_hard_clear_product_data(v_uid);
  perform public._account_restore_from_payload(v_uid, v_row.payload);

  delete from public.account_data_backups where user_id = v_uid;

  return query select v_row.wiped_at, v_restored;
end;
$$;

comment on function public.restore_my_data() is
  'Self-serve restore within 30 days; replaces post-wipe product data; clears backup';

create or replace function public.get_account_backup_status()
returns table (
  has_backup boolean,
  wiped_at timestamptz,
  expires_at timestamptz,
  restore_available boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.account_data_backups%rowtype;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_row
  from public.account_data_backups b
  where b.user_id = v_uid;

  if not found then
    return query
    select false, null::timestamptz, null::timestamptz, false;
    return;
  end if;

  if v_row.expires_at <= now() then
    -- Treat as gone for the client; cron will hard-purge the row.
    return query
    select false, null::timestamptz, null::timestamptz, false;
    return;
  end if;

  return query
  select true, v_row.wiped_at, v_row.expires_at, true;
end;
$$;

comment on function public.get_account_backup_status() is
  'Whether auth.uid() has an unexpired wipe backup (for Restore CTA / banner)';

-- Called by Edge Function (service role) or SQL cron; no user JWT required.
create or replace function public.purge_expired_account_backups()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  delete from public.account_data_backups
  where expires_at <= now();
  get diagnostics v_count = row_count;
  return coalesce(v_count, 0);
end;
$$;

comment on function public.purge_expired_account_backups() is
  'Hard-delete expired wipe backups; invoke daily via Edge Function or pg_cron';

-- Pre-delete helper: clear product data + backup before Auth user delete.
-- Edge Function delete-account calls this under the user JWT, then admin.deleteUser.
create or replace function public.delete_my_account_data()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  delete from public.account_data_backups where user_id = v_uid;
  perform public._account_hard_clear_product_data(v_uid);
  -- Profile row remains until auth.users delete cascades; Auth deletion is Edge Function.
end;
$$;

comment on function public.delete_my_account_data() is
  'Irreversible product wipe + drop any restore backup; pair with Auth user delete';

grant execute on function public.wipe_my_data() to authenticated;
grant execute on function public.restore_my_data() to authenticated;
grant execute on function public.get_account_backup_status() to authenticated;
grant execute on function public.delete_my_account_data() to authenticated;

revoke all on function public.wipe_my_data() from public;
revoke all on function public.restore_my_data() from public;
revoke all on function public.get_account_backup_status() from public;
revoke all on function public.delete_my_account_data() from public;

-- Service role / postgres for cron purge; not granted to authenticated clients.
revoke all on function public.purge_expired_account_backups() from public, anon, authenticated;
grant execute on function public.purge_expired_account_backups() to service_role;
