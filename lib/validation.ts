import type { DailyLog, FlowLevel, JournalEntry, MoodId, Settings, SymptomId } from "@/types";
import { isValidKey } from "@/lib/dates";

export const FLOWS: FlowLevel[] = ["none", "spotting", "light", "medium", "heavy"];
export const MOOD_IDS: MoodId[] = [
  "happy", "calm", "energetic", "low", "irritated", "anxious", "emotional", "tired",
];
export const SYMPTOM_IDS: SymptomId[] = [
  "cramps", "headache", "backache", "bloating", "acne", "breast_tenderness",
  "fatigue", "nausea", "food_cravings", "appetite_changes", "pelvic_discomfort", "other",
];

const REGULARITIES: Settings["regularity"][] = [
  "very_regular", "mostly_regular", "somewhat_irregular", "very_irregular", "not_sure",
];

/* ------------------------------------------------------------------
 * Import limits (H1). Backups come from outside the app, so every value
 * is bounded before it reaches IndexedDB. A crafted or corrupted file
 * can't freeze the tab or bloat the database.
 * ------------------------------------------------------------------ */
export const MAX_IMPORT_BYTES = 8 * 1024 * 1024;
export const MAX_DAILY_LOGS = 60_000;
export const MAX_JOURNALS = 30_000;
export const MAX_TAGS_PER_RECORD = 200;
export const MAX_TEXT_LENGTH = 200_000;
export const MAX_ID_LENGTH = 64;
export const MAX_LABEL_LENGTH = 60;
export const MAX_CUSTOM_ITEMS = 200;

export function isFlow(v: unknown): v is FlowLevel {
  return typeof v === "string" && (FLOWS as string[]).includes(v);
}
export function isMood(v: unknown): v is MoodId {
  return typeof v === "string" && (isBuiltIn(MOOD_IDS, v) || v.startsWith("custom:"));
}
export function isSymptom(v: unknown): v is SymptomId {
  return typeof v === "string" && (isBuiltIn(SYMPTOM_IDS, v) || v.startsWith("custom:"));
}

function isBuiltIn(ids: string[], v: string): boolean {
  return (ids as string[]).includes(v);
}

function clampNum(v: unknown, lo: number, hi: number): number | undefined {
  if (typeof v !== "number" || !Number.isFinite(v)) return undefined;
  return Math.max(lo, Math.min(hi, v));
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) : s;
}

function str(v: unknown, max = MAX_TEXT_LENGTH): string | undefined {
  return typeof v === "string" ? truncate(v, max) : undefined;
}

/** Collect up to MAX_TAGS_PER_RECORD valid tags from an unknown value. */
function take<T>(v: unknown, pred: (x: unknown) => x is T): T[] {
  if (!Array.isArray(v)) return [];
  const out: T[] = [];
  for (const x of v) {
    if (out.length >= MAX_TAGS_PER_RECORD) break;
    if (pred(x)) out.push(x);
  }
  return out;
}

/** Return a sanitized DailyLog, or null if the object is not a valid log. */
export function sanitizeDailyLog(raw: unknown): DailyLog | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const date = String(r.date ?? "");
  if (!isValidKey(date)) return null;
  return {
    date,
    flow: isFlow(r.flow) ? r.flow : "none",
    moods: take(r.moods, isMood),
    symptoms: take(r.symptoms, isSymptom),
    energy: clampNum(r.energy, 1, 5),
    stress: clampNum(r.stress, 1, 5),
    updatedAt: str(r.updatedAt) ?? new Date().toISOString(),
  };
}

/** Return a sanitized JournalEntry, or null if invalid. */
export function sanitizeJournal(raw: unknown): JournalEntry | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const date = String(r.date ?? "");
  const id = typeof r.id === "string" ? truncate(r.id, MAX_ID_LENGTH) : "";
  if (!isValidKey(date) || !id) return null;
  return {
    id,
    date,
    text: str(r.text) ?? "",
    moods: take(r.moods, isMood),
    symptoms: take(r.symptoms, isSymptom),
    createdAt: str(r.createdAt) ?? new Date().toISOString(),
    updatedAt: str(r.updatedAt) ?? new Date().toISOString(),
  };
}

/**
 * Settings sanitizer. Only fields that `buildBackup` actually exports are
 * accepted, so a malicious or stale backup can't flip internal state
 * (PIN presence, auto-lock, blur-on-hide, onboarding) to something the
 * device isn't really in (M1).
 */
export function sanitizeSettings(raw: unknown): Partial<Settings> | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const out: Partial<Settings> = {};
  if (typeof r.typicalCycleLength === "number") out.typicalCycleLength = clampNum(r.typicalCycleLength, 21, 45);
  if (typeof r.typicalPeriodDuration === "number") out.typicalPeriodDuration = clampNum(r.typicalPeriodDuration, 2, 10);
  if (typeof r.regularity === "string" && (REGULARITIES as string[]).includes(r.regularity)) {
    out.regularity = r.regularity as Settings["regularity"];
  }
  if (typeof r.firstDayOfWeek === "number") out.firstDayOfWeek = clampNum(r.firstDayOfWeek, 0, 6);
  if (r.notificationPrivacy === "private" || r.notificationPrivacy === "detailed") {
    out.notificationPrivacy = r.notificationPrivacy;
  }
  return out;
}

export interface ValidatedExport {
  dailyLogs: DailyLog[];
  journals: JournalEntry[];
  settings?: Partial<Settings>;
}

/** Validate an exported JSON string. Never throws. Returns an error message on failure. */
export function parseExport(json: string): { ok: true; data: ValidatedExport } | { ok: false; error: string } {
  if (json.length > MAX_IMPORT_BYTES) {
    return { ok: false, error: "That backup is too large to import safely." };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { ok: false, error: "That file isn't valid JSON." };
  }
  if (!parsed || typeof parsed !== "object") {
    return { ok: false, error: "The backup doesn't look like a valid JSON export." };
  }
  const p = parsed as Record<string, unknown>;
  const dailyLogsRaw = Array.isArray(p.dailyLogs) ? p.dailyLogs : null;
  const journalsRaw = Array.isArray(p.journals) ? p.journals : null;
  if (!dailyLogsRaw && !journalsRaw) {
    return { ok: false, error: "The backup doesn't contain logs or journal entries." };
  }
  if (dailyLogsRaw && dailyLogsRaw.length > MAX_DAILY_LOGS) {
    return { ok: false, error: `This backup has more than ${MAX_DAILY_LOGS.toLocaleString()} days of logs. Please use a smaller backup.` };
  }
  if (journalsRaw && journalsRaw.length > MAX_JOURNALS) {
    return { ok: false, error: `This backup has more than ${MAX_JOURNALS.toLocaleString()} journal entries. Please use a smaller backup.` };
  }

  const dailyLogs: DailyLog[] = [];
  const seenDates = new Set<string>();
  for (const item of dailyLogsRaw ?? []) {
    const log = sanitizeDailyLog(item);
    if (log && !seenDates.has(log.date)) {
      seenDates.add(log.date);
      dailyLogs.push(log);
    }
  }

  const journals: JournalEntry[] = [];
  const seenIds = new Set<string>();
  for (const item of journalsRaw ?? []) {
    const j = sanitizeJournal(item);
    if (j && !seenIds.has(j.id)) {
      seenIds.add(j.id);
      journals.push(j);
    }
  }

  const settings = sanitizeSettings(p.settings);
  return { ok: true, data: { dailyLogs, journals, settings: settings ?? undefined } };
}
