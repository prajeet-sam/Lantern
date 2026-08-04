import { describe, it, expect } from "vitest";
import type { DailyLog } from "@/types";
import { generateInsights, compareCycles, findSymptomCorrelations, computeMilestones } from "@/lib/insights/engine";
import { deriveCycles } from "@/lib/cycle/engine";
import { addDaysKey } from "@/lib/dates";

function day(date: string, patch: Partial<DailyLog> = {}): DailyLog {
  return { date, flow: "none", moods: [], symptoms: [], updatedAt: "", ...patch };
}

describe("insights engine", () => {
  it("returns nothing for no data", () => {
    expect(generateInsights([])).toEqual([]);
  });

  it("reports a steady rhythm for consistent cycles", () => {
    const logs = [
      day("2024-01-01", { flow: "light" }),
      day("2024-01-28", { flow: "light" }),
      day("2024-02-25", { flow: "light" }),
      day("2024-03-24", { flow: "light" }),
    ];
    const out = generateInsights(logs);
    expect(out.some((i) => i.id === "consistency")).toBe(true);
  });

  it("notices a symptom appearing often on period days", () => {
    const logs = [
      day("2024-01-01", { flow: "light", symptoms: ["cramps"] }),
      day("2024-02-01", { flow: "light", symptoms: ["cramps"] }),
      day("2024-03-01", { flow: "light", symptoms: ["cramps"] }),
    ];
    const out = generateInsights(logs);
    expect(out.some((i) => i.id === "symptom-cramps")).toBe(true);
  });

  it("does not infer causation in wording", () => {
    const logs = [
      day("2024-01-01", { flow: "light", symptoms: ["cramps"] }),
      day("2024-02-01", { flow: "light", symptoms: ["cramps"] }),
    ];
    const out = generateInsights(logs);
    const joined = out.map((i) => i.observation + " " + i.evidence).join(" ");
    expect(joined).not.toMatch(/hormone/i);
    expect(joined).not.toMatch(/caus/i);
  });
});

describe("cycle comparison", () => {
  it("summarizes per-cycle stats", () => {
    const logs = [
      day("2024-01-01", { flow: "light", moods: ["low"], symptoms: ["cramps"] }),
      day("2024-01-02", { flow: "heavy", moods: ["low"], symptoms: ["cramps", "headache"] }),
      day("2024-02-01", { flow: "light", moods: ["low"], symptoms: ["cramps"] }),
    ];
    const cycles = deriveCycles(logs);
    const out = compareCycles(logs, cycles);
    expect(out.length).toBe(2);
    expect(out[0].index).toBe(2); // newest first
    expect(out[0].loggedDays).toBe(1);
    expect(out[0].topMoods[0].label).toBe("Low");
    expect(out[0].topSymptoms[0].label).toBe("Cramps");
    expect(out[1].periodDuration).toBe(2);
  });
});

describe("symptom correlations", () => {
  it("notices a symptom that clusters right before a period", () => {
    const logs: DailyLog[] = [];
    // Two periods, each preceded by bloating 2 days prior
    for (const start of ["2024-01-10", "2024-02-10", "2024-03-10"]) {
      logs.push(day(addDaysKey(start, -2), { symptoms: ["bloating"] }));
      logs.push(day(addDaysKey(start, -1), { symptoms: ["bloating"] }));
      logs.push(day(start, { flow: "light", symptoms: ["bloating"] }));
      logs.push(day(addDaysKey(start, 1), { flow: "light" }));
    }
    const out = findSymptomCorrelations(logs);
    const bloating = out.find((c) => c.id === "corr-bloating");
    expect(bloating).toBeDefined();
    expect(bloating!.window).toBe("before");
    expect(bloating!.share).toBeGreaterThan(0.5);
  });

  it("requires a clear majority before reporting", () => {
    const logs: DailyLog[] = [
      day("2024-01-01", { flow: "light", symptoms: ["cramps"] }),
      day("2024-02-01", { flow: "light", symptoms: ["cramps"] }),
      day("2024-03-01", { flow: "light", symptoms: ["cramps"] }),
      // scattered mid-cycle occurrences dilute the pattern
      day("2024-01-15", { symptoms: ["cramps"] }),
      day("2024-02-15", { symptoms: ["cramps"] }),
      day("2024-03-15", { symptoms: ["cramps"] }),
    ];
    const out = findSymptomCorrelations(logs);
    expect(out.some((c) => c.id === "corr-cramps")).toBe(false);
  });
});

describe("milestones", () => {
  it("celebrates first log and journaling", () => {
    const logs = [day("2024-01-01", { flow: "light" })];
    const out = computeMilestones(logs, 3);
    expect(out.some((m) => m.id === "first-log")).toBe(true);
    expect(out.some((m) => m.id === "journal")).toBe(true);
  });

  it("does not award redundant milestones without enough cycles", () => {
    const logs = [day("2024-01-01", { flow: "light" })];
    const out = computeMilestones(logs, 0);
    expect(out.some((m) => m.id === "two-cycles")).toBe(false);
    expect(out.some((m) => m.id === "five-cycles")).toBe(false);
  });
});