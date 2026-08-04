import type { DailyLog, CyclePrediction, MoodId } from "@/types";
import { addDaysKey } from "@/lib/dates";
import { deriveCycles } from "@/lib/cycle/engine";
import { ovulationDay } from "@/lib/cycle/phases";

export interface DayMark {
  flow: boolean;
  predicted: boolean;
  fertile: boolean;
  journal: boolean;
  moods: MoodId[];
}

export function buildMarks(
  logs: DailyLog[],
  prediction: CyclePrediction,
  periodDays: number,
  journals: { id: string; date: string; moods: MoodId[] }[] = [],
): Map<string, DayMark> {
  const map = new Map<string, DayMark>();

  const ensure = (key: string): DayMark => {
    let m = map.get(key);
    if (!m) {
      m = { flow: false, predicted: false, fertile: false, journal: false, moods: [] };
      map.set(key, m);
    }
    return m;
  };

  for (const l of logs) {
    if (l.flow !== "none") {
      const m = ensure(l.date);
      m.flow = true;
      if (l.moods.length) m.moods = Array.from(new Set([...m.moods, ...l.moods]));
    }
  }

  for (const j of journals) {
    const m = ensure(j.date);
    m.journal = true;
    if (j.moods.length) m.moods = Array.from(new Set([...m.moods, ...j.moods]));
  }

  if (prediction.available) {
    const start = prediction.estimatedDate;
    if (start) {
      const dur = Math.min(10, Math.max(1, Math.round(periodDays || 5)));
      for (let i = 0; i < dur; i++) ensure(addDaysKey(start, i)).predicted = true;
    }
    // fertile window estimate centered on the current cycle
    const len = prediction.estimatedCycleLength ?? 28;
    const { start: fertileStart, end: fertileEnd } = fertileWindow(logs, len);
    if (fertileStart && fertileEnd) {
      let d = fertileStart;
      let guard = 0;
      while (d <= fertileEnd && guard++ < 60) {
        ensure(d).fertile = true;
        d = addDaysKey(d, 1);
      }
    }
  }

  return map;
}

function fertileWindow(
  logs: DailyLog[],
  cycleLen: number,
): { start?: string; end?: string } {
  // Anchor to the most recent period DAY-1 (its start), not its last flow day.
  const starts = deriveCycles(logs).map((c) => c.start);
  if (!starts.length) return {};
  const lastStart = starts[starts.length - 1];
  const ov = ovulationDay(cycleLen);
  const start = addDaysKey(lastStart, Math.max(0, ov - 4));
  const end = addDaysKey(lastStart, ov + 3);
  return { start, end };
}