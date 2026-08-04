# Setup: accounts + encrypted sync (Supabase)

Sync is **opt-in**. A user who never creates an account is 100% local-first, exactly
as before. This guide is for the developer deploying a build with Sync enabled.

## What gets stored where

| What | Where |
|---|---|
| Dataset (logs, journals, settings) | On the device (IndexedDB), encrypted at rest if a PIN is set |
| Encrypted snapshot (salted ciphertext only) | Supabase Postgres — `vaults` table, one row per user |
| Password / recovery key / data key | Nowhere. Derived in memory on the device; the recovery key is stored only as a SHA-256 hash |
| Sign-in identity | Supabase Auth — masked email `<username>@lantern.local` (never mailed) |

## 1. Create a Supabase project

1. Create a project at https://supabase.com (free tier is fine to start).
2. In **Authentication → Providers**, leave Email enabled. Set **"Confirm email" to
   OFF** — the masked addresses are never mailed, so confirmations would brick sign-up.
3. Optionally turn off "Enable email confirmations" and any email templates for the
   masked domain.

## 2. Apply the migration

Open **SQL Editor** and run `supabase/migrations/0001_accounts_sync.sql`, or push it
with the CLI:

```bash
supabase link --project-ref <your-project-ref>
supabase db push
```

The migration creates `profiles`, `vaults`, `recovery_codes` with RLS, a signup
trigger that copies the username, and security-definer recovery RPCs.

## 3. Environment variables

Create `.env.local` (already gitignored) and set the same values in your deploy host:

```
# Public (safe in the client bundle — RLS is the real gate):
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>

# Server-only (never expose to the client):
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service_role key>
```

> Find both keys in **Project Settings → API**. The `service_role` key bypasses RLS —
> it must exist only in the Node runtime (the two API routes), never in client code.

## 4. Run + verify

```bash
npm install
npx vitest run      # 76 tests, incl. tests/vault.test.ts (envelope + merge)
npm run build
npm start
```

Manual smoke test (Settings → Sync):

1. **Create account** → recovery key is shown once; copy it and store it.
2. Add a log/tag, wait ~5 s (debounced push) → open DevTools → Network: a PUT to
   `/vaults` with an `Authorization` header and no readable payload.
3. Open the app in a second browser/profile, sign in, confirm the data appears
   (pull + merge on sign-in).
4. Edit on device B → device A shows the change after its next sync.
5. **Change password**, then sign out and sign back in with the new password.
6. **Forgot password** → enter username + recovery key + new password; sign in.
7. **Delete account** → confirm the row disappears from `vaults`/`profiles`.

## Security checks after setup

- In **SQL Editor**, confirm RLS is enabled on all three tables and that a request
  without a JWT returns zero rows:
  ```sql
  select * from vaults;              -- must return 0 rows
  select * from profiles;            -- must return 0 rows
  ```
- Confirm `next.config.ts` CSP `connect-src` includes only your Supabase origin.
- Confirm the service-role key is not in the client bundle: search the built output
  for `<project-ref>.supabase.co` env in `_next/static` (only the anon key + URL
  should appear).

## Deployment notes

- Sync requires the two Node API routes (`app/api/recovery`, `app/api/account`), so a
  static export (`output: "export"`) cannot serve Sync. Deploy on a Node runtime
  (Vercel, Fly, Railway, a plain VPS with `next start`).
- The recovery/account routes are rate-limited **per server instance** (in-memory).
  For coordinated limits across many instances, move the counter into the Supabase
  database or an edge cache.
- The service-role key is required at deploy time; treat it like any other secret
  (rotate via Supabase dashboard if it ever leaks).
