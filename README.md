# Fudget

Android-first couple budgeting app by **Kool Krib** (Expo + Supabase). App display name: **Fudget**. Milestone **M0** scaffolds the repo, Google sign-in wiring, and a `profiles` schema. Later milestones add ledger, stats, recurring, partner aggregates, and voice.

## Repo layout

```
apps/mobile/          # Expo Router (TypeScript) Android app
supabase/
  migrations/         # SQL schema + RLS
  functions/          # Edge Functions (stub for later milestones)
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

### Dev Client (required later for voice)

Expo Go is fine for early UI, but **on-device speech (M5) needs a Development Build**. Use the EAS `development` profile:

```bash
cd apps/mobile
npx eas-cli@latest login
npx eas-cli@latest build:configure   # once; replaces REPLACE_WITH_EAS_PROJECT_ID in app.json
npx eas-cli@latest build --platform android --profile development
```

Profiles in `apps/mobile/eas.json`:

| Profile       | Purpose                                      |
|---------------|----------------------------------------------|
| `development` | Dev Client (`developmentClient: true`)       |
| `preview`     | Internal APK for testers                     |
| `production`  | Play App Bundle (internal track submit later)|

## Apply the M0 migration

With the [Supabase CLI](https://supabase.com/docs/guides/cli) linked to your project:

```bash
npx supabase db push
# or: npx supabase migration up
```

Migration: `supabase/migrations/20261017150000_profiles.sql`  
Creates `public.profiles` (`id`, `display_name`, `timezone`, timestamps), RLS (own row only), `updated_at` trigger, and an `auth.users` insert trigger. The app also **upserts** the profile on first login and sets the device IANA timezone via `expo-localization`.

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

6. **Run the profiles migration** (see above).

7. **Build a Dev Client** when you leave Expo Go (required before voice STT).

8. **Smoke test**  
   Open the app → Continue with Google → land on Home with email, display name, and timezone.

Transactions, recurring series, and partner tables are intentionally **not** in M0.

## Scripts

| Command | Where | What |
|---------|-------|------|
| `npm start` / `npx expo start` | `apps/mobile` | Metro bundler |
| `npx expo start --android` | `apps/mobile` | Open Android |
| `npx tsc --noEmit` | `apps/mobile` | Typecheck |
| `npx eas-cli@latest build --profile development --platform android` | `apps/mobile` | Dev Client APK |

## Security notes

- Only `EXPO_PUBLIC_*` keys belong in the mobile app (anon key is public by design; RLS protects data).
- Never commit service role keys, OAuth client secrets, or `.env` files.
- Partner transaction privacy (no partner rows on device) is enforced in later milestones via server aggregates + RLS.
