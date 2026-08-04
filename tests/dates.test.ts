import { describe, it, expect } from "vitest";
import {
  addDaysKey,
  fromKey,
  isValidKey,
  toKey,
} from "@/lib/dates";

describe("dates", () => {
  it("round-trips local keys through Date", () => {
    const key = "2024-03-01";
    expect(toKey(fromKey(key))).toBe(key);
    expect(fromKey(key).getFullYear()).toBe(2024);
    expect(fromKey(key).getDate()).toBe(1);
  });

  it("adds days across month and year boundaries", () => {
    expect(addDaysKey("2024-01-31", 1)).toBe("2024-02-01");
    expect(addDaysKey("2024-12-31", 1)).toBe("2025-01-01");
    expect(addDaysKey("2024-02-28", 1)).toBe("2024-02-29"); // leap year
  });

  it("handles leap day correctly", () => {
    expect(addDaysKey("2024-02-29", 1)).toBe("2024-03-01");
  });

  it("validates date keys", () => {
    expect(isValidKey("2024-01-01")).toBe(true);
    expect(isValidKey("not-a-date")).toBe(false);
    expect(isValidKey("2024-13-40")).toBe(false);
    expect(isValidKey("")).toBe(false);
  });

  it("todayKey returns a valid date", () => {
    expect(isValidKey(toKey(new Date()))).toBe(true);
  });
});