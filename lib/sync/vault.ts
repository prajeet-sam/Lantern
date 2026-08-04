/**
 * Encrypted sync vault (envelope encryption).
 *
 * The dataset snapshot is encrypted with a random 256-bit data key (DEK).
 * The DEK is wrapped ("enveloped") under two key-encryption keys (KEKs):
 *   - the password-derived key (PBKDF2, 200k), and
 *   - the recovery-key-derived key (PBKDF2, 200k).
 *
 * Consequences:
 *   - The server stores only salts, ciphertext, and wraps — never plaintext.
 *   - Changing the password re-wraps the DEK instantly (no data re-encryption).
 *   - Losing the password is not data loss: the recovery key unwraps the DEK.
 *
 * This module is pure (no localStorage/network) and unit-testable in Node.
 */

import type { DailyLog, JournalEntry, Settings } from "@/types";
import {
  b64ToBytes,
  bytesToB64,
  deriveKey,
  encryptText,
  decryptText,
  randomBytes,
  KDF_ITERATIONS,
  type EncBlob,
} from "@/lib/crypto";
import { buildBackup, type BackupJson } from "@/lib/export";
import { parseExport, type ValidatedExport } from "@/lib/validation";

export type SyncWrap = EncBlob;

export interface SyncVault {
  salt: string; // base64 — PBKDF2 salt for the password KEK
  iterations: number;
  wrapPassword: SyncWrap; // encryptText(passwordKek, dataKey)
  recoverySalt?: string; // base64 — PBKDF2 salt for the recovery KEK
  wrapRecovery?: SyncWrap; // encryptText(recoveryKek, dataKey)
  blob: SyncWrap; // encryptText(dataKey, snapshot JSON)
  rev: number;
}

export interface OpenResult {
  snapshot: ValidatedExport;
  exportedAt?: string;
  dataKey: Uint8Array<ArrayBuffer>;
}

export interface SnapshotMeta {
  exportedAt?: string;
}

/** A snapshot plus the metadata needed for settings last-write-wins. */
export interface ParsedSnapshot {
  data: ValidatedExport;
  exportedAt?: string;
}

/** Generate a fresh 32-byte data key (base64). */
export function randomDataKey(): Uint8Array<ArrayBuffer> {
  return randomBytes(32);
}

function keyFromBytes(bytes: Uint8Array<ArrayBuffer>, usages: KeyUsage[] = ["encrypt", "decrypt"]): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", bytes, "AES-GCM", false, usages);
}

async function wrapDataKey(dataKey: Uint8Array<ArrayBuffer>, kek: CryptoKey): Promise<SyncWrap> {
  return encryptText(kek, bytesToB64(dataKey));
}

async function unwrapDataKey(wrap: SyncWrap, kek: CryptoKey): Promise<Uint8Array<ArrayBuffer> | null> {
  const b64 = await decryptText(kek, wrap);
  if (!b64) return null;
  try {
    return b64ToBytes(b64);
  } catch {
    return null;
  }
}

/**
 * Create a new sync vault for a brand-new account. `snapshot` is the current
 * full dataset as JSON. If `recoveryKey` is provided it is wrapped too.
 */
export async function createSyncVault(
  password: string,
  recoveryKey: string | null,
  snapshot: string,
  iterations: number = KDF_ITERATIONS,
): Promise<SyncVault> {
  const salt = randomBytes(16);
  const passwordKek = await deriveKey(password, salt, iterations);
  const dataKey = randomDataKey();
  const dataKek = await keyFromBytes(dataKey);

  const vault: SyncVault = {
    salt: bytesToB64(salt),
    iterations,
    wrapPassword: await wrapDataKey(dataKey, passwordKek),
    blob: await encryptText(dataKek, snapshot),
    rev: 0,
  };

  if (recoveryKey) {
    const recoverySalt = randomBytes(16);
    const recoveryKek = await deriveKey(recoveryKey, recoverySalt, iterations);
    vault.recoverySalt = bytesToB64(recoverySalt);
    vault.wrapRecovery = await wrapDataKey(dataKey, recoveryKek);
  }

  return vault;
}

/** Open the vault with the account password. Returns null on wrong password. */
export async function openWithPassword(vault: SyncVault, password: string): Promise<OpenResult | null> {
  const kek = await deriveKey(password, b64ToBytes(vault.salt), vault.iterations);
  return openWithWrap(vault, vault.wrapPassword, kek);
}

/** Open the vault with the recovery key. Returns null on a wrong key. */
export async function openWithRecovery(vault: SyncVault, recoveryKey: string): Promise<OpenResult | null> {
  if (!vault.recoverySalt || !vault.wrapRecovery) return null;
  const kek = await deriveKey(recoveryKey, b64ToBytes(vault.recoverySalt), vault.iterations);
  return openWithWrap(vault, vault.wrapRecovery, kek);
}

