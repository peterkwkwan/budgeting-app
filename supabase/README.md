# Supabase

- `migrations/` — SQL schema + RLS
  - M0: `20261017150000_profiles.sql`
  - M1: `20261021020000_transactions.sql` (transactions + soft-delete + own-row RLS)
  - M2: `20261021130000_personal_stats.sql` (personal stats RPCs)
  - M3: `20261022070000_recurring_series.sql` (`recurring_series`, occurrence keys, edit-future / stop-series RPCs)
  - M3: `20261022083000_recurring_byweekday.sql` (optional `byweekday` for weekdays / weekends)
  - M3: `20261022090000_stats_recurring_today.sql` (stats: recurring ≤ local today)
  - M3: `20261022093000_stop_series_hard_delete.sql` (stop = hard-delete rule + future instances)
  - M3: `20261022120000_recurring_ends.sql` (`ends_on`, `ends_after_count`)
  - M4: `20261022140000_partner_links.sql` (pair invite + aggregate stats RPCs)
  - Planner P0: `20261023120000_planner.sql` (`planner_vehicles`, `planner_goals`, `planner_contribution_events`; owner-only RLS)
  - Planner P0: `20261023130000_planner_vehicle_compound_period.sql` (`compound_period` monthly|yearly on vehicles)
  - Planner P0: `20261023140000_planner_goal_vehicles.sql` (goal ↔ vehicle links; progress from balances)
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

**Founder (Planner P0):**

```fish
npx supabase db push
```

Applies planner migrations through `20261023140000_planner_goal_vehicles.sql`. No Edge Functions. Soft-delete vehicles/goals via `deleted_at`; contribution events hard-delete and adjust `planner_goals.current_saved` via trigger. `compound_period` defaults to `yearly` (full rate once per 12 projection months); `monthly` applies rate/12 each month. When a goal links vehicles, displayed progress = sum of those balances (manual contribution logs disabled while linked).
