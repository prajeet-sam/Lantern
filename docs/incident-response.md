# Incident Response

Because Lantern has no backend and stores no user data server-side, the incident
classes below are the ones that actually apply. Anything server-side (data breach,
credential stuffing, DDoS on an API) is **N/A** and not listed.

## Roles and ownership

- The project maintainer(s) own all incident response. There is no on-call rotation to
  page; severity tiers below reflect response speed expectations.

## Severity tiers

| Severity | Example | Response target |
|---|---|---|
| **Critical** | A stored-XSS or data-loss bug shipped to users (e.g. import wipes/overwrites data, journal text rendered unsafely). | Fix + release within 24h, user-facing notice. |
| **High** | Encryption weakness (wrong key derivation, key persisted), PIN bypass, CSP disabling. | Fix within a week, release + notice. |
| **Medium** | UI crash loops, import accept/deny regressions, degraded offline. | Fix in the next planned release. |
| **Low** | Cosmetic issues, dead code, stale deps without runtime exposure. | Track in backlog. |

## Playbooks

### 1. Suspected data loss or corruption (Critical)

1. **Stop recommending** affected versions (or disable imports) until root cause is known.
2. Reproduce locally against a copy of a user's backup (never a live device).
3. Identify the failing write path in `lib/repository.ts` / `lib/store.tsx`.
4. Ship a fix with a regression test, then verify with the full suite (`vitest run`,
   `tsc --noEmit`, `eslint .`, `npm run build`).
5. Tell affected users: data is stored locally, so a corrupted import can be re-imported
   from the encrypted backup; do **not** tell them to clear browser data first.

### 2. Suspected security issue (High)

1. Check the audit trail (Settings → Diagnostics) for unusual events (repeated failed
   unlocks, unexpected imports/wipes) — all on-device, no logs shared with anyone.
2. Reproduce; confirm whether it requires a crafted import (the only untrusted input).
   If so, harden `lib/validation.ts` first (size/record/string/numeric caps) — see
   the H1 fix log.
3. Confirm transport controls still apply by smoke-testing headers on the deployed URL
   (HSTS, CSP, `frame-ancestors 'none'`).
4. Release the fix, update `SECURITY_SCALABILITY_AUDIT.md`, and add regression tests.

### 3. Dependency advisory (Medium/Low)

1. Run `npm audit` and `npm outdated`.
2. If the advisory is transitive and only reachable at build time (see the known
   postcss/sharp note in `docs/security.md`), document and defer to the next stable
   `next` release. Never blindly run `npm audit fix --force` (it can downgrade majors).
3. If it is a directly-used dependency with a patched release, upgrade and re-verify.

## Communication

- No user-email list exists (no accounts). If a notice is required, publish it in the
  app's changelog / release notes and on the project page.
- Privacy: never share user data in an incident write-up; local-first means the app
  never collected it in the first place.

## Post-incident

- Update `SECURITY_SCALABILITY_AUDIT.md` with the finding, fix, and verification.
- Add/adjust regression tests that cover the exact failure path.
- Review whether the failure implies new docs or checklist items in
  `docs/production-checklist.md`.
