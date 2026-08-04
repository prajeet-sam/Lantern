# Lantern — Security & Scalability Audit

**Date:** 2026-08-03
**Auditor:** Principal Security / Privacy / Reliability review
**Repository:** `period/` (Next.js 16.2.12 · React 19.2.4 · TypeScript strict · Tailwind 4 · Vitest)
**App:** Lantern — private, local-first menstrual-cycle & wellness PWA.

> This audit is an honest assessment of the **actual architecture**. Lantern is a
> **purely local-first, client-side PWA**: there is no backend server, no API routes,
> no server actions, no middleware, no user accounts, no sessions, no cookies, and no
> third-party runtime network calls. Every item on the standard server-side checklist
> (authN/authZ, IDOR, CSRF, CORS, SQL/NoSQL injection, connection pooling, queues,
> background workers, server rate limiting) is therefore marked **N/A** with rationale
> rather than given a false PASS. We do not invent server-side risks that do not exist.

---

## 1. Architecture overview

```
┌─────────────────────────────── Browser / device ───────────────────────────────┐
│  Lantern PWA (Next.js App Router, client components)                            │
│  ├─ StoreProvider (lib/store.tsx)  →  React context store                      │
│  ├─ PinGate (encryption gate)       →  unlock → decrypt → in-memory dataset     │
│  ├─ QuickHide (stealth overlay)     →  blur + cover on hide                     │
│  ├─ RemindersGate                   →  best-effort local notifications          │
│  └─ Views: home / track / calendar / insights / journal / settings              │
│                                                                                 │
│  Storage:                                                                       │
│  ├─ IndexedDB  "lantern"  (lib/repository.ts via `idb`)                         │
│  │    daily-logs  (key: date)   journals (key: id)   settings (key: "user")     │
│  │    └─ log/journal *content* AES-256-GCM encrypted when PIN is set            │
│  └─ localStorage: lantern:theme · lantern:reminders · lantern:vault ·           │
│       lantern:pin-attempts                                                     │
│  Keys: PBKDF2 (SHA-256, 200k) → AES-256-GCM; key held in module memory only     │
└─────────────────────────────────────────────────────────────────────────────────┘
        ▲
   serving layer (next start / CDN) — static prerendered HTML + headers
```

- **Framework/runtime:** Next.js 16.2.12 (App Router, Turbopack), React 19, TypeScript strict.
- **Frontend/backend boundary:** none — everything runs in the browser. The "server" is a static-serving layer.
- **Authentication:** none (no accounts). A local 4-digit PIN unlocks encryption.
- **Database:** none server-side. On-device IndexedDB is the entire dataset.
- **Third-party services:** none at runtime. Google Fonts are fetched **at build time** and self-hosted (`font-src 'self'`). Service worker fetches are same-origin only.
- **Environment variables:** none. `.env*` is gitignored. Only `NODE_ENV` is read.
- **Sensitive-data flows:** all on-device; content encrypted at rest when PIN enabled; exports are user-initiated downloads.

---

## 2. Threat model

### Assets
| Asset | Location | Protected by |
|---|---|---|
| Cycle/symptom/mood/journal data | IndexedDB `daily-logs`, `journals` | AES-256-GCM (PBKDF2-200k from PIN) when PIN set |
| Settings/preferences | IndexedDB `settings` (plaintext) | Device access control |
| Vault metadata (salt + verifier) | localStorage `lantern:vault` | No plaintext data; only re-derives key |
| PIN (verifier) | nowhere — key derived per unlock | PBKDF2 verifier; key never stored |
| Backups / exports | user-controlled files | Optional password encryption (`lantern:encrypted:v1`) |
| Encryption key | module memory only | Dropped on lock / page unload |

### Threat actors
1. **Casual shoulder-surfers / app-switcher glance** — mitigated by QuickHide + PIN gate.
2. **Device theft** — mitigated by at-rest encryption **when the PIN is set**.
3. **Malicious browser extension** — can read DOM/localStorage/IndexedDB at rest; at-rest encryption mitigates content exposure; extension can still capture what is on screen.
4. **Malicious or malformed backup/import file** — **the primary active attack surface** (parsed as JSON, no server validation). See H1.
5. **Automated/scraping bots** — N/A (no remote API or accounts to scrape).
6. **Credential stuffing / enumeration** — N/A (no accounts).

