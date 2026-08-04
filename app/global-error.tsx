"use client";

import { useEffect } from "react";

/**
 * Global error boundary (H2). Only used when the root layout itself fails to
 * render, so it must provide its own <html>/<body> and cannot rely on the
 * theme script or global CSS — hence inline styles only.
 */
export default function GlobalError({
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
    <html lang="en">
      <body style={{ margin: 0, minHeight: "100dvh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, padding: 24, textAlign: "center", backgroundColor: "#fdf9f4", color: "#3a2f45", fontFamily: "system-ui, sans-serif" }}>
        <h1 style={{ fontSize: 24, fontWeight: 600, margin: 0 }}>Something went wrong</h1>
        <p style={{ maxWidth: 320, fontSize: 14, lineHeight: 1.5, color: "#7a7088", margin: 0 }}>
          Lantern hit an unexpected problem. Your data is safe on this device.
        </p>
        <button
          onClick={unstable_retry}
          style={{ borderRadius: 16, border: "none", backgroundColor: "#8a6bbf", color: "#fff", padding: "10px 20px", fontSize: 14, fontWeight: 500, cursor: "pointer" }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
