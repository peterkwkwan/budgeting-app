-- M3 follow-up: weekday mask for weekdays / weekends presets on recurring_series.
-- byweekday: 0=Sunday … 6=Saturday (matches JS Date.getDay / civil weekday helper).
-- NULL = no mask (plain D/W/M/Y). Used with cadence='daily' for Mon–Fri / Sat–Sun.

alter table public.recurring_series
  add column if not exists byweekday smallint[];

comment on column public.recurring_series.byweekday is
  'Optional weekday mask (0=Sun..6=Sat). NULL = every occurrence of cadence. With daily: only listed weekdays.';

alter table public.recurring_series
  drop constraint if exists recurring_series_byweekday_valid;

alter table public.recurring_series
  add constraint recurring_series_byweekday_valid check (
    byweekday is null
    or (
      cardinality(byweekday) > 0
      and byweekday <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[]
    )
  );