### Trust boundaries
```
Trusted: React state in memory while unlocked (post-decryption)
  ▼ decrypt on unlock
Device storage: IndexedDB + localStorage (encrypted content, plaintext keys/settings)
  ▼ file I/O
Imports/exports: untrusted bytes from outside the app   ← main validation boundary
  ▼ rendering
DOM: user data rendered via React (auto-escaped)
```
Every file crossing the **import boundary** is untrusted and must be schema-validated.

---

## 3. Vulnerability findings (ranked)

### CRITICAL
**None.** No authentication, no server, no remote data, no cross-user data path exists.
The categories where CRITICAL findings typically live (authorization bypass, IDOR,
SQLi, SSRF, credential theft) are structurally absent. See the scorecard in §7.

### HIGH

- **H1 — Unbounded, malformed backup import ⇒ tab freeze / memory exhaustion (DoS).**
  `parseExport` (`lib/validation.ts`) parses arbitrary JSON with **no file-size limit,
  no record cap, no string-length caps, and no numeric range clamps**. `settings.tsx`
  calls `file.text()` before any size check, materialising the whole file in memory.
  A crafted or accidental multi-MB/GB file (or one with tens of thousands of records,
  a 10 MB journal `text`, `energy: 1e9`) can freeze or crash the tab.
  *Attack scenario:* attacker (or a corrupted drive) supplies a malicious backup;
  opening it stalls the app until the OS kills the tab. No data is exfiltrated, but
  availability is lost and the user is locked out of the UI.
  *Files:* `lib/validation.ts`, `components/settings.tsx`.
  *Fix:* size guard **before** `file.text()`, record/string/number caps in the
  sanitizers, and defensive caps in `parseExport`. → implemented (see fix log).

- **H2 — No error boundary: any runtime error blanks the app.**
  There is no `error.tsx`. An uncaught rendering error in any view unmounts the whole
  tree with no recovery path or message. For a health app this is both a reliability
  and a trust failure.
  *Fix:* add `app/error.tsx` (and a `global-error.tsx`) that shows a safe, generic
  message with a retry action — never rendering user data or stack traces. → implemented.

### MEDIUM

- **M1 — `sanitizeSettings` accepts internal-only fields that legitimate exports never carry.**
  `privacyLockPin`, `autoLockMinutes`, `blurOnHide`, `onboardingComplete` are importable
  even though `scrubSettings` never exports them. This can desynchronise UI state from
  the real vault (e.g. `privacyLockPin` present with no vault breaks the "change PIN"
  flow). *Fix:* whitelist only the fields `buildBackup` exports. → implemented.

- **M2 — Weak, vestigial PIN marker (`privacyLockPin` = djb2 hash).**
  The unlock path uses the crypto verifier (correct); the djb2 hash is never verified
  and only signals "a PIN is set". Storing a PIN-derived hash is misleading and implies
  security it doesn't provide. *Fix:* replace with an explicit `pinEnabled` boolean and
  migrate existing data. → implemented.

- **M3 — `uid()` falls back to `Math.random()` (non-CSPRNG).** IDs are not security
  tokens, but a CSPRNG fallback is free. → implemented (`crypto.getRandomValues`).

- **M4 — No observability / audit trail.** No record of unlock attempts, PIN changes,
  exports, or wipes; nothing to diagnose a problem or spot tampering. Telemetry is
  unacceptable for this app, so we add a **local, bounded, content-free audit log** +
  a diagnostics view (still fully on-device). → implemented.

- **M5 — Missing HSTS header.** Present headers are good (`X-Content-Type-Options`,
  `X-Frame-Options: DENY`, `frame-ancestors 'none'`, `Referrer-Policy`,
  `Permissions-Policy`, strict CSP). Add `Strict-Transport-Security`. → implemented.

- **M6 — PWA manifest lacks `scope` / `id`.** Add them for correct install/update
  behaviour. → implemented.

- **M7 — Service worker has no navigation preload.** Small offline-perf improvement;
  also standardises the fetch fallback. → implemented.

### LOW

- **L1 — Unused create-next-app SVGs in `public/`** (`next.svg`, `vercel.svg`,
  `file.svg`, `globe.svg`, `window.svg`). Remove. → implemented.
- **L2 — Dependency audit.** Run `npm audit`; review versions. → run as part of verify.
- **L3 — Brute-force lockout is client-side** (localStorage) and resettable by clearing
  storage. Accepted: it is a deterrent, not a security boundary; the at-rest crypto is
  the real control. Documented.
