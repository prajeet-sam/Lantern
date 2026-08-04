"use client";

import { useEffect } from "react";
import { LanternLogo } from "@/components/LanternLogo";

/**
 * Route-level error boundary (H2). Rendered when any child segment throws
 * during render, so the user sees a safe, generic recovery screen instead of
 * a blank app. Deliberately renders no user data and no stack traces.
 */
export default function ErrorPage({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 bg-[var(--bg)] px-6 text-center">
      <LanternLogo className="h-14 w-14" />
      <h1 className="font-display text-2xl font-semibold text-foreground">Something went wrong</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        Lantern hit an unexpected problem. Your data is safe on this device — try again.
      </p>
      <button
        onClick={unstable_retry}
        className="rounded-2xl bg-[var(--primary)] px-5 py-2.5 text-sm font-medium text-[var(--primary-foreground)]"
      >
        Try again
      </button>
    </div>
  );
}
