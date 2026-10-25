# Fudget

Android-first couple budgeting app by **Kool Krib** (Expo + Supabase). App display name: **Fudget**. **M0** scaffolds Expo + Google sign-in + `profiles`. **M1** adds Transactions (`transactions` CRUD, soft-delete, multi-device sync). **M2** adds personal stats (pie + trend, default = this month). **M3** adds recurring rules (Google-aligned presets + Custom ends) with rolling ~90-day materialization. **M4** adds pair invite-code link + server-computed aggregate stats. **M5** adds on-device Android speech → confirm → save, plus light harden for using the app ourselves first.

## Repo layout

```
apps/mobile/          # Expo Router (TypeScript) Android app
supabase/
  migrations/         # SQL schema + RLS
  functions/          # Edge Functions (recurring generate + catch-up)
```

## Prerequisites

- Node.js 20+
- Expo account (for EAS)
- Supabase project (founder creates)
- Google Cloud project with an **Android** OAuth client

## Quick start (no secrets in git)

```bash
cd apps/mobile
cp .env.example .env
# Fill EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY
npm install
npx expo start
```

Placeholders merge cleanly. The login screen shows a clear hint until env is set. Google OAuth will not complete until the founder checklist below is done.

### Dev Client (required for voice — M5)

Expo Go cannot load native speech. **M5 on-device Android STT needs a Development Build** (or a new `preview` APK) after this branch. Config plugin: `expo-speech-recognition` (mic + speech package visibility).

```fish
cd apps/mobile
npx eas-cli@latest login
# Required after pulling M5 (native module + permissions):
npx eas-cli@latest build --platform android --profile development
# Play internal dogfood (AAB → internal track): see docs playbook
# Optional sideload APK (not Play):
# npx eas-cli@latest build --platform android --profile preview-apk
```

**EAS rebuild: yes** for M5 — profile `development` (Dev Client) at minimum; rebuild a store AAB (`preview` or `production`) before Play internal testing. JS-only reload is not enough.

Profiles in `apps/mobile/eas.json`:

| Profile       | Purpose                                      |
|---------------|----------------------------------------------|
| `development` | Dev Client (`developmentClient: true`) APK   |
| `preview`     | Play-ready AAB (dogfood; submit → internal)  |
| `preview-apk` | Sideload APK via EAS internal link (not Play)|
| `production`  | Play AAB (submit still **internal** track)   |

**Play internal dogfood:** build `preview` (or `production`) AAB, then `eas submit --profile preview` (track `internal`, `releaseStatus: draft`). Full founder checklist: Project store doc `docs/play-internal-dogfood.md`. Do **not** promote to production track until intentionally releasing publicly.

**Dev Client Android note:** the `development` profile builds **arm64-v8a only** (physical Pixel / most Android devices) and caps Gradle workers for free-tier EAS. Stats charts are View-only (no Skia). It will not install on classic x86_64 emulators unless you temporarily set `ORG_GRADLE_PROJECT_reactNativeArchitectures=x86_64` for a one-off build.

**Voice permissions:** on Add Transaction, the mic asks for microphone. If denied, enter the transaction manually. Prefer installing an English offline speech / language pack in Android settings so recognition stays on-device.

## Apply SQL migrations

