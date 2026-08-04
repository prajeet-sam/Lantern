"use client";

import { useState, type ReactNode } from "react";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui";
import { LanternLogo } from "@/components/LanternLogo";
import type { CycleRegularity } from "@/types";

export function Onboarding() {
  const { setSettings, upsertLog } = useStore();
  const [step, setStep] = useState(0);
  const [lastPeriod, setLastPeriod] = useState(new Date().toISOString().slice(0, 10));
  const [cycleLen, setCycleLen] = useState(28);
  const [periodLen, setPeriodLen] = useState(5);
  const [regularity, setRegularity] = useState<CycleRegularity>("not_sure");
  const [notifyPeriod, setNotifyPeriod] = useState(true);
  const [notifyCheckIn, setNotifyCheckIn] = useState(true);

  const steps = 5;

  async function finish() {
    // Seed a period on the stated start day so history & predictions begin.
    await upsertLog(lastPeriod, { flow: "light" });
    await setSettings({
      lastPeriodStart: lastPeriod,
      typicalCycleLength: cycleLen,
      typicalPeriodDuration: periodLen,
      regularity,
      notifyPeriod,
      notifyCheckIn,
      onboardingComplete: true,
      onboardedAt: new Date().toISOString(),
    });
  }

  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col px-6">
      <div className="flex flex-1 flex-col justify-center py-8">
        <div className="mx-auto mb-6"><LanternLogo className="h-20 w-20" /></div>

        {step === 0 && (
          <Step title="Welcome to your little corner of the sky" body="Lantern helps you understand your cycle, notice patterns, and prepare for what's ahead. Everything stays private on your device." />
        )}
        {step === 1 && (
          <Step title="When did your last period start?" body="Don't worry about being exact — you can correct this anytime.">
            <input type="date" value={lastPeriod} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setLastPeriod(e.target.value)} className="w-full rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-sm text-foreground outline-none focus:border-[var(--primary)]" />
          </Step>
        )}
        {step === 2 && (
          <Step title="How long is your cycle usually?" body="From one period to the next. Choose what feels typical, or 28 if unsure.">
            <RangeValue value={cycleLen} min={21} max={45} suffix="days" onChange={setCycleLen} />
          </Step>
        )}
        {step === 3 && (
          <Step title="And how long do periods usually last?" body="Typical range is 2–10 days.">
            <RangeValue value={periodLen} min={2} max={10} suffix="days" onChange={setPeriodLen} />
            <div className="mt-6">
              <div className="mb-2 text-sm font-medium text-foreground">How regular are your cycles?</div>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    ["very_regular", "Very regular"],
                    ["mostly_regular", "Mostly regular"],
                    ["somewhat_irregular", "Somewhat irregular"],
                    ["very_irregular", "Very irregular"],
                    ["not_sure", "Not sure"],
                  ] as [CycleRegularity, string][]
                ).map(([id, label]) => (
                  <button key={id} onClick={() => setRegularity(id)} aria-pressed={regularity === id} className={`rounded-full border px-4 py-2 text-sm font-medium transition ${regularity === id ? "border-[var(--primary)] bg-[var(--primary)]/15 text-[var(--primary)]" : "border-[var(--border)] text-muted-foreground"}`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </Step>
        )}
        {step === 4 && (
          <Step title="Would you like gentle reminders?" body="All notifications are optional and can be changed later in Settings.">
            <div className="space-y-3">
              <ReminderRow checked={notifyPeriod} onChange={setNotifyPeriod} label="Upcoming period" hint="A heads up a few days before" />
              <ReminderRow checked={notifyCheckIn} onChange={setNotifyCheckIn} label="Daily check-in" hint="A gentle nudge to log today" />
            </div>
          </Step>
        )}
      </div>

      <div className="pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <div className="mb-4 flex items-center gap-1.5">
          {Array.from({ length: steps }).map((_, i) => (
            <div key={i} className={`h-1 flex-1 rounded-full ${i <= step ? "bg-[var(--primary)]" : "bg-[var(--border)]"}`} />
          ))}
        </div>
        <div className="flex gap-3">
          {step > 0 && (<Button variant="ghost" className="flex-none" onClick={() => setStep(step - 1)}>Back</Button>)}
          <Button className="flex-1" size="lg" onClick={() => (step === steps - 1 ? void finish() : setStep(step + 1))}>
            {step === steps - 1 ? "Let's begin ✨" : "Continue"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Step({ title, body, children }: { title: string; body?: string; children?: ReactNode }) {
  return (
    <div>
      <h1 className="font-display text-3xl font-semibold leading-tight text-foreground">{title}</h1>
      {body && <p className="mt-3 text-muted-foreground">{body}</p>}
      {children && <div className="mt-6">{children}</div>}
    </div>
  );
}

function RangeValue({ value, min, max, suffix, onChange }: { value: number; min: number; max: number; suffix?: string; onChange: (n: number) => void }) {
  return (
    <div>
      <div className="mb-2 text-center font-display text-5xl font-bold text-[var(--primary)]">
        {value} <span className="text-lg font-normal text-muted-foreground">{suffix}</span>
      </div>
      <input type="range" min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-[var(--primary)]" aria-label="value" />
      <div className="mt-1 flex justify-between text-xs text-muted-foreground"><span>{min}</span><span>{max}</span></div>
    </div>
  );
}

function ReminderRow({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4 py-3">
      <div>
        <div className="text-sm font-medium text-foreground">{label}</div>
        {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
      </div>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-5 w-9 cursor-pointer appearance-none rounded-full bg-[var(--border)] transition checked:bg-[var(--primary)] relative after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:transition checked:after:translate-x-4" />
    </div>
  );
}