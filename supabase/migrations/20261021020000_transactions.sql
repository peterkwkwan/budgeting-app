-- M1: transactions ledger (own-row RLS, soft-delete)
-- Founder: apply this migration in Supabase after profiles (see root README).

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  amount numeric(12, 2) not null,
  type text not null,
  category text not null,
  note text,
  currency text not null default 'USD',
  occurred_at timestamptz not null,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint transactions_amount_positive check (amount > 0),
  constraint transactions_type_valid check (type in ('expense', 'income')),
  constraint transactions_currency_usd check (currency = 'USD'),
  constraint transactions_note_length check (note is null or char_length(note) <= 500),
  constraint transactions_category_matches_type check (
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

comment on table public.transactions is 'Personal ledger rows; soft-delete via deleted_at';
comment on column public.transactions.deleted_at is 'When set, row is hidden from default queries (soft-delete)';
comment on column public.transactions.occurred_at is 'When the money moved (timestamptz; display in account TZ)';
comment on column public.transactions.currency is 'MVP: USD only';

-- Newest-first lists for active (non-deleted) rows
create index if not exists transactions_user_occurred_active_idx
  on public.transactions (user_id, occurred_at desc)
  where deleted_at is null;

-- LWW / sync helpers
create index if not exists transactions_user_updated_idx
  on public.transactions (user_id, updated_at desc);

drop trigger if exists transactions_set_updated_at on public.transactions;
create trigger transactions_set_updated_at
  before update on public.transactions
  for each row
  execute function public.set_updated_at();

alter table public.transactions enable row level security;

drop policy if exists "transactions_select_own" on public.transactions;
create policy "transactions_select_own"
  on public.transactions
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "transactions_insert_own" on public.transactions;
create policy "transactions_insert_own"
  on public.transactions
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "transactions_update_own" on public.transactions;
create policy "transactions_update_own"
  on public.transactions
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- No hard-delete policy: clients soft-delete by setting deleted_at.
