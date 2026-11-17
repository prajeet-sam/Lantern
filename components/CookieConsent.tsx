"use client";

import { useSyncExternalStore } from "react";

const CONSENT_KEY = "moonlit-garden:cookie-consent";

export function CookieConsent() {
  const visible = useSyncExternalStore(
    (onChange) => {
      window.addEventListener("storage", onChange);
      window.addEventListener("cookie-consent", onChange);
      return () => {
        window.removeEventListener("storage", onChange);
        window.removeEventListener("cookie-consent", onChange);
      };
    },
    () => localStorage.getItem(CONSENT_KEY) === null,
    () => false,
  );

  function choose(value: "accepted" | "declined") {
    localStorage.setItem(CONSENT_KEY, value);
    window.dispatchEvent(new CustomEvent("cookie-consent", { detail: value }));
  }

  if (!visible) return null;

  return (
    <aside
      role="dialog"
      aria-label="Cookie preferences"
      className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-xl rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-2xl"
    >
      <p className="text-sm leading-6 text-foreground">
        Moonlit Garden uses essential local storage to keep your app working. Optional, privacy-friendly analytics
        help us understand visits and are off unless you choose “Allow analytics”.
        {" "}
        <a className="underline underline-offset-2" href="/privacy">Read our privacy policy</a>.
      </p>
      <div className="mt-3 flex flex-wrap justify-end gap-2">
        <button
          type="button"
          onClick={() => choose("declined")}
          className="rounded-xl px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-[var(--secondary)]"
        >
          Decline
        </button>
        <button
          type="button"
          onClick={() => choose("accepted")}
          className="rounded-xl bg-[var(--primary)] px-3 py-2 text-sm font-semibold text-[var(--primary-foreground)]"
        >
          Allow analytics
        </button>
      </div>
    </aside>
  );
}
