import { describe, it, expect } from "vitest";
import {
  MAX_DAILY_LOGS,
  MAX_JOURNALS,
  MAX_TAGS_PER_RECORD,
  MAX_TEXT_LENGTH,
  parseExport,
  sanitizeDailyLog,
  sanitizeSettings,
} from "@/lib/validation";

describe("validation", () => {
  it("rejects non-JSON", () => {
    const r = parseExport("this is not json");
    expect(r.ok).toBe(false);
  });

  it("rejects a JSON object without expected arrays", () => {
    const r = parseExport(JSON.stringify({ dailyLogs: "nope" }));
    expect(r.ok).toBe(false);
  });

  it("accepts and sanitizes a valid export", () => {
    const r = parseExport(
      JSON.stringify({
        dailyLogs: [
          { date: "2024-01-01", flow: "light", moods: [], symptoms: [] },
          { date: "bad-date", flow: "heavy" },
        ],
        journals: [{ id: "j1", date: "2024-01-02", text: "hi" }],
      }),
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.dailyLogs).toHaveLength(1);
      expect(r.data.dailyLogs[0].flow).toBe("light");
      expect(r.data.journals).toHaveLength(1);
    }
  });

  it("rejects an oversized export before parsing", () => {
    const big = JSON.stringify({ dailyLogs: Array.from({ length: 1000 }, (_, i) => ({ date: `2020-01-${String((i % 28) + 1).padStart(2, "0")}`, text: "x".repeat(12000) })) });
    expect(big.length).toBeGreaterThan(8 * 1024 * 1024);
    const r = parseExport(big);
    expect(r.ok).toBe(false);
  });

  it("rejects exports with more records than the cap", () => {
    const logs = Array.from({ length: MAX_DAILY_LOGS + 1 }, (_, i) => ({ date: `2024-${String((i % 12) + 1).padStart(2, "0")}-01`, flow: "none" }));
    const r = parseExport(JSON.stringify({ dailyLogs: logs }));
    expect(r.ok).toBe(false);

    const journals = Array.from({ length: MAX_JOURNALS + 1 }, (_, i) => ({ id: `j${i}`, date: "2024-01-01", text: "hi" }));
    const r2 = parseExport(JSON.stringify({ journals }));
    expect(r2.ok).toBe(false);
  });

  it("clamps numeric fields to app bounds", () => {
    const ok = sanitizeDailyLog({ date: "2024-01-01", energy: 99, stress: -3 });
    expect(ok).not.toBeNull();
    expect(ok!.energy).toBe(5);
    expect(ok!.stress).toBe(1);
    expect(sanitizeDailyLog({ date: "2024-01-01", energy: "high" })!.energy).toBeUndefined();
  });

  it("truncates journal text and caps tag arrays", () => {
    const j = sanitizeDailyLog({
      date: "2024-01-01",
      flow: "medium",
      moods: Array.from({ length: 500 }, (_, i) => (i % 2 ? "happy" : "custom:x")),
    });
    expect(j).not.toBeNull();
    expect(j!.moods).toHaveLength(MAX_TAGS_PER_RECORD);

    const longText = "a".repeat(MAX_TEXT_LENGTH + 50);
    const entry = parseExport(JSON.stringify({ journals: [{ id: "j1", date: "2024-01-01", text: longText }] }));
    expect(entry.ok).toBe(true);
    if (entry.ok) {
      expect(entry.data.journals[0].text).toHaveLength(MAX_TEXT_LENGTH);
    }
  });

  it("dedupes logs by date and journals by id", () => {
    const r = parseExport(
      JSON.stringify({
        dailyLogs: [
          { date: "2024-01-01", flow: "light" },
          { date: "2024-01-01", flow: "heavy" },
        ],
        journals: [{ id: "j1", date: "2024-01-02", text: "one" }, { id: "j1", date: "2024-01-03", text: "two" }],
      }),
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.dailyLogs).toHaveLength(1);
      expect(r.data.journals).toHaveLength(1);
    }
  });

  it("sanitizes a daily log with invalid fields", () => {
    const ok = sanitizeDailyLog({
      date: "2024-01-01",
      flow: "not-a-flow",
      moods: ["happy", "bogus"],
      symptoms: ["other"],
    });
    expect(sanitizeDailyLog({ date: "2024-01-01", flow: "medium" })!.flow).toBe("medium");
    expect(ok).not.toBeNull();
    if (ok) {
      expect(ok.flow).toBe("none");
      expect(ok.moods).toEqual(["happy"]);
    }
    expect(sanitizeDailyLog({ date: "bad" })).toBeNull();
  });

  it("only imports the settings fields a backup actually exports", () => {
    const s = sanitizeSettings({
      theme: "dark",
      notifyPeriod: true,
      privacyLockPin: "abc",
      autoLockMinutes: 5,
      blurOnHide: true,
      onboardingComplete: true,
      customItems: [{ id: "custom:x", label: "x", type: "mood" }],
      regularity: "very_regular",
      firstDayOfWeek: 1,
      typicalCycleLength: 29,
      notificationPrivacy: "detailed",
    });
    expect(s).not.toBeNull();
    expect(s!.regularity).toBe("very_regular");
    expect(s!.firstDayOfWeek).toBe(1);
    expect(s!.typicalCycleLength).toBe(29);
    expect(s!.notificationPrivacy).toBe("detailed");
    const keys = Object.keys(s!);
    expect(keys).not.toContain("theme");
    expect(keys).not.toContain("notifyPeriod");
    expect(keys).not.toContain("privacyLockPin");
    expect(keys).not.toContain("autoLockMinutes");
    expect(keys).not.toContain("blurOnHide");
    expect(keys).not.toContain("onboardingComplete");
    expect(keys).not.toContain("customItems");
    expect(sanitizeSettings(null)).toBeNull();
  });

  it("rejects out-of-range settings and bad regularity", () => {
    const s = sanitizeSettings({ typicalCycleLength: 999, firstDayOfWeek: 99, regularity: "nonsense" });
    expect(s!.typicalCycleLength).toBe(45);
    expect(s!.firstDayOfWeek).toBe(6);
    expect(s!.regularity).toBeUndefined();
  });
});
