// PIN helpers for the local privacy lock. The PIN is never stored: it is
// derived into an encryption key (PBKDF2 → AES-256-GCM) by lib/crypto, and the
// vault's presence in localStorage is the single source of truth for "is a PIN
// set" (M2 — the old djb2 "hash" was misleading and has been removed).

export const PIN_LENGTH = 4;

export function isValidPin(pin: string): boolean {
  return /^\d{4}$/.test(pin);
}

/** Custom event used to re-lock the app from Settings without a shared context. */
export const LOCK_EVENT = "lantern:lock";

/* ------------------------------------------------------------------ */
/* Brute-force lockout. Tracks consecutive failures in localStorage    */
/* with an escalating cooldown so a stray device can't be hammered.    */
/* ------------------------------------------------------------------ */

const ATTEMPTS_KEY = "lantern:pin-attempts";
export const MAX_FAILURES = 5;
const COOLDOWN_BASE_MS = 30_000;
const COOLDOWN_STEP_MS = 60_000;

export interface PinLockout {
  count: number;
  lockedUntil: number;
}

function readLockout(): PinLockout {
  try {
    const raw = localStorage.getItem(ATTEMPTS_KEY);
    if (raw) return JSON.parse(raw) as PinLockout;
  } catch {
    /* ignore */
  }
  return { count: 0, lockedUntil: 0 };
}

function writeLockout(l: PinLockout): void {
  try {
    localStorage.setItem(ATTEMPTS_KEY, JSON.stringify(l));
  } catch {
    /* ignore */
  }
}

/** Milliseconds remaining in the cooldown, or 0 if attempts are allowed. */
export function pinCooldownMs(): number {
  const l = readLockout();
  if (l.count < MAX_FAILURES) return 0;
  return Math.max(0, l.lockedUntil - Date.now());
}

/** Whether the PIN pad should be disabled right now. */
export function isPinLockedOut(): boolean {
  return pinCooldownMs() > 0;
}

/**
 * Record a failed attempt. After MAX_FAILURES consecutive failures a cooldown
 * kicks in that grows with every further failure (resets on success).
 */
export function recordFailedPin(): void {
  const l = readLockout();
  const next = { ...l, count: l.count + 1 };
  if (next.count >= MAX_FAILURES) {
    const extra = Math.min(10, next.count - MAX_FAILURES);
    next.lockedUntil = Date.now() + COOLDOWN_BASE_MS + extra * COOLDOWN_STEP_MS;
  }
  writeLockout(next);
}

/** Clear the failure counter (called on a successful unlock). */
export function clearPinFailures(): void {
  writeLockout({ count: 0, lockedUntil: 0 });
}

/** Show a human-friendly "try again in Xs" from a cooldown. */
export function formatCooldown(ms: number): string {
  if (ms <= 0) return "";
  const s = Math.ceil(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return rem ? `${m}m ${rem}s` : `${m}m`;
}