- **L4 — CSP `script-src 'unsafe-inline'` is structurally required** (Next.js emits
  inline RSC flight scripts). Residual risk is low because there are no DOM sinks
  (`innerHTML`/`eval`/user `dangerouslySetInnerHTML` are absent) and the rest of the
  CSP is strict. Documented as a standing tradeoff; a nonce-based policy would require
  dynamic rendering and break the static-PWA scalability model.

---

## 4. Scalability assessment

- **Current:** `next build` emits static prerendered HTML + hashed JS/CSS chunks; the
  runtime is a stateless Node server (`next start`) or any static host. **No server
  state, no shared memory, no DB, no per-request locks.** Horizontal scaling is
  trivially safe: spin up N instances behind a load balancer; nothing to coordinate.
- **10 → 1,000,000 users:** serving scales with static-asset delivery. The ceiling is
  CDN edge caching + cacheable assets. The app holds **no user data server-side**, so
  the classic scaling bottlenecks (connection pools, query throughput, queues) do not
  arise. Per-user data lives on each device.
- **Justified work (no over-engineering):**
  1. Document the static-export / CDN path (headers must be mirrored at the edge when
     `output: "export"` is used, since `next.config` `headers()` only apply under
     `next start`).
  2. Bound the import surface so device-side datasets cannot be inflated to
     pathological sizes (boundedness is the local-first equivalent of pagination).
  3. Keep bundle efficient; there is no obvious heavy bundle today.
- **N/A with rationale:** database pooling/indexes/N+1 (no DB), queues/workers (no
  jobs), Redis/cache (nothing to cache server-side), distributed rate limiting (no
  shared API), autoscaling config (platform-level, not code).

---

## 5. Privacy assessment

- **On-device only.** No analytics, no ads, no tracking SDKs, no third-party scripts.
  `connect-src 'self'` in the CSP makes accidental exfiltration structurally impossible.
- **At-rest encryption** of log/journal content when the PIN is set (AES-256-GCM,
  PBKDF2-200k). Keys never persist. Settings and the `date`/`id` IndexedDB keyPaths
  remain plaintext because they are queryable keys — documented.
- **Exports:** JSON/CSV/summary are plaintext files; **encrypted backups** exist for
  safe cloud storage. Delete-everything wipes IndexedDB + vault + localStorage flags.
- **Notifications:** "detailed" mode shows cycle wording on the OS notification — a
  deliberate, user-controlled choice. Documented.
- **Observability is local-only** (audit log stays on device; nothing is transmitted).

---

## 6. Recommended priorities (execution order)

1. **H1** Import hardening (size guard + schema caps + numeric clamps). *— security/availability.*
2. **M1** Restrict `sanitizeSettings` to exported fields. *— state integrity.*
3. **M2** Replace djb2 PIN marker with `pinEnabled` + migration. *— crypto honesty.*
4. **M3** CSPRNG `uid`. **M5** HSTS. **M6** manifest scope/id. **M7** SW nav preload. *— hardening.*
5. **H2** Error boundary. **M4** Local audit log + diagnostics. *— reliability/observability.*
6. **L1** Clean unused public assets.
7. Regression tests for every fix; run full verify (`tsc`, `eslint`, `vitest`, `build`, `npm audit`).
8. Write `docs/` set (security, privacy, scalability, incident-response, production-checklist).

---

## 7. Security scorecard

| Area | Status | Note |
|---|---|---|
| Authentication | **PASS (N/A)** | No accounts; PIN protects at-rest encryption via verifier |
| Authorization | **PASS (N/A)** | No server resources; no cross-user path exists |
| IDOR | **PASS (N/A)** | No shared resources or IDs |
| XSS | **PASS** | React auto-escaping; no DOM sinks; import text validated & capped |
| CSRF | **PASS (N/A)** | No cookies/sessions/state-changing requests to a server |
| CORS | **PASS (N/A)** | No cross-origin API |
| Rate limiting / brute force | **WARN** | Client-side PIN lockout (deterrent); accepted & documented |
| Secrets | **PASS** | No secrets in repo; `.env*` ignored; no API keys |
| Database security | **PASS (N/A)** | No server database; IndexedDB content encrypted |
| Logging | **PASS (post-fix)** | Local, bounded, content-free audit log added |
| Privacy | **PASS** | Local-first; encryption; no telemetry; CSP locks exfiltration |
| Dependencies | **WARN** | `npm audit` to be run in final verify |
| Scalability | **PASS** | Stateless static app; CDN path documented |
| Observability | **PASS (post-fix)** | Local audit + error boundary |
| Backups / DR | **WARN** | Encrypted backup export exists; host-level backups/RPO are platform concerns (documented) |

