import { describe, it, expect } from "vitest";
import {
  createSyncVault,
  openWithPassword,
  openWithRecovery,
  reWrapPassword,
  parseSnapshot,
  mergeSnapshots,
  buildSnapshot,
  generateRecoveryKey,
  sha256Hex,
  randomDataKey,
  type SyncVault,
} from "@/lib/sync/vault";
import { bytesToB64 } from "@/lib/crypto";
import type { DailyLog, JournalEntry, Settings } from "@/types";

const ITER = 1_000; // tests use a cheap PBKDF2 round count

const SETTINGS: Settings = {
  typicalCycleLength: 30,
  typicalPeriodDuration: 5,
  regularity: "not_sure",
  theme: "system",
  firstDayOfWeek: 0,
  notifyPeriod: false,
  notifyCheckIn: false,
  notifyFlow: false,
  notificationPrivacy: "private",
  reminderTimeCheckIn: "19:00",
  reminderTimePeriod: "09:00",
  reducedMotion: false,
  highContrast: false,
  onboardingComplete: false,
  autoLockMinutes: null,
  blurOnHide: false,
  customItems: [],
};

function sampleLog(date: string, updatedAt: string, flow: DailyLog["flow"] = "medium"): DailyLog {
  return { date, flow, moods: ["happy"], symptoms: [], energy: 3, stress: 2, updatedAt };
}

function sampleJournal(id: string, date: string, updatedAt: string): JournalEntry {
  return {
    id,
    date,
    text: "entry " + id,
    moods: [],
    symptoms: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt,
  };
}

function makeVault(snapshot: string): Promise<SyncVault> {
  return createSyncVault("correct horse", "RECOVERY-KEY", snapshot, ITER);
}

describe("sync vault (envelope encryption)", () => {
  it("round-trips a snapshot through password open", async () => {
    const snapshot = buildSnapshot([sampleLog("2026-01-05", "2026-01-05T00:00:00Z")], [sampleJournal("j1", "2026-01-05", "2026-01-05T00:00:00Z")], SETTINGS);
    const vault = await makeVault(snapshot);
    const opened = await openWithPassword(vault, "correct horse");
    expect(opened).not.toBeNull();
    expect(opened!.snapshot.dailyLogs).toHaveLength(1);
    expect(opened!.snapshot.journals[0].id).toBe("j1");
    expect(opened!.snapshot.settings?.typicalCycleLength).toBe(30);
    expect(opened!.dataKey.byteLength).toBe(32);
  });

  it("rejects a wrong password", async () => {
    const vault = await makeVault(buildSnapshot([], [], SETTINGS));
    expect(await openWithPassword(vault, "wrong password")).toBeNull();
  });

  it("opens with the recovery key", async () => {
    const vault = await makeVault(buildSnapshot([sampleLog("2026-02-01", "2026-02-01T00:00:00Z")], [], SETTINGS));
    const opened = await openWithRecovery(vault, "RECOVERY-KEY");
    expect(opened?.snapshot.dailyLogs[0].date).toBe("2026-02-01");
  });

  it("rejects a wrong recovery key", async () => {
    const vault = await makeVault(buildSnapshot([], [], SETTINGS));
    expect(await openWithRecovery(vault, "NOPE")).toBeNull();
  });

  it("a vault created without recovery key can't be opened with one", async () => {
    const vault = await createSyncVault("pw", null, buildSnapshot([], [], SETTINGS), ITER);
    expect(await openWithRecovery(vault, "RECOVERY-KEY")).toBeNull();
  });

  it("re-wraps the data key on password change without losing data", async () => {
    const snapshot = buildSnapshot([sampleLog("2026-03-03", "2026-03-03T00:00:00Z")], [], SETTINGS);
    const vault = await makeVault(snapshot);
    const opened = await openWithPassword(vault, "correct horse");
    expect(opened).not.toBeNull();

    const reWrapped = await reWrapPassword(vault, "new password", opened!.dataKey);
    expect(reWrapped.wrapPassword.data).not.toBe(vault.wrapPassword.data);

    // new password opens, old password no longer does
    const fresh = await openWithPassword(reWrapped, "new password");
    expect(fresh?.snapshot.dailyLogs[0].date).toBe("2026-03-03");
    expect(await openWithPassword(reWrapped, "correct horse")).toBeNull();

    // recovery wrap is untouched and still opens the same data
    const viaRecovery = await openWithRecovery(reWrapped, "RECOVERY-KEY");
    expect(viaRecovery?.snapshot.dailyLogs[0].date).toBe("2026-03-03");
  });
});

