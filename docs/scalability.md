# Scalability

Lantern's serving layer is a **stateless Next.js app**. The only server-side state is
the optional, opt-in **Sync** backend (Supabase Postgres + Auth), which stores per-user
encrypted blobs. This keeps horizontal scaling of the app itself trivial.

## Current architecture

- `next build` emits **static prerendered HTML** plus hashed JS/CSS chunks.
- `next start` runs a stateless Node server (no shared memory, no app DB, no
  background jobs). `app/api/recovery` and `app/api/account` are the only dynamic
  routes; they call Supabase's service-role API.
- Per-user data lives on the device by default. With Sync enabled, an **encrypted
  snapshot** (salted + ciphertext only) lives in Supabase Postgres behind row-level
  security. Blobs are small (tens of KB) and queried once per sync via `rev`-guarded
  upsert — no table scans, no joins on user data.

## The scaling path

**10 users → 1,000,000 users:** serving scales with static-asset delivery. Spin up N
stateless instances behind a load balancer, or front the build output with a CDN.

### Option A — Node runtime (current)

`next start` per instance. Safe to scale horizontally because the app is stateless.
Headers defined in `next.config.ts` (HSTS, CSP, XFO, etc.) are applied automatically.

### Option B — Static export / CDN

**Not supported once Sync is enabled.** Sync needs `app/api/recovery` and
`app/api/account` (Node runtime, service-role access), which a static export cannot
serve. Static export remains valid only for a local-only build with Sync disabled.

> **Note:** when Sync is enabled, the two API routes share in-memory rate-limit state
> per instance (`attempts` map in `app/api/recovery/route.ts`). Under heavy load the
> limit is per-instance, which is acceptable for the abuse it stops; a shared store
> (e.g. the Supabase database or an edge cache) can be added if coordinated limits are
> ever needed.

## Boundedness (the local-first analogue of pagination)

The only unbounded-input surface is backup import (now capped) and the sync snapshot.
Sync inherits the same caps because a snapshot is validated through `parseExport`
(`lib/validation.ts`) on every decrypt — a malicious or corrupt remote blob cannot
inflate memory beyond the same limits.

| Bound | Value | Where |
|---|---|---|
| Import file size | 8 MB | `lib/validation.ts` |
| Daily logs per import | 60,000 | `lib/validation.ts` |
| Journals per import | 30,000 | `lib/validation.ts` |
| Journal text | 200,000 chars | `lib/validation.ts` |
| Tags per record | 200 | `lib/validation.ts` |
| Audit trail | 200 events | `lib/audit.ts` |
| Sync request body | 10,000 chars | `app/api/recovery/route.ts` |
| Recovery attempts | 10 / 15 min per instance | `app/api/recovery/route.ts` |

## N/A with rationale

- **Database pooling / indexes / N+1:** the app has no database of its own; Supabase
  manages its own pool. Vault rows are keyed by `user_id` (unique), so lookups are
  single-row.
- **Queues / workers / cron:** no server jobs; reminders are local and best-effort.
- **Redis / caching layers:** nothing to cache server-side.
- **Autoscaling config:** platform-level concern, not application code.

## Performance notes

- Fonts are self-hosted (`next/font`), so `font-src 'self'` stays tight and there are
  no third-party font round-trips.
- The service worker caches the app shell and enables navigation preload for faster
  cold loads.
- There is no `next/image` usage; images are static icons.
- Sync pushes are debounced (5 s) and batched, so a burst of edits is one upload, not
  one per keystroke.