---

## 8. Fix log (applied)

| ID | Fix | Files |
|---|---|---|
| H1 | Size guard before `file.text()` (8 MB), per-record caps (60k logs / 30k journals), string caps (200k text / 64 id), tag-array caps (200), numeric clamps (energy/stress 1–5, cycle 21–45, duration 2–10, weekday 0–6), dedupe by date/id. | `lib/validation.ts`, `components/settings.tsx` |
| H2 | Route-level `error.tsx` + `global-error.tsx` boundaries (safe generic UI, `unstable_retry`, no user data / stack traces). | `app/error.tsx`, `app/global-error.tsx` |
| M1 | `sanitizeSettings` now whitelists only the five exported fields; internal state (PIN, auto-lock, blur, onboarding) can no longer be imported. | `lib/validation.ts` |
| M2 | Removed misleading djb2 `privacyLockPin` marker + `hashPin`/`pinMatches`; PIN presence is now derived from the vault (single source of truth); legacy marker stripped on load. | `lib/pin.ts`, `lib/store.tsx`, `types/index.ts`, `components/settings.tsx`, `components/quickhide.tsx` |
| M3 | `uid()` prefers `crypto.randomUUID`, falls back to `getRandomValues` (CSPRNG v4 UUID), timestamp only as last resort. | `lib/uid.ts` |
| M4 | Bounded (200), content-free, on-device audit trail + Diagnostics card in Settings (events: unlock/lock/PIN changes/import/export/wipe). | `lib/audit.ts`, `components/settings.tsx`, `lib/store.tsx` |
| M5 | `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` header. | `next.config.ts` |
| M6 | PWA manifest `id` + `scope`. | `app/manifest.ts` |
| M7 | Service worker navigation preload + stale-while-network shell for navigations. | `public/sw.js` |
| L1 | Removed unused create-next-app SVGs. | `public/*.svg` |
| L2 | **Accepted** — `next` (16.2.12, latest stable) bundles build-time `postcss` ≤8.5.17 and `sharp` <0.35.0 (npm audit: 3 high). `sharp` is only used by `next/image`, which this app never imports; postcss runs only at build. `npm audit fix --force` would incorrectly downgrade to `next@9.3.3`. Revisit when Next ships a stable release bundling patched versions. | — |

**Verification after fixes:** `tsc --noEmit` clean · `eslint .` clean · **59/59 Vitest tests (9 files)** · `next build` succeeds · production `next start` smoke test returns 200 with HSTS/CSP/X-Frame-Options headers · `npm audit` documented above.

---

## Addendum - Accounts + encrypted sync (Post-audit feature)

New opt-in trust boundary added after the audit. Supabase stores only salts + ciphertext:

- Envelope encryption: random 256-bit data key encrypts the snapshot; the data key is wrapped under the password-KEK and recovery-KEK (both PBKDF2-SHA-256, 200,000 iterations). See lib/sync/vault.ts.
- Supabase Auth via masked emails `username@lantern.local`; username copied to `profiles` by trigger; RLS restricts every row to `auth.uid()`.
- `rev`-guarded optimistic upsert; on conflict the client re-pulls, re-merges (LWW by `updatedAt`) and retries (bounded). No silent data loss.
- Recovery key: shown once; only its SHA-256 hash is stored. `/api/recovery` verifies the hash and resets the password with the service-role client. `/api/account` validates the caller's own JWT before deleting the user.
- CSP `connect-src` extended to allow only the configured Supabase origin.
- Tests: `tests/vault.test.ts` (17 tests). Full suite now 76 tests / 10 files.
- Docs: `docs/setup.md` (deployment), plus security/privacy/scalability/checklist updates.

**New accepted risks:** (5) Supabase anon key is public by design; RLS is the boundary. (6) weak sync passwords are offline-crackable against the blob; UI enforces >=12 chars. (7) service-role key compromise is catastrophic; server-only env var, rotate on leak. (8) sync weakens to "encrypted at rest, untrusted server" - the DEK/plaintext stay AES-GCM protected; Sync remains strictly opt-in.
