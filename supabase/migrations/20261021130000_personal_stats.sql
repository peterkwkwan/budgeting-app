-- M2: personal stats RPCs (own rows only under RLS; soft-deleted excluded)
-- Founder: apply after profiles + transactions migrations.
-- Privacy: these functions never touch other users' rows (security invoker + auth.uid()).

-- Category pie / breakdown for one type in [p_start, p_end)
create or replace function public.stats_personal_by_category(
  p_type text,
  p_start timestamptz,
  p_end timestamptz
)
returns table (
  category text,
  type text,
  sum numeric,
  count bigint
)
language plpgsql
stable
security invoker
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if p_type is null or p_type not in ('expense', 'income') then
    raise exception 'p_type must be expense or income';
  end if;
  if p_start is null or p_end is null or p_end <= p_start then
    raise exception 'Invalid period bounds';
  end if;

  return query
  select
    t.category,
    t.type,
    coalesce(sum(t.amount), 0)::numeric as sum,
    count(*)::bigint as count
  from public.transactions t
  where t.user_id = auth.uid()
    and t.deleted_at is null
    and t.type = p_type
    and t.occurred_at >= p_start
    and t.occurred_at < p_end
    and t.occurred_at <= now()
  group by t.category, t.type
  order by sum desc, t.category asc;
end;
$$;

comment on function public.stats_personal_by_category(text, timestamptz, timestamptz) is
  'M2 personal category totals for auth.uid() only; excludes soft-deleted and future occurred_at';

-- Period header totals
create or replace function public.stats_personal_totals(
  p_start timestamptz,
  p_end timestamptz
)
returns table (
  expense_sum numeric,
  income_sum numeric,
  expense_count bigint,
  income_count bigint
)
language plpgsql
stable
security invoker
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if p_start is null or p_end is null or p_end <= p_start then
    raise exception 'Invalid period bounds';
  end if;

  return query
  select
    coalesce(sum(t.amount) filter (where t.type = 'expense'), 0)::numeric as expense_sum,
    coalesce(sum(t.amount) filter (where t.type = 'income'), 0)::numeric as income_sum,
    count(*) filter (where t.type = 'expense')::bigint as expense_count,
    count(*) filter (where t.type = 'income')::bigint as income_count
  from public.transactions t
  where t.user_id = auth.uid()
    and t.deleted_at is null
    and t.occurred_at >= p_start
    and t.occurred_at < p_end
    and t.occurred_at <= now();
end;
$$;

comment on function public.stats_personal_totals(timestamptz, timestamptz) is
  'M2 personal expense/income totals for auth.uid() only';

-- Trend line buckets: expense | income | net
-- p_bucket: day | week | month (date_trunc unit)
create or replace function public.stats_personal_trend(
  p_metric text,
  p_start timestamptz,
  p_end timestamptz,
  p_bucket text
)
returns table (
  bucket_start timestamptz,
  total numeric
)
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_trunc text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if p_metric is null or p_metric not in ('expense', 'income', 'net') then
    raise exception 'p_metric must be expense, income, or net';
  end if;
  if p_bucket is null or p_bucket not in ('day', 'week', 'month') then
    raise exception 'p_bucket must be day, week, or month';
  end if;
  if p_start is null or p_end is null or p_end <= p_start then
    raise exception 'Invalid period bounds';
  end if;

  v_trunc := p_bucket;

  return query
  with scoped as (
    select
      date_trunc(v_trunc, t.occurred_at) as bucket_start,
      t.type,
      t.amount
    from public.transactions t
    where t.user_id = auth.uid()
      and t.deleted_at is null
      and t.occurred_at >= p_start
      and t.occurred_at < p_end
      and t.occurred_at <= now()
      and (
        p_metric = 'net'
        or t.type = p_metric
      )
  ),
  aggregated as (
    select
      s.bucket_start,
      case
        when p_metric = 'net' then
          coalesce(sum(s.amount) filter (where s.type = 'income'), 0)
          - coalesce(sum(s.amount) filter (where s.type = 'expense'), 0)
        else
          coalesce(sum(s.amount), 0)
      end::numeric as total
    from scoped s
    group by s.bucket_start
  )
  select a.bucket_start, a.total
  from aggregated a
  order by a.bucket_start asc;
end;
$$;

comment on function public.stats_personal_trend(text, timestamptz, timestamptz, text) is
  'M2 personal trend buckets for auth.uid() only; metric expense|income|net';

grant execute on function public.stats_personal_by_category(text, timestamptz, timestamptz)
  to authenticated;
grant execute on function public.stats_personal_totals(timestamptz, timestamptz)
  to authenticated;
grant execute on function public.stats_personal_trend(text, timestamptz, timestamptz, text)
  to authenticated;

revoke all on function public.stats_personal_by_category(text, timestamptz, timestamptz)
  from public;
revoke all on function public.stats_personal_totals(timestamptz, timestamptz)
  from public;
revoke all on function public.stats_personal_trend(text, timestamptz, timestamptz, text)
  from public;
