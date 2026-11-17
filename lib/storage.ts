import type { DailyLog, JournalEntry, Settings } from "@/types";

export interface PersistedSnapshot {
  dailyLogs: DailyLog[];
  journals: JournalEntry[];
  settings?: Partial<Settings>;
}

export interface DataStoreAdapter {
  readData(key: CryptoKey | null): Promise<PersistedSnapshot>;
  writeLog(date: string, value: DailyLog, key: CryptoKey | null): Promise<void>;
  deleteLog(date: string): Promise<void>;
  writeJournal(entry: JournalEntry, key: CryptoKey | null): Promise<void>;
  deleteJournal(id: string): Promise<void>;
  writeSettings(settings: Partial<Settings>): Promise<void>;
  replaceData(data: PersistedSnapshot, key: CryptoKey | null): Promise<void>;
  clear(): Promise<void>;
  reencrypt(oldKey: CryptoKey | null, newKey: CryptoKey | null): Promise<void>;
}

export interface DataStore {
  readAll(key: CryptoKey | null): Promise<PersistedSnapshot>;
  writeLog(date: string, value: DailyLog, key: CryptoKey | null): Promise<void>;
  deleteLog(date: string): Promise<void>;
  writeJournal(entry: JournalEntry, key: CryptoKey | null): Promise<void>;
  deleteJournal(id: string): Promise<void>;
  writeSettings(settings: Partial<Settings>): Promise<void>;
  replaceAll(data: PersistedSnapshot, key: CryptoKey | null): Promise<void>;
  clear(): Promise<void>;
  reencrypt(oldKey: CryptoKey | null, newKey: CryptoKey | null): Promise<void>;
}

export function createDataStore(adapter: DataStoreAdapter): DataStore {
  return {
    async readAll(key) {
      return adapter.readData(key);
    },
    async writeLog(date, value, key) {
      return adapter.writeLog(date, value, key);
    },
    async deleteLog(date) {
      return adapter.deleteLog(date);
    },
    async writeJournal(entry, key) {
      return adapter.writeJournal(entry, key);
    },
    async deleteJournal(id) {
      return adapter.deleteJournal(id);
    },
    async writeSettings(settings) {
      return adapter.writeSettings(settings);
    },
    async replaceAll(data, key) {
      return adapter.replaceData(data, key);
    },
    async clear() {
      return adapter.clear();
    },
    async reencrypt(oldKey, newKey) {
      return adapter.reencrypt(oldKey, newKey);
    },
  };
}
