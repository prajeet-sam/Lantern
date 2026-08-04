"use client";

import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { PIN_LENGTH, recordFailedPin, clearPinFailures, isPinLockedOut, pinCooldownMs, formatCooldown } from "@/lib/pin";
import { LanternLogo } from "@/components/LanternLogo";
import { Delete } from "lucide-react";

/**
 * Locks the whole app behind a 4-digit PIN when a vault exists.
 * Unlocking derives the AES key from the PIN and decrypts the dataset into
 * memory. Auto-lock re-locks after `settings.autoLockMinutes` of inactivity.
 */
export function PinGate({ children }: { children: React.ReactNode }) {
  const { settings, locked, lock, unlock } = useStore();
  const [entry, setEntry] = useState("");
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(() => (isPinLockedOut() ? pinCooldownMs() : 0));

  // Auto-lock after inactivity.
  const autoLockMinutes = settings.autoLockMinutes;
  useEffect(() => {
    if (locked || !autoLockMinutes || autoLockMinutes <= 0) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const reset = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        lock();
        setEntry("");
      }, autoLockMinutes * 60_000);
    };
    const events = ["pointerdown", "keydown", "touchstart", "scroll"] as const;
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    reset();
    return () => {
      events.forEach((e) => window.removeEventListener(e, reset));
      if (timer) clearTimeout(timer);
    };
  }, [locked, autoLockMinutes, lock]);

  // Cooldown countdown for the lockout UI.
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => {
      const left = isPinLockedOut() ? pinCooldownMs() : 0;
      setCooldown(left);
      if (left <= 0) clearInterval(t);
    }, 500);
    return () => clearInterval(t);
  }, [cooldown]);

  if (!locked) return <>{children}</>;

  async function press(d: string) {
    if (busy || cooldown > 0) return;
    setError(false);
    const next = (entry + d).slice(0, PIN_LENGTH);
    setEntry(next);
    if (next.length === PIN_LENGTH) {
      setBusy(true);
      const ok = await unlock(next);
      setBusy(false);
      if (ok) {
        clearPinFailures();
        setEntry("");
      } else {
        recordFailedPin();
        if (isPinLockedOut()) setCooldown(pinCooldownMs());
        setError(true);
        setEntry("");
      }
    }
  }

  function backspace() {
    if (busy || cooldown > 0) return;
    setEntry(entry.slice(0, -1));
  }

  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-md flex-col items-center justify-center px-6">
      <LanternLogo className="mb-6 h-20 w-20" />
      <h1 className="font-display text-2xl font-semibold text-foreground">Welcome back</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {cooldown > 0 ? `Too many attempts. Try again in ${formatCooldown(cooldown)}.` : "Enter your PIN to unlock Lantern"}
      </p>

      <div className="mt-6 flex justify-center gap-3" aria-hidden>
        {Array.from({ length: PIN_LENGTH }).map((_, i) => (
          <span
            key={i}
            className={`h-3.5 w-3.5 rounded-full transition ${
              i < entry.length ? "bg-[var(--primary)]" : "bg-[var(--border)]"
            }`}
          />
        ))}
      </div>

      <div
        className={`mt-6 grid w-full max-w-[17rem] grid-cols-3 gap-2.5 ${cooldown > 0 ? "pointer-events-none opacity-50" : ""}`}
        role="group"
        aria-label="PIN pad"
        aria-disabled={cooldown > 0}
      >
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
          <PinKey key={d} label={d} onPress={() => press(d)} disabled={busy} />
        ))}
        <span />
        <PinKey label="0" onPress={() => press("0")} disabled={busy} />
        <button
          onClick={backspace}
          aria-label="Delete digit"
          className="flex items-center justify-center rounded-2xl text-muted-foreground hover:bg-[var(--secondary)]/50"
        >
          <Delete className="h-5 w-5" />
        </button>
      </div>

      <p className={`mt-4 h-4 text-sm text-[var(--danger)] ${error && cooldown === 0 ? "" : "invisible"}`}>
        That PIN didn&rsquo;t match. Try again.
      </p>
      <p className="mt-6 text-xs text-muted-foreground">
        Your data stays encrypted on this device and only unlocks while you&rsquo;re here.
      </p>
    </div>
  );
}

function PinKey({ label, onPress, disabled }: { label: string; onPress: () => void; disabled: boolean }) {
  return (
    <button
      onClick={onPress}
      disabled={disabled}
      className="flex h-16 items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--card)] text-xl font-semibold text-foreground transition active:scale-95 hover:bg-[var(--secondary)]/50 disabled:opacity-60"
    >
      {label}
    </button>
  );
}
