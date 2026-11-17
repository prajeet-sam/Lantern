import { describe, expect, it } from "vitest";
import { createSyncService } from "@/lib/sync/service";
import type { DailyLog, JournalEntry, Settings } from "@/types";

function makeSettings(): Settings {
  return {
    typicalCycleLength: 28,
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
}

describe("createSyncService", () => {
  it("delegates account creation through the service boundary", async () => {
    const calls: string[] = [];
    const service = createSyncService({
      isConfigured: () => true,
      createSession: async () => {
        calls.push("createSession");
        return { ok: true, data: { session: {} as never, recoveryKey: "abc" } };
      },
    });

    const result = await service.createSession("user", "pw", [] as DailyLog[], [] as JournalEntry[], makeSettings());

    expect(result.ok).toBe(true);
    expect(calls).toEqual(["createSession"]);
  });
});
