"use client";

import { openDB, type IDBPDatabase } from "idb";
import type { DailyLog, FlowLevel, JournalEntry, MoodId, Settings, SymptomId } from "@/types";
import { decryptText, encryptText, type EncBlob } from "@/lib/crypto";

const STORE_LOGS = "daily-logs";
const STORE_JOURNAL = "journals";
const STORE_SETTINGS = "settings";

interface SchemaEntry {
  keyPath: string;
  indexes?: [string, string][];
  data: string;
}

const SCHEMA: SchemaEntry[] = [
  { keyPath: "date", indexes: [["byDate", "date"]], data: STORE_LOGS },
  { keyPath: "id", indexes: [["byDate", "date"]], data: STORE_JOURNAL },
  { keyPath: "key", data: STORE_SETTINGS },
];

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDB(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB("lantern", 1, {
      upgrade(db) {
        for (const store of SCHEMA) {
          if (!db.objectStoreNames.contains(store.data)) {
            const os = db.createObjectStore(store.data, {
              keyPath: store.keyPath,
            });
            for (const [name, key] of store.indexes ?? []) {
              os.createIndex(name, key);
            }
          }
        }
      },
    });
  }
  return dbPromise;
}

/* ------------------------------------------------------------------ */
/* Encrypted record shapes                                             */
/*                                                                     */
/* Daily logs and journal entries are stored as:                       */
/*   { date, enc: { iv, data } }                                       */
/* where `enc` is an AES-256-GCM blob of the serialized record.        */
/* The `date` keyPath stays in plaintext because IndexedDB keys and    */
/* the byDate index must be queryable. Content never is.               */
/*                                                                     */
/* Records written before encryption are stored with plain fields and  */
/* are read transparently (legacy migration).                          */
/* ------------------------------------------------------------------ */

interface EncLogRecord {
  date: string;
  enc?: EncBlob;
  [k: string]: unknown;
}

interface EncJournalRecord {
  id: string;
  date?: string;
  enc?: EncBlob;
  [k: string]: unknown;
}

async function seal(plain: string, key: CryptoKey | null): Promise<EncBlob | undefined> {
  return key ? await encryptText(key, plain) : undefined;
}