With the [Supabase CLI](https://supabase.com/docs/guides/cli) linked to your project:

```bash
npx supabase db push
# or: npx supabase migration up
```

| Migration | What it does |
|-----------|----------------|
| `supabase/migrations/20261017150000_profiles.sql` | `public.profiles` + RLS + `updated_at` + auth insert trigger |
| `supabase/migrations/20261021020000_transactions.sql` | **M1** `public.transactions` + own-row RLS + soft-delete + indexes |
| `supabase/migrations/20261021130000_personal_stats.sql` | **M2** personal stats RPCs (`stats_personal_*`) under RLS; own rows only |
| `supabase/migrations/20261022070000_recurring_series.sql` | **M3** `recurring_series` + txn `occurrence_key` + edit-future / stop-series RPCs |
| `supabase/migrations/20261022083000_recurring_byweekday.sql` | **M3** optional `byweekday` mask (weekdays / weekends presets) |
| `supabase/migrations/20261022090000_stats_recurring_today.sql` | **M3** stats: recurring only on/before local today; one-offs may be future |
| `supabase/migrations/20261022093000_stop_series_hard_delete.sql` | **M3** stop-series hard-deletes rule + future instances; cleans inactive ghosts |
| `supabase/migrations/20261022120000_recurring_ends.sql` | **M3** `ends_on` + `ends_after_count` (Never / On date / After N) |
| `supabase/migrations/20261022140000_partner_links.sql` | **M4** `partner_links` + invite/accept/unlink RPCs + `stats_aggregate_*` (aggregates only) |
| `supabase/migrations/20261023120000_planner.sql` | **Planner P0** `planner_vehicles` + `planner_goals` + `planner_contribution_events` (own-row RLS; soft-delete vehicles/goals) |
| `supabase/migrations/20261023130000_planner_vehicle_compound_period.sql` | **Planner P0** `planner_vehicles.compound_period` (`monthly` \| `yearly`, default yearly) |
| `supabase/migrations/20261023140000_planner_goal_vehicles.sql` | **Planner P0** `planner_goal_vehicles` join (goal ↔ vehicles; progress = sum of linked balances) |
| `supabase/migrations/20261023160000_transactions_date_view.sql` | **Transactions** `profiles.transactions_date_view` (`list` \| `week` \| `month`, default `month`) |
| `supabase/migrations/20261023170000_stats_trend_year_bucket.sql` | **Stats** `stats_personal_trend` allows `p_bucket` `year` (Yearly Trend) |
| `supabase/migrations/20261025010000_stats_trend_year_tz.sql` | **Stats** re-assert `year` + truncate buckets in profile timezone |
| `supabase/migrations/20261025020000_account_wipe_restore.sql` | **Account** wipe backup table + `wipe_my_data` / `restore_my_data` / `get_account_backup_status` / `delete_my_account_data` / `purge_expired_account_backups` |

**Founder step (Account wipe + Delete account):** apply `20261025020000_account_wipe_restore.sql` (`npx supabase db push`), deploy Edge Functions `purge-account-backups` + `delete-account`, schedule daily purge cron (see below). **EAS rebuild: no** (JS + SQL + functions). Until applied, Settings → Wipe / Restore / Delete will error. Details: `docs/account-wipe-apply.md` in the Project store (or this README section).

**Founder step (Stats Yearly Trend):** apply through `20261025010000_stats_trend_year_tz.sql` (`npx supabase db push`). No Edge Functions. **EAS rebuild: no.** Until applied, Stats → Yearly shows “Couldn’t load stats” / `p_bucket must be day, week, or month`.

**Founder step (Transactions date views):** apply `20261023160000_transactions_date_view.sql` (`npx supabase db push`). No Edge Functions. **EAS rebuild: no.** Until applied, List · Week · Month toggle still works in-session; saving the preference fails until the column exists.

**Founder step (Planner P0):** apply planner migrations through `20261023140000` (`npx supabase db push`). No new Edge Functions. Until applied, the Planner tab’s goals/vehicles CRUD will error. **EAS rebuild: no** (JS + SQL; View-only projection chart). Contributions stay Planner-local (do **not** create Transactions). Tab order: Transactions · Add FAB · Stats · Planner · Account. Vehicles use plain-language yearly growth/interest labels + Monthly/Yearly compounding (default Yearly).

**Founder step (M3):** after pulling this branch, run the recurring migrations, deploy Edge Functions, set `RECURRING_CRON_SECRET`, and schedule hourly cron (see below). Until migrations + functions are live, Add → Repeat / catch-up will error. Recurring is **not** a bottom tab — create via Add transaction → Repeat; manage via Upcoming repeats or Account → Recurring rules.

**Founder step (M4):** apply `20261022140000_partner_links.sql` (`npx supabase db push`). No new Edge Functions — invite/accept/unlink and aggregate stats are Postgres RPCs under RLS. Until applied, Account → Partner and Stats → Pair will error. **EAS rebuild: no** (JS + SQL only; Share uses built-in React Native API).

**Founder step (M5):** no new SQL. **EAS rebuild: yes** — `development` (and Play AAB via `preview` / `production`) so `expo-speech-recognition` + mic permissions land in the native binary. After install: **+** → Add Transaction → **mic** → speak → review/edit fields → **Save** (same path as manual). Failure/permission → retry or type fields. iOS / paid cloud STT / **production** Play track remain out of scope; **Play internal testing** for founder + partner is the dogfood path (see `docs/play-internal-dogfood.md` in the Project store).

Transaction columns (M1+): `amount`, `type` (`expense`\|`income`), fixed `category`, optional `note` (≤500), `currency` (USD), `occurred_at`, `deleted_at`, timestamps, `user_id`. M3 adds `recurring_series_id` + `occurrence_key` for auto-generated rows. Default app queries filter `deleted_at is null`. Soft-delete updates `deleted_at` (no hard delete from the client). Soft-deleted recurring instances are **not** regenerated.

### M3 Edge Functions + cron

| Function | Trigger | Purpose |
|----------|---------|---------|
| `generate-recurring` | Cron (hourly recommended) | All active series → ensure instances for rolling 90d (also backfills up to 90d) |
| `catch-up-recurring` | App open / after create | Same logic scoped to the signed-in user |

```fish
# From repo root, linked to your Supabase project:
npx supabase db push
npx supabase secrets set RECURRING_CRON_SECRET="$(openssl rand -hex 32)"
npx supabase functions deploy generate-recurring
npx supabase functions deploy catch-up-recurring
```

Schedule cron (Dashboard → Edge Functions → `generate-recurring` → Schedules, or Database → Cron):

- Schedule: `0 * * * *` (hourly)
- HTTP POST to the function URL
- Header: `Authorization: Bearer <RECURRING_CRON_SECRET>` (same value as the secret)

`generate-recurring` has `verify_jwt = false` and checks the cron secret itself. `catch-up-recurring` requires a user JWT (`verify_jwt = true`).

### Account wipe backups + Delete account (Edge Functions)

| Function | Trigger | Purpose |
|----------|---------|---------|
| `purge-account-backups` | Daily cron | Hard-delete expired 30-day wipe backups |
| `delete-account` | App (user JWT) | Clear product data + permanently delete Auth user |

```fish
# From repo root, linked to your Supabase project:
npx supabase db push
npx supabase functions deploy purge-account-backups
npx supabase functions deploy delete-account
# Optional dedicated secret (otherwise RECURRING_CRON_SECRET is reused):
# npx supabase secrets set ACCOUNT_BACKUP_CRON_SECRET="$(openssl rand -hex 32)"
```

Schedule cron (Dashboard → Edge Functions → `purge-account-backups` → Schedules, or Database → Cron):

- Schedule: `15 6 * * *` (daily)
- Method: `POST`
- Header: `Authorization: Bearer <ACCOUNT_BACKUP_CRON_SECRET or RECURRING_CRON_SECRET>`

`purge-account-backups` has `verify_jwt = false` and checks the cron secret. `delete-account` requires a user JWT (`verify_jwt = true`).

**Wipe my data** (Settings → Danger zone): keeps Google Auth + profile; snapshots product data for 30 days; self-serve **Restore my data** replaces the app and discards post-wipe rows. After 30 days the backup is purged and Restore disappears.

**Delete my account**: irreversible after typing `DELETE` — Auth user + all data (no 30-day undo).

## Founder action checklist (Google + Supabase)

Do these once so sign-in works end-to-end on a physical Android device or emulator with Google Play:

1. **Create a Supabase project**  
   Dashboard → copy **Project URL** and **anon public** key into `apps/mobile/.env`.

2. **Create a Google Cloud OAuth client (Android)**  
   - Google Cloud Console → APIs & Services → Credentials → Create credentials → OAuth client ID  
   - Application type: **Android**  
   - Package name: `com.koolkrib.fudget` (see `apps/mobile/app.json`)  
   - SHA-1: from your debug/upload keystore, e.g.  
     `keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android`  
     For EAS builds, use the SHA-1 from `eas credentials` / Play App Signing.

3. **(Recommended) Also create a Web OAuth client**  
   Supabase Google provider typically needs the **Web client ID + secret** for the server-side exchange. Keep the Android client for Play/package association.

4. **Enable Google in Supabase Auth**  
   Authentication → Providers → Google → paste Web client ID + secret → save.

5. **Add redirect URLs in Supabase**  
   Authentication → URL configuration:  
   - Site URL: `fudget://auth/callback`  
   - Additional redirect URLs:  
     - `fudget://auth/callback`  
     - Expo AuthSession redirect (printed at runtime / from `makeRedirectUri`), e.g. `exp://192.168.x.x:8081/--/auth/callback` during local dev  
     - After Dev Client: the same custom scheme `fudget://auth/callback`

6. **Run migrations** — profiles (M0), transactions (M1), personal stats (M2), recurring (M3), partner links (M4); see above.

7. **Deploy M3 Edge Functions + cron** — see “M3 Edge Functions + cron” above. M4 needs **no** new Edge Functions (RPCs only).

8. **Deploy account wipe / delete functions** — after `db push` for `20261025020000_account_wipe_restore.sql`, deploy `purge-account-backups` + `delete-account` and schedule daily purge (see “Account wipe backups + Delete account” above).

9. **Build a Dev Client** when you leave Expo Go (required before voice STT in M5). M3/M4 / account wipe add **no new native modules** — existing Dev Client / Expo Go reload is enough.

9. **Smoke test**  
   Open the app → Continue with Google → **Transactions** tab → **+** → set **Repeat** (e.g. weekdays) → Save → confirm rows (· Recurring) and **Upcoming repeats** bar → tap bar to manage rules (edit future / stop series). One-off Add without Repeat still works. **Stats** tab: default **This month**, etc. **Account** → Recurring rules also opens manage. Soft-delete one instance; stop series from the rule screen. Bottom tabs are Transactions / Stats / Account (raised **+** FAB).  
   **M4:** Account → Partner → Create code on device A; Enter code on device B → both show paired. Stats → **Pair** shows combined category totals (no drill-down). Unlink → Pair scope gone immediately. Confirm clients never list partner transaction rows.

Voice lands in M5.

## Scripts

| Command | Where | What |
|---------|-------|------|
| `npm start` / `npx expo start` | `apps/mobile` | Metro bundler |
| `npx expo start --android` | `apps/mobile` | Open Android |
| `npx tsc --noEmit` | `apps/mobile` | Typecheck |
| `npx eas-cli@latest build --profile development --platform android` | `apps/mobile` | Dev Client APK |
| `npx eas-cli@latest build --profile preview --platform android` | `apps/mobile` | Play-ready AAB (internal track) |
| `npx eas-cli@latest submit --profile preview --platform android` | `apps/mobile` | Upload AAB to Play **internal** |

## Security notes

- Only `EXPO_PUBLIC_*` keys belong in the mobile app (anon key is public by design; RLS protects data).
- Never commit service role keys, OAuth client secrets, or `.env` files.
- Partner transaction privacy (no partner rows on device) is enforced in later milestones via server aggregates + RLS.
