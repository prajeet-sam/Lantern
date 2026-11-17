"use client";

import { useSyncExternalStore } from "react";
import { useStore } from "@/lib/store";
import { securityService } from "@/lib/security/service";
import { LanternLogo } from "@/components/LanternLogo";

/** True while the tab is hidden or the window has lost focus. */
function subscribeVisible(cb: () => void): () => void {
  document.addEventListener("visibilitychange", cb);
  window.addEventListener("focus", cb);
  window.addEventListener("blur", cb);
  window.addEventListener("pageshow", cb);
  return () => {
    document.removeEventListener("visibilitychange", cb);
    window.removeEventListener("focus", cb);
    window.removeEventListener("blur", cb);
    window.removeEventListener("pageshow", cb);
  };
}

function snapshotVisible(): boolean {
  return document.visibilityState === "visible" && document.hasFocus();
}

function useIsCovered(enabled: boolean): boolean {
  const visible = useSyncExternalStore(subscribeVisible, snapshotVisible, () => true);
  return enabled && !visible;
}

/**
 * Quick-hide / stealth mode. When enabled (and a PIN is set), the app is
 * covered by an innocuous, blurred overlay the moment the tab is hidden or the
 * window loses focus — so an app-switcher screenshot or a glance over the
 * shoulder can't reveal anything. The cover lifts when the app regains focus.
 */
export function QuickHide() {
  const { settings } = useStore();
  const enabled = !!settings.blurOnHide && securityService.hasVault();
  const covered = useIsCovered(enabled);

  if (!covered) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-[var(--bg)]/95 backdrop-blur-2xl"
      aria-hidden
    >
      <div className="flex flex-col items-center gap-2">
        <LanternLogo className="h-16 w-16" />
        <span className="font-display text-xl font-semibold text-foreground">Lantern</span>
      </div>
    </div>
  );
}
