# FINAL SECURITY REPORT — Lantern

**Date:** 2026-08-03
**App:** Lantern — local-first cycle & wellness PWA (Next.js 16.2.12 · React 19 · TypeScript strict)
**Full analysis:** `SECURITY_SCALABILITY_AUDIT.md`

## Bottom line

Lantern is a **purely local-first, client-side PWA**: no backend, no accounts, no
cookies, no third-party runtime calls. Its single largest active attack surface — JSON
backup import — was hardened this pass, and the remaining findings are either
mitigated, accepted-with-rationale, or structural tradeoffs. **No Critical findings
exist** because the server-side vulnerability classes they live in are structurally
absent. With the changes below, the security posture is solid for the app's threat model.

## What changed this pass

### Findings fixed (10)

| ID | Severity | Finding | Resolution |
|---|---|---|---|
| H1 | High | Unbounded backup import → tab freeze / DoS, database bloat | 8 MB size guard before reading, record/string/tag-array caps, numeric clamps, dedupe |
| H2 | High | No error boundary → blank app on any render error | `app/error.tsx` + `app/global-error.tsx` (safe generic UI, retry, no data/stack output) |
| M1 | Medium | Import could flip internal settings (PIN/auto-lock/blur/onboarding) | `sanitizeSettings` now whitelists only the 5 exported fields |
| M2 | Medium | Misleading djb2 PIN marker stored in settings | Removed `privacyLockPin` + `hashPin`/`pinMatches`; PIN presence derived from vault; legacy data stripped on load |
| M3 | Medium | `uid()` fell back to non-CSPRNG `Math.random()` | `crypto.randomUUID` → `getRandomValues` v4 UUID → timestamp last resort |
| M4 | Medium | No observability / audit trail | Bounded (200) content-free on-device audit log + Settings → Diagnostics view |
| M5 | Medium | No HSTS | `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` |
| M6 | Medium | Manifest missing `scope`/`id` | Added to `app/manifest.ts` |
| M7 | Medium | No service-worker navigation preload | Enabled + stale-while-network shell for navigations |
| L1 | Low | Unused create-next-app SVGs | Removed |

### Accepted / documented (3)

| ID | Finding | Decision |
|---|---|---|
| L2 | `npm audit` — 3 high, all transitive (`postcss`, `sharp`) inside `next` | Accepted: build-time only; `sharp` requires `next/image` (never imported); no patched stable Next exists; `audit fix --force` would wrongly downgrade to `next@9.3.3`. Revisit on Next release. |
| L3 | PIN brute-force lockout is client-side | Accepted deterrent; at-rest crypto is the real control. |
| L4 | CSP `script-src 'unsafe-inline'` required (Next RSC inline scripts + inline theme script) | Accepted tradeoff; no DOM sinks exist; nonce path would require dynamic rendering and break static PWA model. |

## Verification

| Check | Result |
|---|---|
| `tsc --noEmit` | ✅ clean |
| `eslint .` | ✅ clean |
| `vitest run` | ✅ **59/59 tests (9 files)** — added import-hardening, uid, and audit suites; updated validation & pin suites |
| `next build` | ✅ succeeds, all routes static |
| `next start` smoke test | ✅ `GET /` → 200 with HSTS + CSP + `X-Frame-Options: DENY`; manifest 200 |
| `npm audit` | ⚠️ 3 high (transitive, build-time; documented & accepted) |

## Residual risk summary

1. **Client-side lockout** can be reset by clearing storage — a deterrent, not a wall.
2. **`'unsafe-inline'` scripts** — no injection sinks exist, so the practical risk is low.
3. **Vendored build-time deps** — no runtime exposure in this app.
4. **Plaintext settings & keyPaths** — design choice; cycle *content* is encrypted when a PIN is set.
5. **No PIN set** ⇒ plaintext at rest — mitigated by recommendation + visible setting; the default is convenience.

## Recommended follow-ups

- Re-run `npm audit` and upgrade `next` when a stable release bundles patched `postcss`/`sharp`.
- Consider a nonce-based CSP if the hosting model ever moves to dynamic rendering.
- Extend the audit trail with a maintenance/diagnostics view if support requests grow.
- Re-run this audit (fresh `SECURITY_SCALABILITY_AUDIT.md`) before any major architectural change
  (e.g. adding a backend, accounts, or sync — each would add a new trust boundary and re-open
  the server-side checklist).

## Docs produced

- `docs/security.md` — model, controls, accepted risks, release checklist
- `docs/privacy.md` — data flow, encryption, deletion, observability
- `docs/scalability.md` — stateless scaling, static-export path, boundedness
- `docs/incident-response.md` — tiers + playbooks for the classes that apply
- `docs/production-checklist.md` — gated release checklist
