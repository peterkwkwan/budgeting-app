-- M3: stop-series hard-deletes the rule (no "Stopped" ghosts).
-- Past/today ledger instances stay (FK ON DELETE SET NULL clears series link).
-- Future instances (local calendar date after today) are removed.
-- One-time cleanup: remove any already-inactive / soft-deleted series.

-- ---------------------------------------------------------------------------
-- Cleanup existing stopped / soft-deleted rules
-- ---------------------------------------------------------------------------
do $$
declare
  r record;
  v_tz text;
begin
  for r in
    select s.id, s.user_id, coalesce(nullif(trim(p.timezone), ''), 'UTC') as tz
    from public.recurring_series s
    left join public.profiles p on p.id = s.user_id
    where s.active = false
       or s.deleted_at is not null
  loop
    v_tz := coalesce(r.tz, 'UTC');
    delete from public.transactions t
    where t.recurring_series_id = r.id
      and t.user_id = r.user_id
      and (t.occurred_at at time zone v_tz)::date
          > (now() at time zone v_tz)::date;
    delete from public.recurring_series s
    where s.id = r.id;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Replace stop RPC: hard-delete rule + future instances
-- SECURITY DEFINER so we can hard-delete without exposing client DELETE policies
-- ---------------------------------------------------------------------------
create or replace function public.stop_recurring_series(p_series_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_tz text;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if not exists (
    select 1
    from public.recurring_series s
    where s.id = p_series_id
      and s.user_id = v_uid
  ) then
    raise exception 'Series not found';
  end if;

  select coalesce(nullif(trim(p.timezone), ''), 'UTC')
  into v_tz
  from public.profiles p
  where p.id = v_uid;
  v_tz := coalesce(v_tz, 'UTC');

  -- Drop future generated instances (after local today). Past + today stay.
  delete from public.transactions t
  where t.recurring_series_id = p_series_id
    and t.user_id = v_uid
    and (t.occurred_at at time zone v_tz)::date
        > (now() at time zone v_tz)::date;

  -- Hard-delete the rule. Remaining instances keep history; FK sets series_id null.
  delete from public.recurring_series s
  where s.id = p_series_id
    and s.user_id = v_uid;
end;
$$;

comment on function public.stop_recurring_series(uuid) is
  'M3: stop-series — hard-delete rule + future instances; past/today ledger rows remain';

comment on column public.recurring_series.active is
  'Legacy flag; stop-series now hard-deletes the row. Generators still require active=true.';

revoke all on function public.stop_recurring_series(uuid) from public;
grant execute on function public.stop_recurring_series(uuid) to authenticated;
