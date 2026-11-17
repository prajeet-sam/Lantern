"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useStore } from "@/lib/store";
import { Onboarding } from "@/components/onboarding";
import { RemindersGate } from "@/components/reminders";
import { PinGate } from "@/components/pinlock";
import { QuickHide } from "@/components/quickhide";
import { HomeView } from "@/components/home";
import { TrackView } from "@/components/track";
import { CalendarView } from "@/components/calendar";
import { InsightsView } from "@/components/insights";
import { SettingsView } from "@/components/settings";
import { Atmosphere } from "@/components/atmosphere";
import { LanternLogo } from "@/components/LanternLogo";
import { Home, Calendar, BarChart3, Settings as SettingsIcon, Droplet } from "lucide-react";

type Tab = "home" | "track" | "calendar" | "insights" | "settings";

const NAV: { id: Tab; label: string; icon: typeof Home }[] = [
  { id: "home", label: "Home", icon: Home },
  { id: "calendar", label: "Calendar", icon: Calendar },
  { id: "track", label: "Log", icon: Droplet },
  { id: "insights", label: "Insights", icon: BarChart3 },
  { id: "settings", label: "Profile", icon: SettingsIcon },
];

export default function Page() {
  const { ready, settings } = useStore();
  const [tab, setTab] = useState<Tab>("home");
  const reduced = useReducedMotion() || settings.reducedMotion;

  if (!ready) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center">
        <LanternLogo className="h-12 w-12 animate-pulse" />
      </div>
    );
  }

  if (!settings.onboardingComplete) {
    return (<><Atmosphere /><Onboarding /></>);
  }

  return (
    <PinGate>
      <Atmosphere />
      <RemindersGate />
      <QuickHide />
      <div className="mx-auto flex min-h-[100dvh] w-full max-w-5xl gap-0 md:gap-6">
        {/* Desktop sidebar */}
        <aside className="sticky top-0 hidden h-[100dvh] w-56 flex-col gap-1 p-6 md:flex">
          <div className="mb-6 flex items-center gap-2">
            <LanternLogo className="h-9 w-9" />
            <span className="font-display text-2xl font-semibold tracking-tight text-foreground">Moonlit Garden</span>
          </div>
          {NAV.map((n) => (
            <NavButton key={n.id} active={tab === n.id} onClick={() => setTab(n.id)} label={n.label} icon={n.icon} />
          ))}
        </aside>

        {/* Main column */}
        <div className="relative flex min-h-[100dvh] flex-1 flex-col">
          {/* Mobile header */}
          <div className="flex items-center justify-between px-5 pt-5 md:hidden">
            <div className="flex items-center gap-2">
              <LanternLogo className="h-7 w-7" />
              <span className="font-display text-xl font-semibold tracking-tight text-foreground">Moonlit Garden</span>
            </div>
            <button onClick={() => setTab("settings")} aria-label="Open settings" className="rounded-full p-2 text-muted-foreground hover:bg-[var(--secondary)]/50">
              <SettingsIcon className="h-5 w-5" />
            </button>
          </div>

          <main className="flex-1 px-5 pb-24 pt-2 md:px-0 md:pt-10">
            <AnimatePresence mode="wait">
              <motion.div
                key={tab}
                initial={{ opacity: 0, y: reduced ? 0 : 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: reduced ? 0 : -8 }}
                transition={{ duration: reduced ? 0 : 0.22 }}
              >
                {tab === "home" && <HomeView onStartPeriod={() => setTab("track")} />}
                {tab === "track" && <TrackView />}
                {tab === "calendar" && <CalendarView />}
                {tab === "insights" && <InsightsView />}
                {tab === "settings" && <SettingsView />}
              </motion.div>
            </AnimatePresence>
          </main>
        </div>
      </div>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--border)] bg-[var(--background)]/80 backdrop-blur-md md:hidden">
        <div className="mx-auto flex max-w-md items-stretch justify-around pb-[max(0.4rem,env(safe-area-inset-bottom))]">
          {NAV.map((n) => {
            const active = tab === n.id;
            const isTrack = n.id === "track";
            return (
              <button
                key={n.id}
                onClick={() => setTab(n.id)}
                aria-current={active ? "page" : undefined}
                className={`flex min-w-0 flex-col items-center gap-0.5 px-2 py-1.5 text-[10px] ${
                  isTrack
                    ? "-mt-5 rounded-full border-4 border-[var(--background)] bg-[var(--primary)] p-3 text-[var(--primary-foreground)] shadow-lg shadow-[var(--primary)]/25"
                    : active
                      ? "text-[var(--primary)]"
                      : "text-muted-foreground"
                }`}
              >
                <n.icon className="h-5 w-5" />
                <span>{n.label}</span>
                {active && !isTrack && (
                  <motion.span layoutId="tabdot" className="absolute -top-0 h-1 w-1 rounded-full bg-[var(--accent)]" style={{ top: -2 }} />
                )}
              </button>
            );
          })}
        </div>
      </nav>
    </PinGate>
  );
}

function NavButton({ active, onClick, label, icon: Icon }: { active: boolean; onClick: () => void; label: string; icon: typeof Home }) {
  return (
    <button
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-left font-medium transition ${
        active ? "bg-[var(--primary)]/15 text-[var(--primary)]" : "text-muted-foreground hover:bg-[var(--secondary)]/40"
      }`}
    >
      <Icon className="h-5 w-5" />
      {label}
    </button>
  );
}