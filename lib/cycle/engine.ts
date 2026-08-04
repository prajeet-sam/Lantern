import type { Cycle, DailyLog } from "@/types";
import { diffDays } from "@/lib/dates";

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  if (s.length % 2 === 0) return (s[mid - 1] + s[mid]) / 2;
  return s[mid];
}

export function medianAbsDev(values: number[]): number {
  if (values.length === 0) return 0;
  const m = median(values);
  const devs = values.map((v) => Math.abs(v - m));
  return median(devs);
}

export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/**
 * Derive period runs (cycles) from daily logs. A cycle is a contiguous run
 * of days where flow != none. This is the source of truth for periods,
 * because it makes every log editable by simply changing a flow value.
 */
export function deriveCycles(logs: DailyLog[]): Cycle[] {
  const withFlow = logs
    .filter((l) => l.flow !== "none")
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date));

  const runs: string[][] = [];
  for (const log of withFlow) {
    const last = runs[runs.length - 1];
    if (last) {
      const prev = last[last.length - 1];
      if (diffDays(log.date, prev) === 1) {
        last.push(log.date);
        continue;
      }
    }
    runs.push([log.date]);
  }

  const starts = runs.map((r) => r[0]);
  return runs.map((run, i) => {
    const nextStart = starts[i + 1];
    return {
      index: i + 1,
      start: run[0],
      end: run[run.length - 1],
      cycleLength: nextStart ? diffDays(nextStart, run[0]) : undefined,
      periodDuration: run.length,
    };
  });
}

export function periodStarts(cycles: Cycle[]): string[] {
  return cycles.map((c) => c.start);
}

export function fullCycleLengths(cycles: Cycle[]): number[] {
  return cycles
    .map((c) => c.cycleLength)
    .filter((v): v is number => typeof v === "number");
}

/** Count occurrences of values in an array. */
export function countBy<T extends string>(values: T[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const v of values) counts[v] = (counts[v] ?? 0) + 1;
  return counts;
}