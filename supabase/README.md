# Supabase

- `migrations/` — SQL schema + RLS
  - M0: `20261017150000_profiles.sql`
  - M1: `20261021020000_transactions.sql` (ledger + soft-delete + own-row RLS)
- `functions/` — Edge Functions stub (recurring / partner in later milestones)

Apply migrations with the Supabase CLI after linking your project (see root README).

**Founder (M1):** run `npx supabase db push` (or paste/run the new SQL in the Supabase SQL editor) so `public.transactions` exists before testing the Ledger tab.