describe("sync snapshot parsing", () => {
  it("accepts a valid snapshot and keeps exportedAt", () => {
    const json = JSON.stringify({
      exportVersion: "1.0",
      exportedAt: "2026-04-01T00:00:00.000Z",
      appVersion: "1.0.0",
      dailyLogs: [sampleLog("2026-04-01", "2026-04-01T00:00:00Z")],
      journals: [],
      settings: { typicalCycleLength: 27 },
    });
    const parsed = parseSnapshot(json);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.exportedAt).toBe("2026-04-01T00:00:00.000Z");
      expect(parsed.data.settings?.typicalCycleLength).toBe(27);
    }
  });

  it("rejects invalid JSON", () => {
    const parsed = parseSnapshot("not json");
    expect(parsed.ok).toBe(false);
  });

  it("accepts an empty snapshot (brand-new account)", () => {
    const parsed = parseSnapshot(JSON.stringify({ exportVersion: "1.0", dailyLogs: [], journals: [] }));
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.data.dailyLogs).toEqual([]);
      expect(parsed.data.journals).toEqual([]);
    }
  });

  it("sanitizes hostile fields on the way in", () => {
    const json = JSON.stringify({
      exportVersion: "1.0",
      dailyLogs: [
        {
          date: "2026-05-01",
          flow: "nuclear",
          moods: ["not-a-mood"],
          symptoms: [{ hacked: true }],
          energy: "high",
          stress: 999,
        },
      ],
      journals: [],
      settings: { autoLockMinutes: 9999, onboardingComplete: true },
    });
    const parsed = parseSnapshot(json);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.data.dailyLogs[0].flow).toBe("none");
      expect(parsed.data.dailyLogs[0].moods).toEqual([]);
      expect(parsed.data.dailyLogs[0].energy).toBeUndefined();
      expect(parsed.data.dailyLogs[0].stress).toBe(5);
      expect(parsed.data.settings?.autoLockMinutes).toBeUndefined();
    }
  });
});

describe("sync snapshot merge (last-write-wins)", () => {
  it("unions logs across both snapshots, newest per day wins", () => {
    const local = {
      dailyLogs: [
        sampleLog("2026-01-01", "2026-01-01T10:00:00Z", "light"),
        sampleLog("2026-01-02", "2026-01-02T10:00:00Z"),
      ],
      journals: [],
    };
    const remote = {
      dailyLogs: [
        sampleLog("2026-01-01", "2026-01-01T12:00:00Z", "heavy"),
        sampleLog("2026-01-03", "2026-01-03T10:00:00Z"),
      ],
      journals: [],
    };
    const merged = mergeSnapshots(local, undefined, remote, undefined);
    expect(merged.dailyLogs.map((l) => l.date).sort()).toEqual(["2026-01-01", "2026-01-02", "2026-01-03"]);
    expect(merged.dailyLogs.find((l) => l.date === "2026-01-01")?.flow).toBe("heavy");
  });

  it("keeps local when timestamps are equal", () => {
    const local = { dailyLogs: [sampleLog("2026-01-01", "2026-01-01T10:00:00Z", "light")], journals: [] };
    const remote = { dailyLogs: [sampleLog("2026-01-01", "2026-01-01T10:00:00Z", "heavy")], journals: [] };
    const merged = mergeSnapshots(local, undefined, remote, undefined);
    expect(merged.dailyLogs[0].flow).toBe("light");
  });

  it("merges journals by id, newest wins", () => {
    const local = {
      dailyLogs: [],
      journals: [
        sampleJournal("a", "2026-01-01", "2026-01-01T10:00:00Z"),
        sampleJournal("b", "2026-01-02", "2026-01-02T10:00:00Z"),
      ],
    };
    const remote = {
      dailyLogs: [],
      journals: [
        sampleJournal("a", "2026-01-01", "2026-01-01T12:00:00Z"),
        sampleJournal("c", "2026-01-03", "2026-01-03T10:00:00Z"),
      ],
    };
    const merged = mergeSnapshots(local, undefined, remote, undefined);
    const ids = merged.journals.map((j) => j.id).sort();
    expect(ids).toEqual(["a", "b", "c"]);
    expect(merged.journals.find((j) => j.id === "a")?.updatedAt).toBe("2026-01-01T12:00:00Z");
  });

  it("takes settings from the newer snapshot", () => {
    const local = {
      dailyLogs: [],
      journals: [],
      settings: { typicalCycleLength: 28 },
    };
    const remote = {
      dailyLogs: [],
      journals: [],
      settings: { typicalCycleLength: 32 },
    };
    const merged = mergeSnapshots(local, "2026-01-01T00:00:00Z", remote, "2026-01-02T00:00:00Z");
    expect(merged.settings?.typicalCycleLength).toBe(32);
  });
});

describe("sync recovery keys", () => {
  it("generates unique readable keys", () => {
    const a = generateRecoveryKey();
    const b = generateRecoveryKey();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(a.length).toBeGreaterThanOrEqual(40);
  });

  it("hashes stably with SHA-256", async () => {
    const h1 = await sha256Hex("key");
    const h2 = await sha256Hex("key");
    expect(h1).toBe(h2);
    expect(h1).toMatch(/^[0-9a-f]{64}$/);
    expect(await sha256Hex("other")).not.toBe(h1);
  });

  it("produces 32-byte data keys", () => {
    expect(randomDataKey().byteLength).toBe(32);
    expect(bytesToB64(randomDataKey())).toHaveLength(44);
  });
});
