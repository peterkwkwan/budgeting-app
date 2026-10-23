-- Allow yearly trend aggregation (date_trunc 'year').
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
  v_tz text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if p_metric is null or p_metric not in ('expense', 'income', 'net') then
    raise exception 'p_metric must be expense, income, or net';
  end if;
  if p_bucket is null or p_bucket not in ('day', 'week', 'month', 'year') then
    raise exception 'p_bucket must be day, week, month, or year';
  end if;
  if p_start is null or p_end is null or p_end <= p_start then
    raise exception 'Invalid period bounds';
  end if;

  select coalesce(nullif(trim(p.timezone), ''), 'UTC')
  into v_tz
  from public.profiles p
  where p.id = auth.uid();
  v_tz := coalesce(v_tz, 'UTC');

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
      and (
        t.recurring_series_id is null
        or (t.occurred_at at time zone v_tz)::date
           <= (now() at time zone v_tz)::date
      )
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
  'Personal trend series; p_bucket day|week|month|year; recurring only on/before local today';
