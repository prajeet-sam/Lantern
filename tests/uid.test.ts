import { describe, it, expect } from "vitest";
import { uid } from "@/lib/uid";

describe("uid", () => {
  it("returns non-empty strings", () => {
    const id = uid();
    expect(typeof id).toBe("string");
    expect(id.length).toBeGreaterThan(0);
  });

  it("returns unique ids at volume", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 5000; i++) seen.add(uid());
    expect(seen.size).toBe(5000);
  });
});
