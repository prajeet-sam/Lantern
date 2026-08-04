import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  MAX_FAILURES,
  clearPinFailures,
  formatCooldown,
  isPinLockedOut,
  isValidPin,
  pinCooldownMs,
  recordFailedPin,
} from "@/lib/pin";

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

describe("pin", () => {
  let storage: Storage;

  beforeEach(() => {
    storage = makeStorage();
    (globalThis as { localStorage?: Storage }).localStorage = storage;
  });

  afterEach(() => {
    delete (globalThis as { localStorage?: Storage }).localStorage;
  });

  it("validates 4-digit PINs", () => {
    expect(isValidPin("0000")).toBe(true);
    expect(isValidPin("123")).toBe(false);
    expect(isValidPin("12345")).toBe(false);
    expect(isValidPin("12a4")).toBe(false);
  });

  it("allows attempts until the failure cap is reached", () => {
    for (let i = 0; i < MAX_FAILURES - 1; i++) recordFailedPin();
    expect(isPinLockedOut()).toBe(false);
    expect(pinCooldownMs()).toBe(0);
  });

  it("locks out after the failure cap and clears on success", () => {
    for (let i = 0; i < MAX_FAILURES; i++) recordFailedPin();
    expect(isPinLockedOut()).toBe(true);
    expect(pinCooldownMs()).toBeGreaterThan(0);

    clearPinFailures();
    expect(isPinLockedOut()).toBe(false);
    expect(pinCooldownMs()).toBe(0);
  });

  it("extends the cooldown with each extra failure", () => {
    for (let i = 0; i < MAX_FAILURES; i++) recordFailedPin();
    const first = pinCooldownMs();
    recordFailedPin();
    const second = pinCooldownMs();
    expect(second).toBeGreaterThan(first);
  });

  it("formats cooldowns human-readably", () => {
    expect(formatCooldown(0)).toBe("");
    expect(formatCooldown(45_000)).toBe("45s");
    expect(formatCooldown(90_000)).toBe("1m 30s");
  });
});
