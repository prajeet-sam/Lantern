import { describe, it, expect } from "vitest";
import type { DailyLog, Settings } from "@/types";
import { predict } from "@/lib/prediction/engine";
import { deriveCycles } from "@/lib/cycle/engine";

const BASE = "2024-01-01";

function addDays(key: string, n: number): string {
  const [y, m, d] = key.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
}

/** Consecutive period-day logs, with a period starting on each offset day. */
function cycles(offsets: number[]): DailyLog[] {
  const logs: DailyLog[] = [];
  for (const off of offsets) {
    const key = addDays(BASE, off);
    logs.push({ date: key, flow: "light", moods: [], symptoms: [], updatedAt: "" });
    logs.push({ date: addDays(key, 1), flow: "light", moods: [], symptoms: [], updatedAt: "" });
  }
  return logs;
}

function settings(len?: number): Pick<Settings, "typicalCycleLength"> {
  return { typicalCycleLength: len };
}

function pred(offsets: number[], len?: number) {
  return predict(deriveCycles(cycles(offsets)), settings(len));
}

describe("prediction engine", () => {
  it("returns no prediction when nothing is logged", () => {
    const p = predict([], settings(28));
    expect(p.available).toBe(false);
    expect(p.confidence).toBe("none");
    expect(p.estimatedDate).toBeUndefined();
    expect(p.reasons.length).toBeGreaterThan(0);
  });

  it("gives an early estimate for one cycle", () => {
    const p = pred([0], 28);
    expect(p.available).toBe(true);
    expect(p.confidence).toBe("early");
    expect(p.estimatedDate).toBe(addDays(BASE, 28));
  });

  it("predicts regular cycles around the median length", () => {
    const p = pred([0, 28, 56, 84]);
    expect(p.estimatedCycleLength).toBe(28);
    expect(p.estimatedDate).toBe(addDays(BASE, 112));
  });

  it("uses median to ignore outliers", () => {
    // intervals 28, 28, 60 -> median 28, not the arithmetic mean
    const p = pred([0, 28, 56, 116]);
    expect(p.estimatedCycleLength).toBe(28);
  });

  it("widens the range when cycles are variable", () => {
    const p = pred([0, 25, 59, 87, 124, 150]);
    const span = spanDays(p.rangeStart!, p.rangeEnd!);
    expect(p.available).toBe(true);
    expect(span).toBeGreaterThanOrEqual(6);
  });

  it("handles short and long cycles without crashing", () => {
    expect(pred([0, 21, 24, 63, 84])!.available).toBe(true);
    expect(pred([0, 40, 43, 44])!.available).toBe(true);
    expect(pred([0, 41], 43)!.available).toBe(true);
    expect(pred([0, 21, 21, 21, 21])!.available).toBe(true);
  });

  it("does not crash on leap year / month rollover boundaries", () => {
    expect(pred([0, 29, 60])!.available).toBe(true);
  });

  it("handles a single cycle with default settings", () => {
    const p = pred([0]);
    expect(p.available).toBe(true);
    expect(p.confidence).toBe("early");
  });

  it("raises confidence with more cycles and low variability", () => {
    const p = pred([0, 28, 56, 84, 112, 140]);
    expect(p.confidence).toBe("higher");
  });

  it("lowers confidence with high variability", () => {
    const p = pred([0, 25, 59, 87, 124, 150]);
    expect(p.confidence).not.toBe("higher");
  });
});

function spanDays(start: string, end: string): number {
  const s = utc(start);
  const e = utc(end);
  return Math.round((e - s) / 86400000);
}

function utc(key: string): number {
  const [y, m, d] = key.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}