/**
 * Sync orchestration: full-snapshot push/pull with last-write-wins merge.
 *
 * The store holds a `Session` (encrypted vault + in-memory data key) and calls
 * these helpers. Design:
 *
 *   - Push: debounced by the caller; re-encrypts the full dataset snapshot
 *     under the in-memory data key and upserts the vault row (rev-guarded).
 *   - Pull: fetches the vault row, decrypts with the in-memory data key.
 *   - Merge: union of logs (by date) and journals (by id), each record
 *     last-write-wins on `updatedAt`; settings from the newer snapshot.
 *   - Conflict: if the remote rev moved, re-pull, re-merge, retry (bounded).
 */

import type { DailyLog, JournalEntry, Settings } from "@/types";
import {
  deleteVault,
  fetchVault,
  getSyncUser,
  resetPasswordWithRecovery,
  rowToVault,
  saveRecoveryCode,
  saveVault,
  signIn,
  signOut,
  signUp,
  type SyncError,
  type SyncResult,
} from "@/lib/sync/client";
import {
  buildSnapshot,
  createSyncVault,
  decryptSnapshot,
  encryptSnapshot,
  generateRecoveryKey,
  mergeSnapshots,
  openWithPassword,
  openWithRecovery,
  parseSnapshot,
  reWrapPassword,
  sha256Hex,
  type SyncVault,
} from "@/lib/sync/vault";
import type { ValidatedExport } from "@/lib/validation";

/** A live, unlocked sync session. Held only in memory, never persisted. */
export interface Session {
  user: { id: string; username: string };
  vault: SyncVault;
  dataKey: Uint8Array<ArrayBuffer>;
}

/** A signed-in account whose vault is still locked (no password yet this session). */
export interface LockedSession {
  user: { id: string; username: string };
  vault: SyncVault;
}

export interface PushResult {
  merged: ValidatedExport;
  settings: Settings;
  rev: number;
}

function err(c: SyncError["code"], message: string): { ok: false; error: SyncError } {
  return { ok: false, error: { code: c, message } };
}

function settingsPartial(s: Settings): Partial<Settings> {
  return {
    typicalCycleLength: s.typicalCycleLength,
    typicalPeriodDuration: s.typicalPeriodDuration,
    regularity: s.regularity,
    firstDayOfWeek: s.firstDayOfWeek,
    notificationPrivacy: s.notificationPrivacy,
  };
}

/** Sign in and unlock an existing vault with the account password. */
export async function openSession(username: string, password: string): Promise<SyncResult<Session>> {
  const auth = await signIn(username, password);
  if (!auth.ok) return auth;
  const row = await fetchVault(auth.data.id);
  if (!row) {
    return err("server", "No sync vault exists for this account yet. Try signing in on the device that created it.");
  }
  const vault = rowToVault(row);
  const opened = await openWithPassword(vault, password);
  if (!opened) {
    return err("invalid", "Wrong password.");
  }
  return { ok: true, data: { user: auth.data, vault, dataKey: opened.dataKey } };
}

/**
 * Create an account and upload the current dataset. Returns the new session
 * plus the one-time recovery key (the caller must show it before discarding).
 */
export async function createSession(
  username: string,
  password: string,
  logs: DailyLog[],
  journals: JournalEntry[],
  settings: Settings,
): Promise<SyncResult<{ session: Session; recoveryKey: string }>> {
  const auth = await signUp(username, password);
  if (!auth.ok) return auth;

  const recoveryKey = generateRecoveryKey();
  const snapshot = buildSnapshot(logs, journals, settings);
  const vault = await createSyncVault(password, recoveryKey, snapshot);

  const saved = await saveVault(vault, auth.data.id, 0);
  if (!saved.ok) return saved;

  const hash = await sha256Hex(recoveryKey);
  const stored = await saveRecoveryCode(hash);
  if (!stored.ok) {
    // Leave no half-created account behind so a retry stays clean.
    await deleteVault(auth.data.id);
    await signOut();
    return stored;
  }

  const opened = await openWithPassword(vault, password);
  if (!opened) return err("server", "Couldn't open the vault after creating it.");
  return { ok: true, data: { session: { user: auth.data, vault, dataKey: opened.dataKey }, recoveryKey } };
}

/**
 * Push the current dataset, always pulling + merging first so another device's
 * edits are never clobbered. If the merged result equals what's already remote,
 * the write is skipped (no rev churn). Bounded retry on rev conflicts.
 */
