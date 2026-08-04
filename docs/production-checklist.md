# Production Checklist

Run this before shipping a release. Keep it in the repo so it is always next to the code.

## Code health

- [ ] `npx tsc --noEmit` passes with no errors.
- [ ] `npx eslint .` passes with no errors.
- [ ] `npx vitest run` passes (full suite).
- [ ] `npm run build` succeeds; UI routes prerender as static (`○`), and the only
      dynamic route is `ƒ /api/recovery` (+ `/api/account`, same file).
- [ ] No new `any`, `@ts-ignore`, or `dangerouslySetInnerHTML` on user data.
- [ ] No new `console.log` of user data; error logging stays content-free.

## Security

- [ ] `npm audit` run; every finding triaged. Known build-time/transitive findings
      are documented in `docs/security.md` (do not run `npm audit fix --force`).
- [ ] `next.config.ts` security headers intact: HSTS, CSP, `X-Content-Type-Options`,
      `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`.
- [ ] CSP `connect-src` allows only `'self'` plus the configured Supabase origin
      (no other exfiltration channel) and `frame-ancestors 'none'`.
- [ ] Backup import hardening in place (size/record/string/numeric caps) —
      `lib/validation.ts` limits unchanged.
- [ ] No outbound `fetch` to origins other than `'self'` and the Supabase origin.
- [ ] No secrets/keys committed; `.env*` stays gitignored (no `.env` file exists).
- [ ] Smoke test production `next start`: `GET /` → 200 with HSTS + CSP + XFO headers.

## Sync (when enabled)

- [ ] Supabase project configured; `supabase/migrations/0001_accounts_sync.sql` applied
      (`supabase db push` or SQL editor).
- [ ] Env vars present in the deploy environment: `NEXT_PUBLIC_SUPABASE_URL`,
      `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.
      The service-role key exists **only** server-side.
- [ ] RLS verified live: signed-out requests to `vaults`/`profiles` return empty;
      a signed-in user can only read/write their own rows.
- [ ] Email confirmation disabled in Supabase Auth settings (masked emails must never
      be mailed); "Confirm email" off.
- [ ] Manual round-trip: sign up (recovery key shown), add a log, sign in on a second
      device, confirm the log appears; change password; recover via recovery key;
      delete account.
- [ ] `/api/recovery` and `/api/account` respond 401/429/503 appropriately without
      revealing whether a username exists.
- [ ] Envelope + merge logic covered by `tests/vault.test.ts` (17 tests).

## Privacy

- [ ] No analytics/tracking/ads code added.
- [ ] At-rest encryption path (PIN → PBKDF2 → AES-GCM) verified by tests
      (`tests/crypto.test.ts`) and manual set/unlock/change/remove PIN round-trip.
- [ ] Audit trail events remain content-free and bounded.
- [ ] "Delete everything" wipes IndexedDB + vault + audit trail (+ cloud copy + signs
      out when Sync is active).
- [ ] Any new exported setting is also whitelisted in `sanitizeSettings`
      (backups never export internal state).

## Release

- [ ] `package.json` version bumped; app version in `lib/export.ts` (`APP_VERSION`)
      matches where it is shown in Settings → About.
- [ ] Offline shell works: `sw.js` caches shell + navigation preload enabled.
- [ ] PWA manifest `id`/`scope` present; icons exist.
- [ ] Deploy target honors security headers (mirror them at the edge if using
      `output: "export"` — headers() do not apply on static hosting).
- [ ] Changelog/release notes updated (including any security fixes).
