-- M3: series end conditions (Google-aligned Custom ends).
-- ends_on: inclusive local calendar end date (Never when null and ends_after_count null).
-- ends_after_count: max occurrences from anchor (including first).
-- Mutually exclusive: at most one of ends_on / ends_after_count.

alter table public.recurring_series
  add column if not exists ends_on date;

alter table public.recurring_series
  add column if not exists ends_after_count integer;

comment on column public.recurring_series.ends_on is
  'Inclusive end date (series TZ calendar). Null with null ends_after_count = Never.';
comment on column public.recurring_series.ends_after_count is
  'Stop after this many occurrences from anchor (inclusive). Null = not used.';

alter table public.recurring_series
  drop constraint if exists recurring_series_ends_after_positive;

alter table public.recurring_series
  add constraint recurring_series_ends_after_positive check (
    ends_after_count is null or ends_after_count >= 1
  );

alter table public.recurring_series
  drop constraint if exists recurring_series_ends_xor;

alter table public.recurring_series
  add constraint recurring_series_ends_xor check (
    not (ends_on is not null and ends_after_count is not null)
  );
