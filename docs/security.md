# Security

Lantern is a **local-first PWA** with an optional, opt-in encrypted sync account.
By default there is no backend: no servers, no accounts, no API calls, and all data
lives on the user's device. When the user enables Sync, an encrypted copy of their
dataset is stored in Supabase Postgres — but the plaintext never leaves the device.
This document describes the security model and the controls that protect it.

## Model and trust boundaries

### Local-only (default)

```
Trusted: React state in memory while unlocked (post-decryption)
  ▼ decrypt on unlock (AES-256-GCM, key held in module memory only)
Device storage: IndexedDB + localStorage (log/journal *content* encrypted; keys plaintext)
  ▼ file I/O
Imports / exports: untrusted bytes from outside the app  ← main validation boundary
  ▼ rendering
DOM: user data rendered via React (auto-escaped)
```

The one place untrusted input enters the app is **backup import**. Every other local
data path is produced by the app itself.

### Sync (opt-in account)

```
Device A ── password ──▶ PBKDF2(200k) ──▶ password-KEK
                                              │ wraps
                                   random 256-bit data key (DEK)  ──▶ encrypts ──▶ snapshot (logs+journals+settings)
                                              │ wraps
            recovery key ──▶ PBKDF2(200k) ─▶ recovery-KEK
                                                      │
                Supabase stores only:  salt + iterations + wrapped DEK + ciphertext blob + rev
                                                      ▲
              the server never sees the password, the recovery key, the DEK, or plaintext
```

Trust boundaries:

| Boundary | Trusted? | Notes |
|---|---|---|
| Data key (DEK) in memory | trusted | Held only in the page while unlocked; dropped on reload/lock/sign-out. |
| Password / recovery key | never stored | Derived to keys in memory; the recovery key is stored server-side only as a SHA-256 hash for verification. |
| Supabase (PostgREST) | untrusted-but-constrained | RLS restricts every query to `auth.uid()`; rows contain only salts + ciphertext. |
| `app/api/recovery` + `app/api/account` | trusted | Server-side, service-role key; only reachable via HTTPS with the same origin. |

## Controls

| Area | Control |
|---|---|
| At-rest data | Log/journal content AES-256-GCM encrypted when a PIN is set. Key derived via PBKDF2-SHA-256 (200,000 iterations) from the 4-digit PIN; never stored. |
| Vault | localStorage holds only salt + verifier (no plaintext data). Key lives in module memory and is dropped on lock/unload. |
| PIN brute force | Client-side escalating lockout (5 failures → cooldown that grows with further attempts). This is a deterrent, not a security boundary. |
| XSS | React auto-escapes all user content. No `dangerouslySetInnerHTML` on user data; no `eval`; `innerHTML` not used. |
| Import hardening | Size guard (8 MB) before `file.text()`, record caps, string caps, tag-array caps, numeric clamps, dedupe, strict field whitelists. See `lib/validation.ts`. |
| Sync at-rest | Envelope encryption (`lib/sync/vault.ts`): random DEK encrypts the dataset; the DEK is wrapped under the password-KEK and the recovery-KEK (both PBKDF2-SHA-256, 200,000 iterations). Server stores salts + wrapped DEK + ciphertext + `rev` only. |
| Sync auth | Supabase Auth with masked emails (`<username>@lantern.local`); usernames enforced unique in `profiles` (trigger + unique index). Passwords hashed by Supabase (bcrypt). |
| Sync authorization | Row-level security: every vault/profile row is locked to `auth.uid()`. Recovery-code RPCs are security-definer functions that pin to `auth.uid()`. |
| Sync concurrency | `rev`-guarded optimistic upsert: a conflicting write returns a conflict and the client re-pulls, re-merges (LWW by `updatedAt`), and retries (bounded). No data is silently overwritten. |
| Recovery | Recovery key (32 random bytes, base64url) shown once at sign-up; only its SHA-256 hash is stored. `/api/recovery` verifies the hash then resets the password via the service-role client. Server-side per-instance rate limiting. |
| Account deletion | `/api/account` validates the caller's own JWT before the service-role client deletes the user (vault/profile/recovery cascade via FK). |
| Transport | CSP with `default-src 'self'`, `connect-src 'self' <supabase-origin>` (only the configured Supabase project origin is allowed), `frame-ancestors 'none'`, `object-src 'none'`, `upgrade-insecure-requests`; `Strict-Transport-Security`, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`. See `next.config.ts`. |
| Backups | Plain JSON/CSV for the user; **encrypted backups** (`lantern:encrypted:v1`, same PBKDF2→AES-GCM pipeline) for safe cloud storage. Password is never stored. |
| Observability | Local, bounded (200-entry), content-free audit trail (unlock, PIN changes, imports, wipes, sync events). Never leaves the device. |
| Errors | Route + global error boundaries render a safe, generic screen (no data, no stack traces) with retry. |
| IDs | CSPRNG (`crypto.randomUUID` / `getRandomValues`). |

## Known accepted risks

1. **Brute-force lockout is client-side** and resets if localStorage is cleared.
   It deters casual misuse; the real control is the at-rest encryption.
2. **`script-src 'unsafe-inline'`** is structurally required because Next.js emits
   inline RSC flight scripts and the app uses an inline theme script. The risk is low
   because there are no DOM injection sinks. A nonce-based policy would require dynamic
   rendering and would break the static-PWA model.
3. **Vendored build-time deps** (`postcss`, `sharp`) are flagged by `npm audit`, both
   scoped to build/runtime-feature paths this app never exercises (`next/image` is not
   imported). No patched stable `next` exists yet; revisit on Next release. Never run
   `npm audit fix --force` (it would downgrade to `next@9.3.3`).
4. **Settings and IndexedDB keyPaths** (`date`, `id`) are plaintext by design — they are
   queryable keys. Cycle *content* is encrypted when a PIN is set.
5. **Supabase anon key is public by design.** Security rests on RLS, not key secrecy.
   Any RLS misconfiguration is a data-exposure bug — treat `vaults`/`profiles` policies
   as a first-class security boundary (tests + a policy review are part of releases).
6. **The password is the only guard on the encrypted dataset.** A weak password can be
   dictionary-attacked offline against the vault blob. The UI enforces ≥12 characters.
   A lost password cannot be reset without the recovery key (there is no password
   reset email — masked addresses are never mailed).
7. **Service-role key compromise is catastrophic** (full account takeover). It lives
   only in server env vars, never in the client bundle, and is scoped to the two API
   routes' behavior. Rotate it immediately if it ever leaks.
8. **Sync trust boundary is weaker than local-only.** When Sync is enabled, a malicious
   Supabase operator could still withhold or tamper with the *ciphertext* (the DEK and
   plaintext remain protected by AES-GCM, which is tamper-evident). This is the standard
   "encrypted at rest, untrusted server" trade-off; it is why Sync is strictly opt-in.

## Security checklist (for releases)

- Run `npm audit`; confirm any findings are transitive/build-time and documented.
- Run `tsc --noEmit`, `eslint .`, `vitest run`, `npm run build`.
- Smoke-test `next start`: response 200, HSTS + CSP + XFO headers present.
- Confirm no new `dangerouslySetInnerHTML`, `eval`, or outbound `fetch` to origins other
  than the app origin and the configured Supabase origin.
- Review RLS policies on `profiles`, `vaults`, `recovery_codes` for drift from the
  migration file; confirm no new grants leak cross-user reads/writes.
- Confirm the recovery/account routes reject oversized bodies and honor rate limits.
