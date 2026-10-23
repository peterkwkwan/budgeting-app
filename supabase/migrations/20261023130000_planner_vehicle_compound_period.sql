-- Planner P0 follow-up: compound period on vehicles (yearly default, or monthly).
-- Safe if 20261023120000_planner.sql already applied; no-op column if re-run.
-- If this migration was applied earlier with default 'monthly', the ALTER below
-- corrects the column default for new rows.

alter table public.planner_vehicles
  add column if not exists compound_period text not null default 'yearly';

alter table public.planner_vehicles
  alter column compound_period set default 'yearly';

alter table public.planner_vehicles
  drop constraint if exists planner_vehicles_compound_period_valid;

alter table public.planner_vehicles
  add constraint planner_vehicles_compound_period_valid check (
    compound_period in ('monthly', 'yearly')
  );

comment on column public.planner_vehicles.compound_period is
  'How often the yearly rate compounds in projections: yearly (full rate once per 12 months, default) or monthly (rate/12 each month).';

comment on column public.planner_vehicles.annual_rate is
  'User-entered yearly rate percent (growth ≈ APY, debt ≈ APR). Compounding controlled by compound_period.';
