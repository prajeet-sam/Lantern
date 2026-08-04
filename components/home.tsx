"use client";

import { useState, useMemo } from "react";
import { useStore } from "@/lib/store";
import { useCycle } from "@/lib/use-cycle";
import { CONFIDENCE_LABEL } from "@/lib/labels";
import { formatPretty, addDaysKey } from "@/lib/dates";
import { Droplet, CalendarClock, HeartHandshake, Sparkles, BookOpen, Heart } from "lucide-react";
import { Button, Card, EmptyState } from "@/components/ui";
import { CycleRing } from "@/components/cyclering";
import { CheckInSheet } from "@/components/checkin";
import { LanternLogo } from "@/components/LanternLogo";

export function HomeView({ onStartPeriod }: { onStartPeriod: () => void }) {
  const { settings } = useStore();
  const ctx = useCycle();
  const [sheetOpen, setSheetOpen] = useState(false);
  const todayLabel = formatPretty(ctx.today);

  const prediction = ctx.prediction;
  const cycleLen = prediction.estimatedCycleLength ?? settings.typicalCycleLength ?? 28;

  // This week mini timeline (last 7 days including today)
  const weekDays = useMemo(() => {
    const days: string[] = [];
    for (let i = 6; i >= 0; i--) {
      days.push(addDaysKey(ctx.today, -i));
    }
    return days;
  }, [ctx.today]);

  const { logs, journals } = useStore();
  const logsByDate = useMemo(() => new Map(logs.map((l) => [l.date, l])), [logs]);
  const journalsByDate = useMemo(() => new Map(journals.map((j) => [j.date, j])), [journals]);

  return (
    <div className="mx-auto w-full max-w-md space-y-5">
      <header className="flex items-center justify-between px-1 pt-2">
        <div>
          <h1 className="font-display text-2xl font-semibold text-foreground">
            {settings.displayName ? `Hello, ${settings.displayName} ✨` : "Your little corner of the sky ✨"}
          </h1>
          <p className="text-sm text-muted-foreground">{todayLabel}</p>
        </div>
        {!ctx.todayHasPeriod && (
          <button
            onClick={onStartPeriod}
            className="flex items-center gap-1.5 rounded-full bg-[var(--rose)]/15 px-3 py-2 text-sm font-medium text-[var(--rose)] hover:bg-[var(--rose)]/25"
          >
            <Droplet className="h-4 w-4" />
            Period started
          </button>
        )}
      </header>

      {!prediction.available ? (
        <EmptyState
          icon={<LanternLogo className="h-12 w-12" />}
          title="Your story is just beginning"
          subtitle="Log your first period and Lantern will start learning your rhythm."
        />
      ) : (
        <Card className="p-5 text-center">
          <CycleRing
            prediction={prediction}
            cycleLen={cycleLen}
            cycleDay={ctx.cycleDayToday}
            periodDays={settings.typicalPeriodDuration ?? 5}
          />
        </Card>
      )}

      {/* Predicted period card */}
      <Card className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-widest text-muted-foreground">Next period</div>
            <div className="font-display text-2xl font-semibold leading-snug text-foreground">
              {prediction.available ? nextPeriodHeadline(ctx.nextPeriodInDays, ctx.todayHasPeriod) : "Learning your pattern…"}
            </div>
          </div>
          <Sparkles className="h-5 w-5 text-[var(--accent)]" />
        </div>

        {prediction.available && (
          <>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <span className="rounded-full bg-[var(--secondary)]/50 px-2.5 py-1 text-xs text-[var(--secondary-foreground)]">
                {CONFIDENCE_LABEL[prediction.confidence]}
              </span>
              {prediction.estimatedDate && (
                <span className="rounded-full bg-[var(--secondary)]/50 px-2.5 py-1 text-xs text-[var(--secondary-foreground)]">
                  Around {formatPretty(prediction.estimatedDate)}
                </span>
              )}
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{prediction.reasons[1] ?? prediction.reasons[0]}</p>
          </>
        )}
      </Card>

      {/* Estimated phase */}
      <Card className="p-5">
        <div className="mb-1 flex items-center gap-2 text-sm font-medium text-foreground">
          <CalendarClock className="h-4 w-4 text-[var(--rose)]" />
          Estimated phase
        </div>
        <div className="flex items-baseline gap-2">
          <span className="font-display text-2xl font-semibold text-foreground">{ctx.phase?.label ?? "Unknown"}</span>
          {ctx.phase?.cycleDay ? <span className="text-sm text-muted-foreground">· cycle day {ctx.phase.cycleDay}</span> : null}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{ctx.phase?.explanation}</p>
      </Card>

      {/* This week timeline */}
      <Card className="p-5">
        <div className="mb-2 flex items-center gap-2 font-display text-lg font-semibold text-foreground">
          <BookOpen className="h-5 w-5 text-[var(--accent)]" /> This week
        </div>
        <div className="flex gap-1 overflow-x-auto pb-1 -mx-1 px-1">
          {weekDays.map((d) => {
            const log = logsByDate.get(d);
            const journal = journalsByDate.get(d);
            const isToday = d === ctx.today;
            return (
              <div
                key={d}
                className={`flex flex-col items-center gap-1 min-w-[3rem] ${isToday ? "relative" : ""}`}
              >
                <span className="text-xs text-muted-foreground">{new Date(d + "T00:00:00").toLocaleDateString(undefined, { weekday: "short" })}</span>
                <span className="text-xs font-medium text-foreground">{new Date(d + "T00:00:00").getDate()}</span>
                <div className="flex flex-col items-center gap-1 mt-1">
                  {log?.flow && log.flow !== "none" && <Heart className="h-3.5 w-3.5 text-[var(--rose)]" />}
                  {log?.moods.length && <span className="h-1.5 w-1.5 rounded-full bg-[var(--primary)]" title="Mood" />}
                  {log?.symptoms.length && <span className="h-1.5 w-1.5 rounded-full bg-[var(--peach)]" title="Symptoms" />}
                  {journal && <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" title="Journal" />}
                </div>
                {isToday && <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 text-[10px] text-[var(--accent)]">today</span>}
              </div>
            );
          })}
        </div>
      </Card>

      {/* Care for yourself */}
      <Card className="p-5">
        <div className="mb-2 flex items-center gap-2 font-display text-lg font-semibold text-foreground">
          <HeartHandshake className="h-5 w-5 text-[var(--rose)]" /> Care for yourself
        </div>
        <p className="text-sm leading-7 text-muted-foreground">
          Rest, hydration, gentle movement, and warmth can feel comforting. Track your own patterns — and if something
          ever feels unusually severe or concerning, a healthcare professional can help.
        </p>
      </Card>

      {/* Daily check-in */}
      <Button size="lg" className="w-full" onClick={() => setSheetOpen(true)}>
        How are you today? ✨
      </Button>

      <CheckInSheet date={ctx.today} open={sheetOpen} onClose={() => setSheetOpen(false)} />
      <div className="h-20" />
    </div>
  );
}

function nextPeriodHeadline(days: number | undefined, todayHasPeriod: boolean): React.ReactNode {
  if (todayHasPeriod) {
    return <>You&rsquo;re on a period day. Be gentle. <span className="text-base font-normal">❤</span></>;
  }
  if (days === undefined) return <>We&rsquo;re still learning your rhythm.</>;
  if (days < 0) return <>Around now — keep an eye out.</>;
  return <>Likely in ~{days} day{days === 1 ? "" : "s"}</>;
}