async function openSealed<T>(record: { enc?: EncBlob }, key: CryptoKey | null): Promise<T | null> {
  if (!record.enc) return null;
  if (!key) return null;
  const text = await decryptText(key, record.enc);
  if (text === null) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

/** Build a DailyLog from a pre-encryption plaintext record. */
function legacyDailyLog(r: EncLogRecord): DailyLog {
  return {
    date: String(r.date),
    flow: (typeof r.flow === "string" ? r.flow : "none") as FlowLevel,
    moods: (Array.isArray(r.moods) ? r.moods : []) as MoodId[],
    symptoms: (Array.isArray(r.symptoms) ? r.symptoms : []) as SymptomId[],
    energy: typeof r.energy === "number" ? r.energy : undefined,
    stress: typeof r.stress === "number" ? r.stress : undefined,
    updatedAt: typeof r.updatedAt === "string" ? r.updatedAt : "",
  };
}

/** Build a JournalEntry from a pre-encryption plaintext record. */
function legacyJournal(r: EncJournalRecord): JournalEntry | null {
  if (!r.id) return null;
  return {
    id: String(r.id),
    date: typeof r.date === "string" ? r.date : "",
    text: typeof r.text === "string" ? r.text : "",
    moods: (Array.isArray(r.moods) ? r.moods : []) as MoodId[],
    symptoms: (Array.isArray(r.symptoms) ? r.symptoms : []) as SymptomId[],
    createdAt: typeof r.createdAt === "string" ? r.createdAt : "",
    updatedAt: typeof r.updatedAt === "string" ? r.updatedAt : "",
  };
}

export async function readAllDailyLogs(key: CryptoKey | null = null): Promise<DailyLog[]> {
  const db = await getDB();
  const records = (await db.getAll(STORE_LOGS)) as unknown as EncLogRecord[];
  const out: DailyLog[] = [];
  for (const r of records) {
    const sealed = await openSealed<DailyLog>(r, key);
    if (sealed) {
      out.push({
        date: r.date,
        flow: sealed.flow,
        moods: sealed.moods,
        symptoms: sealed.symptoms,
        energy: sealed.energy,
        stress: sealed.stress,
        updatedAt: sealed.updatedAt,
      });
      continue;
    }
    // Legacy plaintext record (pre-encryption)
    out.push(legacyDailyLog(r));
  }
  return out;
}

export async function writeDailyLog(date: string, value: DailyLog, key: CryptoKey | null = null): Promise<void> {
  const db = await getDB();
  const plain: Omit<DailyLog, "date"> = {
    flow: value.flow,
    moods: value.moods,
    symptoms: value.symptoms,
    energy: value.energy,
    stress: value.stress,
    updatedAt: value.updatedAt,
  };
  const enc = await seal(JSON.stringify(plain), key);
  await db.put(STORE_LOGS, enc ? { date, enc } : { date, ...plain });
}

export async function removeDailyLog(date: string): Promise<void> {
  const db = await getDB();
  await db.delete(STORE_LOGS, date);
}

export async function readAllJournals(key: CryptoKey | null = null): Promise<JournalEntry[]> {
  const db = await getDB();
  const records = (await db.getAll(STORE_JOURNAL)) as unknown as EncJournalRecord[];
  const out: JournalEntry[] = [];
  for (const r of records) {
    const sealed = await openSealed<JournalEntry>(r, key);
    if (sealed) {
      out.push({
        id: r.id,
        date: r.date ?? sealed.date,
        text: sealed.text,
        moods: sealed.moods,
        symptoms: sealed.symptoms,
        createdAt: sealed.createdAt,
        updatedAt: sealed.updatedAt,
      });
      continue;
    }
    const legacy = legacyJournal(r);
    if (legacy) out.push(legacy);
  }
  return out;
}

export async function writeJournal(entry: JournalEntry, key: CryptoKey | null = null): Promise<void> {
  const db = await getDB();
  const { id, ...rest } = entry;
  const enc = await seal(JSON.stringify(rest), key);
  await db.put(STORE_JOURNAL, enc ? { id, date: entry.date, enc } : entry);
}

export async function removeJournal(id: string): Promise<void> {
  const db = await getDB();
  await db.delete(STORE_JOURNAL, id);
}

export async function readSettings(): Promise<Partial<Settings> | undefined> {
  const db = await getDB();
  return (await db.get(STORE_SETTINGS, "user")) as unknown as Partial<Settings> | undefined;
}

export async function writeSettings(settings: Partial<Settings> & { key?: string }): Promise<void> {
  const db = await getDB();
  await db.put(STORE_SETTINGS, { key: "user", ...settings });
}

export async function clearAllData(): Promise<void> {
  const db = await getDB();
  const tx = db.transaction([STORE_LOGS, STORE_JOURNAL, STORE_SETTINGS], "readwrite");
  await Promise.all([
    tx.objectStore(STORE_LOGS).clear(),
    tx.objectStore(STORE_JOURNAL).clear(),
    tx.objectStore(STORE_SETTINGS).clear(),
    tx.done,
  ]);
}

/**
 * Re-encrypt every record from one key to another (or to plaintext).
 * Used when the PIN is changed, set, or removed.
 */
export async function reencryptAll(oldKey: CryptoKey | null, newKey: CryptoKey | null): Promise<void> {
  const logs = await readAllDailyLogs(oldKey);
  const journals = await readAllJournals(oldKey);
  const db = await getDB();
  const tx = db.transaction([STORE_LOGS, STORE_JOURNAL], "readwrite");
  const logsStore = tx.objectStore(STORE_LOGS);
  const journalStore = tx.objectStore(STORE_JOURNAL);

  await logsStore.clear();
  for (const l of logs) {
    const { date, ...rest } = l;
    const enc = await seal(JSON.stringify(rest), newKey);
    await logsStore.put(enc ? { date, enc } : { date, ...rest });
  }

  await journalStore.clear();
  for (const j of journals) {
    const { id, ...rest } = j;
    const enc = await seal(JSON.stringify(rest), newKey);
    await journalStore.put(enc ? { id, date: j.date, enc } : j);
  }

  await tx.done;
}

/** Replace the entire local dataset (used by import & delete). */
export async function importAll(
  data: {
    dailyLogs?: DailyLog[];
    journals?: JournalEntry[];
    settings?: Partial<Settings>;
  },
  key: CryptoKey | null = null,
): Promise<void> {
  const db = await getDB();
  const tx = db.transaction([STORE_LOGS, STORE_JOURNAL, STORE_SETTINGS], "readwrite");
  const logsStore = tx.objectStore(STORE_LOGS);
  const journalStore = tx.objectStore(STORE_JOURNAL);
  const settingsStore = tx.objectStore(STORE_SETTINGS);

  // erase existing
  await Promise.all([logsStore.clear(), journalStore.clear(), settingsStore.clear()]);

  for (const log of data.dailyLogs ?? []) {
    const { date, ...rest } = log;
    const enc = await seal(JSON.stringify(rest), key);
    await logsStore.put(enc ? { date, enc } : { date, ...rest });
  }
  for (const j of data.journals ?? []) {
    const { id, ...rest } = j;
    const enc = await seal(JSON.stringify(rest), key);
    await journalStore.put(enc ? { id, date: j.date, enc } : j);
  }
  if (data.settings) await settingsStore.put({ key: "user", ...data.settings });
  await tx.done;
}
