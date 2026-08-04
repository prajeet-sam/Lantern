"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { useCycle } from "@/lib/use-cycle";
import { addDaysKey, formatPretty } from "@/lib/dates";
import { EmptyState, Card } from "@/components/ui";
import { Trash2, ChevronRight } from "lucide-react";
import { Sheet } from "@/components/sheet";

export function CycleHistory({ onDayClick }: { onDayClick?: (date: string) => void }) {
  const { cycles } = useCycle();
  const { deleteLog, getLog } = useStore();
  const [manage, setManage] = useState<string | null>(null); // cycle index
  const [confirm, setConfirm] = useState(false);

  const target = manage !== null ? cycles[Number(manage)] : undefined;

  if (!cycles.length) {
    return <EmptyState title="No cycles yet" subtitle="Log your period and your history will appear here." />;
  }

  const days = target ? cycleDays(target) : [];

  return (
    <>
      <section aria-label="Cycle history">
        <h2 className="px-1 font-display text-xl font-semibold text-foreground">Your cycles</h2>
        <div className="mt-2 space-y-2">
          {cycles.slice().sort((a, b) => b.start.localeCompare(a.start)).map((c) => {
            // original index for management
            const realIndex = cycles.findIndex((x) => x.start === c.start);
            return (
              <Card key={c.start} className="flex items-center justify-between p-4">
                <button
                  onClick={() => onDayClick?.(c.start)}
                  className="text-left"
                >
                  <div className="font-medium text-foreground">Cycle #{c.start.length ? cycles.length - realIndex : ""}</div>
                  <div className="text-xs text-muted-foreground">
                    {formatPretty(c.start)}
                    {c.periodDuration ? ` · ${c.periodDuration} day period` : ""}
                    {c.cycleLength ? ` · ${c.cycleLength}d cycle` : ""}
                  </div>
                </button>
                <div className="flex items-center gap-2">
                  <button
                    aria-label={`Manage cycle starting ${formatPretty(c.start)}`}
                    onClick={() => {
                      setManage(String(realIndex));
                      setConfirm(false);
                    }}
                    className="rounded-full p-2 text-muted-foreground hover:bg-[var(--secondary)]/50"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      </section>

      <Sheet open={!!manage} onClose={() => setManage(null)} title={target ? `Cycle from ${formatPretty(target.start)}` : "Cycle"}>
        <div className="space-y-3">
          <div className="text-sm text-muted-foreground">
            This period includes {days.length} day{days.length === 1 ? "" : "s"}:
          </div>
          <div className="flex flex-wrap gap-2">
            {days.map((d) => (
              <button
                key={d}
                onClick={() => {
                  onDayClick?.(d);
                  setManage(null);
                }}
                className="rounded-full bg-[var(--secondary)]/50 px-3 py-1.5 text-xs text-[var(--secondary-foreground)] hover:bg-[var(--secondary)]"
              >
                {formatPretty(d)}
                {getLog(d)?.flow !== "none" ? " · period" : ""}
              </button>
            ))}
          </div>

          {!confirm ? (
            <button
              onClick={() => setConfirm(true)}
              className="flex w-full items-center gap-2 text-sm text-[var(--danger)]"
            >
              <Trash2 className="h-4 w-4" /> Remove this period&apos;s days
            </button>
          ) : (
            <div className="rounded-2xl border border-[var(--danger)]/40 bg-[var(--danger)]/10 p-4">
              <p className="text-sm text-foreground">Remove all {days.length} period day{days.length === 1 ? "" : "s"} in this cycle?</p>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={async () => {
                    for (const d of days) await deleteLog(d);
                    setManage(null);
                  }}
                  className="rounded-full bg-[var(--danger)] px-4 py-2 text-sm font-medium text-white"
                >
                  Yes, remove
                </button>
                <button onClick={() => setConfirm(false)} className="rounded-full bg-[var(--secondary)] px-4 py-2 text-sm text-[var(--secondary-foreground)]">
                  Keep them
                </button>
              </div>
            </div>
          )}
          <div className="h-2" />
        </div>
      </Sheet>
    </>
  );
}

function cycleDays(c: { start: string; end?: string }): string[] {
  const out: string[] = [];
  let d = c.start;
  const end = c.end ?? c.start;
  while (d <= end) {
    out.push(d);
    d = addDaysKey(d, 1);
  }
  return out;
}