export async function pushAndMerge(
  session: Session,
  logs: DailyLog[],
  journals: JournalEntry[],
  settings: Settings,
): Promise<SyncResult<PushResult>> {
  let currentLogs = logs;
  let currentJournals = journals;
  let currentSettings = settings;

  for (let attempt = 0; attempt < 3; attempt++) {
    const row = await fetchVault(session.user.id);
    const remote = row ? await decryptSnapshot(session.dataKey, rowToVault(row).blob) : null;
    if (row && !remote) return err("server", "Couldn't decrypt the data from another device.");

    const local = parseSnapshot(buildSnapshot(currentLogs, currentJournals, currentSettings));
    if (!local.ok) return err("server", "Couldn't build a local snapshot.");

    const merged = remote
      ? mergeSnapshots(local.data, local.exportedAt, remote.data, remote.exportedAt)
      : local.data;
    currentLogs = merged.dailyLogs;
    currentJournals = merged.journals;
    currentSettings = { ...currentSettings, ...merged.settings } as Settings;

    // Nothing changed vs. what's already remote → skip the write.
    if (remote && canonical(merged) === canonical(remote.data)) {
      if (row) session.vault = rowToVault(row);
      return {
        ok: true,
        data: {
          merged: { dailyLogs: currentLogs, journals: currentJournals, settings: settingsPartial(currentSettings) },
          settings: currentSettings,
          rev: row?.rev ?? 0,
        },
      };
    }

    const blob = await encryptSnapshot(session.dataKey, buildSnapshot(currentLogs, currentJournals, currentSettings));
    const candidate: SyncVault = { ...(row ? rowToVault(row) : session.vault), blob };
    const expectedRev = row?.rev ?? 0;
    const saved = await saveVault(candidate, session.user.id, expectedRev);
    if (saved.ok) {
      session.vault = { ...candidate, rev: saved.data.rev };
      return {
        ok: true,
        data: {
          merged: { dailyLogs: currentLogs, journals: currentJournals, settings: settingsPartial(currentSettings) },
          settings: currentSettings,
          rev: saved.data.rev,
        },
      };
    }
    if (saved.error.code !== "conflict") return saved;
    // Conflict → loop: re-pull (rev changed), re-merge, retry.
  }
  return err("conflict", "Kept conflicting with another device. Try again in a moment.");
}

function canonical(v: ValidatedExport): string {
  return JSON.stringify({ logs: v.dailyLogs, journals: v.journals, settings: v.settings ?? null });
}

/** Change the account password: re-wrap the data key, push the new envelope. */
export async function changeAccountPassword(session: Session, newPassword: string): Promise<SyncResult<number>> {
  const rewrapped = await reWrapPassword(session.vault, newPassword, session.dataKey);
  const saved = await saveVault(rewrapped, session.user.id, session.vault.rev);
  if (!saved.ok) return saved;
  session.vault = { ...rewrapped, rev: saved.data.rev };
  return { ok: true, data: saved.data.rev };
}

/**
 * Recover a forgotten password: the server resets the password after verifying
 * the recovery key, then the client re-wraps the vault with the new password.
 */
export async function recoverAccount(
  username: string,
  recoveryKey: string,
  newPassword: string,
): Promise<SyncResult<null>> {
  const reset = await resetPasswordWithRecovery(username, recoveryKey, newPassword);
  if (!reset.ok) return reset;

  const auth = await signIn(username, newPassword);
  if (!auth.ok) return auth;
  const row = await fetchVault(auth.data.id);
  if (!row) return err("server", "No sync vault found for this account.");
  const vault = rowToVault(row);
  const opened = await openWithRecovery(vault, recoveryKey);
  if (!opened) return err("invalid", "The recovery key doesn't match this account.");
  const rewrapped = await reWrapPassword(vault, newPassword, opened.dataKey);
  const saved = await saveVault(rewrapped, auth.data.id, vault.rev);
  if (!saved.ok) return saved;
  await signOut();
  return { ok: true, data: null };
}

/** Pull the remote vault and decrypt it with the in-memory data key. */
export async function pullSnapshot(
  session: Session,
): Promise<SyncResult<{ data: ValidatedExport; exportedAt?: string } | null>> {
  const row = await fetchVault(session.user.id);
  if (!row) return { ok: true, data: null };
  const vault = rowToVault(row);
  const opened = await decryptSnapshot(session.dataKey, vault.blob);
  if (!opened) return err("server", "Couldn't decrypt the data from another device.");
  session.vault = vault;
  return { ok: true, data: { data: opened.data, exportedAt: opened.exportedAt } };
}

/** Check on app start whether an account is configured (still needs the password). */
export async function restoreSession(): Promise<SyncResult<LockedSession>> {
  const user = await getSyncUser();
  if (!user) return err("unauthorized", "Not signed in.");
  const row = await fetchVault(user.id);
  if (!row) return err("server", "No sync vault found for this account.");
  return { ok: true, data: { user, vault: rowToVault(row) } };
}
