# Supabase

- `migrations/` — SQL schema + RLS
  - M0: `20261017150000_profiles.sql`
  - M1: `20261021020000_transactions.sql` (ledger + soft-delete + own-row RLS)
  - M2: `20261021130000_personal_stats.sql` (personal stats RPCs)
  - M3: `20261022070000_recurring_series.sql` (`recurring_series`, occurrence keys, edit-future / stop-series RPCs)
  - M3: `20261022083000_recurring_byweekday.sql` (optional `byweekday` for weekdays / weekends)
  - M3: `20261022090000_stats_recurring_today.sql` (stats: recurring ≤ local today)
  - M3: `20261022093000_stop_series_hard_delete.sql` (stop = hard-delete rule + future instances)
- `functions/`
  - `generate-recurring` — cron; all users; `RECURRING_CRON_SECRET`
  - `catch-up-recurring` — callable with user JWT; app-open catch-up
  - `_shared/` — occurrence math + CORS helpers

Apply migrations with the Supabase CLI after linking your project (see root README).

**Founder (M3):**

```fish
npx supabase db push
npx supabase secrets set RECURRING_CRON_SECRET="$(openssl rand -hex 32)"
npx supabase functions deploy generate-recurring
npx supabase functions deploy catch-up-recurring
```

Then schedule hourly POST to `generate-recurring` with `Authorization: Bearer <RECURRING_CRON_SECRET>`.
