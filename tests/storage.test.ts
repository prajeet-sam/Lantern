import { describe, expect, it } from "vitest";
import { createDataStore } from "@/lib/storage";
import type { DailyLog, JournalEntry, Settings } from "@/types";

describe("createDataStore", () => {
  it("routes reads and writes through the injected adapter", async () => {
    const saved: Array<{ key: string; value: unknown }> = [];
    const adapter = {
      async readData() {
        return {
          dailyLogs: [{ date: "2024-01-01", flow: "light", moods: [], symptoms: [], updatedAt: "now" } as DailyLog],
          journals: [{ id: "j1", date: "2024-01-01", text: "hi", moods: [], symptoms: [], createdAt: "now", updatedAt: "now" } as JournalEntry],
          settings: { theme: "dark" } as Partial<Settings>,
        };
      },
      async writeLog(date: string, value: DailyLog) {
        saved.push({ key: "writeLog", value: { date, value } });
      },
      async deleteLog(date: string) {
        saved.push({ key: "deleteLog", value: date });
      },
      async writeJournal(entry: JournalEntry) {
        saved.push({ key: "writeJournal", value: entry });
      },
      async deleteJournal(id: string) {
        saved.push({ key: "deleteJournal", value: id });
      },
      async writeSettings(settings: Partial<Settings>) {
        saved.push({ key: "writeSettings", value: settings });
      },
      async replaceData(data: { dailyLogs: DailyLog[]; journals: JournalEntry[]; settings?: Partial<Settings> }) {
        saved.push({ key: "replace", value: data });
      },
      async clear() {
        saved.push({ key: "clear", value: null });
      },
      async reencrypt() {
        saved.push({ key: "reencrypt", value: null });
      },
    };

    const store = createDataStore(adapter);
    const loaded = await store.readAll(null);
    await store.writeLog("2024-01-01", loaded.dailyLogs[0], null);
    await store.writeJournal(loaded.journals[0], null);
    await store.writeSettings({ theme: "light" });
    await store.replaceAll({ dailyLogs: [], journals: [], settings: { theme: "light" } }, null);
    await store.clear();
    await store.reencrypt(null, null);

    expect(loaded.dailyLogs).toHaveLength(1);
    expect(saved.map((item) => item.key)).toEqual(["writeLog", "writeJournal", "writeSettings", "replace", "clear", "reencrypt"]);
  });
});
