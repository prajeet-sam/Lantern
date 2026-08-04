"use client";

import { useEffect } from "react";
import { StoreProvider, useStore } from "@/lib/store";
import { useTheme } from "@/lib/theme";

function AppSettingsBridge() {
  const { settings } = useStore();
  useTheme();

  useEffect(() => {
    const root = document.documentElement;
    if (settings.reducedMotion) root.setAttribute("data-reduced-motion", "true");
    else root.removeAttribute("data-reduced-motion");

    if (settings.highContrast) root.setAttribute("data-high-contrast", "true");
    else root.removeAttribute("data-high-contrast");
  }, [settings.reducedMotion, settings.highContrast]);

  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  return null;
}

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <StoreProvider>
      <AppSettingsBridge />
      {children}
    </StoreProvider>
  );
}