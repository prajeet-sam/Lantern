import { describe, it, expect } from "vitest";
import type { DailyLog } from "@/types";
import { deriveCycles, median, medianAbsDev, fullCycleLengths } from "@/lib/cycle/engine";

function log(date: string, flow: DailyLog["flow"] = "light"): DailyLog {
  return { date, flow, moods: [], symptoms: [], updatedAt: "" };
}

describe("cycle engine", () => {
  it("produces no cycles from empty input", () => {
    expect(deriveCycles([])).toEqual([]);
  });

  it("ignores days with no flow", () => {
    const cycles = deriveCycles([log("2024-01-05", "none"), log("2024-01-10", "light")]);
    expect(cycles).toHaveLength(1);
    expect(cycles[0].start).toBe("2024-01-10");
  });

  it("groups consecutive period days into a single cycle", () => {
    const cycles = deriveCycles([
      log("2024-01-01"),
      log("2024-01-02"),
      log("2024-01-03"),
    ]);
    expect(cycles).toHaveLength(1);
    expect(cycles[0].start).toBe("2024-01-01");
    expect(cycles[0].end).toBe("2024-01-03");
    expect(cycles[0].periodDuration).toBe(3);
    expect(cycles[0].cycleLength).toBeUndefined();
  });

  it("computes cycle length from one start to the next", () => {
    const cycles = deriveCycles([
      log("2024-01-01"),
      log("2024-01-02"),
      log("2024-01-29"),
    ]);
    expect(cycles).toHaveLength(2);
    expect(cycles[0].cycleLength).toBe(28);
    expect(cycles[1].cycleLength).toBeUndefined();
  });

  it("medians handle even and odd counts", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([3, 1])).toBe(2);
  });

  it("median absolute deviation is stable", () => {
    // cycle history from spec example
    const lengths = fullCycleLengths(
      deriveCycles([
        log("2024-01-01"),
        log("2024-01-29"),
        log("2024-03-01"),
        log("2024-03-30"),
      ]),
    );
    expect(lengths).toHaveLength(3);
    expect(medianAbsDev(lengths)).toBeGreaterThanOrEqual(0);
    expect(median(lengths)).toBe(29);
  });
});