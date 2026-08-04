"use client";

import { useMemo, useState } from "react";
import {
  addMonths,
  startOfMonth,
  startOfWeek,
  addDays,
  eachDayOfInterval,
  format,
  isSameMonth,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useStore } from "@/lib/store";
import { useCycle } from "@/lib/use-cycle";
import { buildMarks } from "@/lib/dailymarks";
import { CheckInSheet } from "@/components/checkin";
import { CycleHistory } from "@/components/history";

export function CalendarView() {
  const { logs, journals, settings } = useStore();
  const ctx = useCycle();
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));
  const [selected, setSelected] = useState<string | null>(null);

const marks = useMemo(
    () => buildMarks(logs, ctx.prediction, settings.typicalPeriodDuration ?? 5, journals),
    [logs, ctx.prediction, settings.typicalPeriodDuration, journals],
  );

  const weekStart = startOfWeek(cursor, { weekStartsOn: (settings.firstDayOfWeek || 0) as 0 | 1 });
  const days = eachDayOfInterval({ start: weekStart, end: addDays(weekStart, 41) });
  const monthLabel = format(cursor, "MMMM yyyy");

  return (
    <div className="mx-auto w-full max-w-md space-y-4">
      <div className="flex items-center justify-between px-1 pt-2">
        <h1 className="font-display text-2xl font-semibold text-foreground">Calendar</h1>
        <div className="flex items-center gap-1">
          <button aria-label="Previous month" onClick={() => setCursor(addMonths(cursor, -1))} className="rounded-full p-2 text-muted-foreground hover:bg-[var(--secondary)]/50">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="min-w-[9rem] text-center font-medium text-foreground">{monthLabel}</div>
          <button aria-label="Next month" onClick={() => setCursor(addMonths(cursor, 1))} className="rounded-full p-2 text-muted-foreground hover:bg-[var(--secondary)]/50">
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="card rounded-2xl p-3">
<div className="grid grid-cols-7 gap-1 text-center text-xs uppercase text-muted-foreground">
          {weekdayHeaders(settings.firstDayOfWeek).map((hd, i) => (
            <div key={i}>{hd}</div>
          ))}
        </div>
        <div className="mt-1 grid grid-cols-7 gap-1">
          {days.map((d) => {
            const key = format(d, "yyyy-MM-dd");
            const m = marks.get(key);
            const inMonth = isSameMonth(d, cursor);
            const today = d.getMonth() === new Date().getMonth() && d.getDate() === new Date().getDate();
            const open = selected === key;
            return (
              <button
                key={key}
                onClick={() => setSelected(open ? null : key)}
                aria-label={`${format(d, "EEEE MMMM d")}${m ? " with entries" : ""}`}
                className={`relative flex aspect-square flex-col items-center justify-center rounded-xl text-sm transition ${
                  inMonth ? "text-foreground" : "text-muted-foreground/40"
                } ${open ? "bg-[var(--primary)]/15 ring-1 ring-[var(--primary)]" : "hover:bg-[var(--secondary)]/40"} ${today ? "bg-[var(--secondary)]/60 font-semibold" : ""}`}
              >
                <span>{format(d, "d")}</span>
                <div className="mt-0.5 flex items-center gap-0.5">
                  {m?.flow ? <i className="h-1.5 w-1.5 rounded-full bg-[var(--rose)]" /> : null}
                  {m?.predicted ? <i className="h-1.5 w-1.5 rounded-full border border-[var(--rose)]" /> : null}
                  {m?.fertile ? <i className="h-1.5 w-1.5 rounded-full bg-[var(--peach)]" /> : null}
                  {m?.journal ? <i className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" /> : null}
                  {m?.moods.length ? <i className="h-1.5 w-1.5 rounded-full bg-[var(--primary)]" /> : null}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap gap-3 px-1 text-xs text-muted-foreground">
        {(
          [
            ["Period", "var(--rose)", true],
            ["Predicted", "var(--rose)", false],
            ["Fertile est.", "var(--peach)", true],
            ["Journal", "var(--accent)", true],
            ["Mood", "var(--primary)", true],
          ] as [string, string, boolean][]
        ).map(([label, color, filled]) => (
          <span key={label as string} className="flex items-center gap-1.5">
            <span
              className="h-2 w-2 rounded-full"
              style={{ background: filled ? color : "transparent", border: `1px solid ${color}` }}
            />
            {label}
          </span>
        ))}
      </div>

      <CycleHistory onDayClick={(date) => setSelected(date)} />

      <CheckInSheet date={selected ?? ""} open={!!selected} onClose={() => setSelected(null)} />
      <div className="h-20" />
    </div>
  );
}

function weekdayHeaders(first: number): string[] {
  const base = ["S", "M", "T", "W", "T", "F", "S"];
  return [...base.slice(first), ...base.slice(0, first)];
}