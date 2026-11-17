"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { useCycle } from "@/lib/use-cycle";
import { todayKey, formatPretty } from "@/lib/dates";
import { Button, Card } from "@/components/ui";
import { Sheet } from "@/components/sheet";
import { CheckInSheet } from "@/components/checkin";
import { CycleHistory } from "@/components/history";
import { Droplet, Timer, CheckCircle2 } from "lucide-react";

export function TrackView() {
  const { upsertLog, getLog } = useStore();
  const ctx = useCycle();
  const [startSheet, setStartSheet] = useState(false);
  const [checkin, setCheckin] = useState(false);
  const today = todayKey();

  const todayLog = getLog(today);
  const inPeriod = todayLog && todayLog.flow !== "none";

  return (
    <div className="mx-auto w-full max-w-md space-y-5">
      <header className="px-1 pt-2">
        <h1 className="font-display text-3xl font-semibold text-foreground">Daily log</h1>
        <p className="text-sm text-muted-foreground">A quick check-in to notice what you need today.</p>
      </header>

      {/* Quick status */}
      <Card className="p-5">
        <div className="mb-1 text-xs uppercase tracking-widest text-muted-foreground">Today</div>
        <div className="flex items-center gap-3">
          {inPeriod ? (
            <CheckCircle2 className="h-8 w-8 text-[var(--rose)]" />
          ) : (
            <Timer className="h-8 w-8 text-[var(--accent)]" />
          )}
          <div>
            <div className="font-display text-xl font-semibold text-foreground">
              {inPeriod ? "On a period day" : "No period today"}
            </div>
            <div className="text-sm text-muted-foreground">
              {ctx.todayHasPeriod ? `Day ${ctx.cycleDayToday} of cycle` : `Cycle day ${ctx.cycleDayToday ?? "—"}`}
            </div>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <Button onClick={() => setStartSheet(true)}>
            <Droplet className="h-4 w-4" /> {inPeriod ? "Edit period" : "Period started"}
          </Button>
          <Button variant="secondary" onClick={() => setCheckin(true)}>Check-in</Button>
        </div>
      </Card>

      <p className="px-1 text-sm text-muted-foreground">
        Tap &ldquo;Period started&rdquo; to mark today (or choose a date) as Day 1 of your period. You can always correct it.
      </p>

      <CycleHistory />

      {/* Period start sheet */}
      <StartSheet
        key={String(startSheet)}
        open={startSheet}
        onClose={() => setStartSheet(false)}
        onStart={async (date) => {
          await upsertLog(date, { flow: "light" });
        }}
      />

      <CheckInSheet date={today} open={checkin} onClose={() => setCheckin(false)} />
      <div className="h-20" />
    </div>
  );
}

function StartSheet({
  open,
  onClose,
  onStart,
}: {
  open: boolean;
  onClose: () => void;
  onStart: (date: string) => Promise<void>;
}) {
  const [date, setDate] = useState(todayKey());
  const [confirm, setConfirm] = useState(false);
  const today = todayKey();

  return (
    <Sheet open={open} onClose={onClose} title="Start your period">
      <div className="space-y-4">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-foreground">Which day did it start?</span>
          <input
            type="date"
            value={date}
            max={today}
            onChange={(e) => { setDate(e.target.value); setConfirm(false); }}
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2.5 text-sm text-foreground outline-none focus:border-[var(--primary)]"
          />
        </label>

        {!confirm ? (
          <Button className="w-full" size="lg" variant="accent" onClick={() => setConfirm(true)}>
            Mark {date === today ? "today" : formatPretty(date)} as Day 1
          </Button>
        ) : (
          <div className="rounded-2xl border border-[var(--accent)]/40 bg-[var(--accent)]/10 p-4">
            <p className="text-sm text-foreground">
              Record {formatPretty(date)} as the start of a period?
            </p>
            <div className="mt-3 flex gap-2">
              <Button
                onClick={async () => {
                  await onStart(date);
                  onClose();
                }}
              >
                Yes, start it
              </Button>
              <Button variant="ghost" onClick={() => setConfirm(false)}>Go back</Button>
            </div>
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          You can edit or remove this anytime — nothing is locked in.
        </p>
        <div className="h-1" />
      </div>
    </Sheet>
  );
}