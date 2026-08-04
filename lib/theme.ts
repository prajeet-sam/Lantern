"use client";

import { useCallback, useEffect } from "react";
import { useStore } from "@/lib/store";
import type { ThemeMode } from "@/types";

export const THEME_KEY = "lantern:theme";

function resolveTheme(mode: ThemeMode): "light" | "dark" {
  if (mode === "system") {
    if (typeof window === "undefined") return "light";
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return mode;
}

export function useTheme() {
  const { settings, setSettings } = useStore();
  const mode = settings.theme ?? "system";

  useEffect(() => {
    const resolved = resolveTheme(mode);
    document.documentElement.setAttribute("data-theme", resolved);
    try {
      localStorage.setItem(THEME_STORE_KEY(), mode);
    } catch {
      /* ignore */
    }
  }, [mode]);

  // React to OS preference changes while in "system" mode
  useEffect(() => {
    if (mode !== "system") return;
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => document.documentElement.setAttribute("data-theme", resolveTheme("system"));
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [mode]);

  const setMode = useCallback(
    (next: ThemeMode) => setSettings({ theme: next }),
    [setSettings],
  );

  const resolved = resolveTheme(mode);
  return { mode, resolved, setMode };
}

function THEME_STORE_KEY() {
  return "lantern:theme";
}