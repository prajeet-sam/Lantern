import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { auditEventLabel, clearAudit, logAudit, readAudit, MAX_AUDIT_ENTRIES } from "@/lib/audit";

function makeStorage(): Storage {
  const store = new Map<string, string>();
  return {
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => {
      store.set(k, v);
    },
    removeItem: (k) => {
      store.delete(k);
    },
    clear: () => store.clear(),
    key: () => null,
    get length() {
      return store.size;
    },
  } as Storage;
}

describe("audit", () => {
  beforeEach(() => {
    (globalThis as { localStorage?: Storage }).localStorage = makeStorage();
  });

  afterEach(() => {
    delete (globalThis as { localStorage?: Storage }).localStorage;
  });

  it("records events in order", () => {
    logAudit("unlock");
    logAudit("pin_set");
    const entries = readAudit();
    expect(entries).toHaveLength(2);
    expect(entries[0].e).toBe("unlock");
    expect(entries[1].e).toBe("pin_set");
    expect(entries[0].t).toBeLessThanOrEqual(entries[1].t);
  });

  it("is bounded to MAX_AUDIT_ENTRIES", () => {
    for (let i = 0; i < MAX_AUDIT_ENTRIES + 50; i++) logAudit("app_launch");
    expect(readAudit()).toHaveLength(MAX_AUDIT_ENTRIES);
  });

  it("keeps the newest entries after trimming", () => {
    for (let i = 0; i < MAX_AUDIT_ENTRIES + 5; i++) logAudit("lock");
    logAudit("wipe");
    const entries = readAudit();
    expect(entries[entries.length - 1].e).toBe("wipe");
  });

  it("can be cleared", () => {
    logAudit("unlock");
    clearAudit();
    expect(readAudit()).toHaveLength(0);
  });

  it("labels events", () => {
    expect(auditEventLabel("pin_changed")).toBe("PIN changed");
    expect(auditEventLabel("wipe")).toBe("All data deleted");
  });
});