async function openWithWrap(vault: SyncVault, wrap: SyncWrap, kek: CryptoKey): Promise<OpenResult | null> {
  const dataKey = await unwrapDataKey(wrap, kek);
  if (!dataKey) return null;
  const dataKek = await keyFromBytes(dataKey);
  const text = await decryptText(dataKek, vault.blob);
  if (!text) return null;
  const parsed = parseSnapshot(text);
  if (!parsed.ok) return null;
  return { snapshot: parsed.data, exportedAt: parsed.exportedAt, dataKey };
}

/**
 * Re-wrap the data key under a new password (password change). Cheap — the
 * dataset itself is not re-encrypted. Returns a fresh vault record.
 */
export async function reWrapPassword(vault: SyncVault, newPassword: string, dataKey: Uint8Array<ArrayBuffer>, iterations: number = vault.iterations): Promise<SyncVault> {
  const salt = randomBytes(16);
  const kek = await deriveKey(newPassword, salt, iterations);
  return {
    ...vault,
    salt: bytesToB64(salt),
    iterations,
    wrapPassword: await wrapDataKey(dataKey, kek),
  };
}

/** Validate + sanitize a decrypted snapshot string (never throws). */
export function parseSnapshot(json: string): { ok: true; data: ValidatedExport; exportedAt?: string } | { ok: false; error: string } {
  const parsed = parseExport(json);
  if (!parsed.ok) return parsed;
  let exportedAt: string | undefined;
  try {
    const raw = JSON.parse(json) as BackupJson;
    if (typeof raw.exportedAt === "string") exportedAt = raw.exportedAt;
  } catch {
    /* parseExport already rejected invalid JSON */
  }
  return { ok: true, data: parsed.data, exportedAt };
}

/** Serialize a store snapshot to JSON (a Lantern backup). */
export function buildSnapshot(
  dailyLogs: DailyLog[],
  journals: JournalEntry[],
  settings: Settings,
): string {
  return JSON.stringify(buildBackup(dailyLogs, journals, settings));
}

/** Encrypt a snapshot with the in-memory data key (no password re-derivation). */
export async function encryptSnapshot(dataKey: Uint8Array<ArrayBuffer>, snapshot: string): Promise<SyncWrap> {
  const kek = await keyFromBytes(dataKey);
  return encryptText(kek, snapshot);
}

/** Decrypt the current blob with the in-memory data key. */
export async function decryptSnapshot(dataKey: Uint8Array<ArrayBuffer>, blob: SyncWrap): Promise<ParsedSnapshot | null> {
  const kek = await keyFromBytes(dataKey);
  const text = await decryptText(kek, blob);
  if (!text) return null;
  const parsed = parseSnapshot(text);
  return parsed.ok ? { data: parsed.data, exportedAt: parsed.exportedAt } : null;
}

/** Merge two snapshots: union of logs/journals, last-write-wins by updatedAt. */
export function mergeSnapshots(
  local: ValidatedExport,
  localExportedAt: string | undefined,
  remote: ValidatedExport,
  remoteExportedAt: string | undefined,
): ValidatedExport {
  const logs = new Map<string, DailyLog>();
  for (const l of [...local.dailyLogs, ...remote.dailyLogs]) {
    const existing = logs.get(l.date);
    if (!existing || (l.updatedAt && l.updatedAt > existing.updatedAt)) logs.set(l.date, l);
  }

  const journals = new Map<string, JournalEntry>();
  for (const j of [...local.journals, ...remote.journals]) {
    const existing = journals.get(j.id);
    if (!existing || (j.updatedAt && j.updatedAt > existing.updatedAt)) journals.set(j.id, j);
  }

  const settings = pickSettings(localExportedAt, local.settings, remoteExportedAt, remote.settings);

  return {
    dailyLogs: [...logs.values()].sort((a, b) => a.date.localeCompare(b.date)),
    journals: [...journals.values()].sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt)),
    settings,
  };
}

function pickSettings(
  localAt: string | undefined,
  localSettings: Partial<Settings> | undefined,
  remoteAt: string | undefined,
  remoteSettings: Partial<Settings> | undefined,
): Partial<Settings> | undefined {
  if (!remoteSettings) return localSettings;
  if (!localSettings) return remoteSettings;
  // A missing timestamp is treated as older than any explicit timestamp.
  const l = localAt ?? "";
  const r = remoteAt ?? "";
  return r > l ? remoteSettings : localSettings;
}

/** Generate a 32-byte recovery key as readable base64url (no padding). */
export function generateRecoveryKey(): string {
  return bytesToB64(randomBytes(32)).replace(/=+$/g, "").replace(/\//g, "_").replace(/\+/g, "-");
}

/** SHA-256 of the recovery key, hex — the only form the server stores. */
export async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}
