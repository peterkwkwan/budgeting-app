-- Transactions date view preference on profiles (List / Week / Month).
-- Default month — founder preferred the calendar view.
-- Founder: npx supabase db push

alter table public.profiles
  add column if not exists transactions_date_view text;

alter table public.profiles
  alter column transactions_date_view set default 'month';

update public.profiles
set transactions_date_view = 'month'
where transactions_date_view is null;

alter table public.profiles
  alter column transactions_date_view set not null;

alter table public.profiles
  drop constraint if exists profiles_transactions_date_view_check;

alter table public.profiles
  add constraint profiles_transactions_date_view_check
  check (transactions_date_view in ('list', 'week', 'month'));

comment on column public.profiles.transactions_date_view is
  'Transactions screen date layout: list (by day), week (day strip), or month (calendar). Default month.';

-- Existing RLS already allows authenticated users to select/update their own profiles row.
