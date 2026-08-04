import { addDays, differenceInCalendarDays, format, parseISO } from "date-fns";

/** Local calendar-day key, 'YYYY-MM-DD'. Represents a day, not an instant. */
export function toKey(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

/** Parse a 'YYYY-MM-DD' key into a local Date at midnight local time. */
export function fromKey(key: string): Date {
  return parseISO(key);
}

export function todayKey(): string {
  return toKey(new Date());
}

export function addDaysKey(key: string, days: number): string {
  return toKey(addDays(fromKey(key), days));
}

export function diffDays(a: string, b: string): number {
  return differenceInCalendarDays(fromKey(a), fromKey(b));
}

export function formatPretty(key: string): string {
  return format(fromKey(key), "MMMM d, yyyy");
}

export function isValidKey(key: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return false;
  return !Number.isNaN(parseISO(key).getTime());
}

export function clampInt(n: number, min: number, max: number): number {
  if (Number.isNaN(n)) return min;
  return Math.max(min, Math.min(max, n));
}