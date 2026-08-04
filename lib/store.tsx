"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { CustomItem, DailyLog, FlowLevel, JournalEntry, Settings } from "@/types";
import {
  clearAllData,
  importAll,
  readAllDailyLogs,
  readAllJournals,
  readSettings,
  removeDailyLog,
  removeJournal,
  reencryptAll,
  writeDailyLog,
  writeJournal,
  writeSettings,
} from "@/lib/repository";
import { clearVault, createVault, getActiveKey, hasVault, lockVault, unlockVault } from "@/lib/vault";
import { todayKey } from "@/lib/dates";
import { uid } from "@/lib/uid";
import { customSlug } from "@/lib/constants";
import { logAudit } from "@/lib/audit";
import { deleteAccountRequest, deleteVault, isSyncConfigured, signOut as signOutRemote } from "@/lib/sync/client";
import {
  changeAccountPassword,
  createSession,
  openSession,
  pushAndMerge,
  recoverAccount,
  restoreSession,
  type Session,
} from "@/lib/sync/scheduler";
import { validatePassword, validateUsername } from "@/lib/sync/username";
import type { ValidatedExport } from "@/lib/validation";

export const DEFAULT_SETTINGS: Settings = {
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

export interface StoreValue {
  ready: boolean;
  locked: boolean;
  settings: Settings;
  logs: DailyLog[];
  journals: JournalEntry[];
  sync: SyncAccountState;
  setSettings: (patch: Partial<Settings>) => Promise<void>;
  upsertLog: (date: string, patch: Partial<DailyLog>) => Promise<void>;
  deleteLog: (date: string) => Promise<void>;
  setFlowToday: (date: string, flow: FlowLevel) => Promise<void>;
  saveJournal: (entry: Partial<JournalEntry>) => Promise<void>;
  deleteJournal: (id: string) => Promise<void>;
  wipeAll: () => Promise<void>;
  importBackup: (data: { dailyLogs: DailyLog[]; journals: JournalEntry[]; settings?: Partial<Settings> }) => Promise<void>;
  getLog: (date: string) => DailyLog | undefined;
  addCustomItem: (item: Omit<CustomItem, "id" | "createdAt">) => Promise<CustomItem | null>;
  removeCustomItem: (id: string) => Promise<void>;
  unlock: (pin: string) => Promise<boolean>;
  lock: () => void;
  enablePin: (pin: string) => Promise<boolean>;
  changePin: (oldPin: string, newPin: string) => Promise<boolean>;
  disablePin: (pin: string) => Promise<boolean>;
  signUpSync: (username: string, password: string) => Promise<{ ok: boolean; recoveryKey?: string; error?: string }>;
  signInSync: (username: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  signOutSync: () => Promise<void>;
  syncNow: () => Promise<{ ok: boolean; error?: string }>;
  changeSyncPassword: (newPassword: string) => Promise<{ ok: boolean; error?: string }>;
  recoverSync: (username: string, recoveryKey: string, newPassword: string) => Promise<{ ok: boolean; error?: string }>;
  deleteAccount: (password: string) => Promise<{ ok: boolean; error?: string }>;
}

export type SyncStatus = "off" | "signed_out" | "locked" | "syncing" | "unlocked" | "error";

export interface SyncAccountState {
  status: SyncStatus;
  username?: string;
  lastSyncedAt?: string;
  lastError?: string;
}

const Ctx = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [locked, setLocked] = useState(false);
  const [settings, setSettingsState] = useState<Settings>(DEFAULT_SETTINGS);
  const [logs, setLogs] = useState<DailyLog[]>([]);
  const [journals, setJournals] = useState<JournalEntry[]>([]);
  const [sync, setSync] = useState<SyncAccountState>({ status: isSyncConfigured() ? "signed_out" : "off" });
  const logsRef = useRef<DailyLog[]>([]);
  const journalsRef = useRef<JournalEntry[]>([]);
  const settingsRef = useRef<Settings>(DEFAULT_SETTINGS);
  const sessionRef = useRef<Session | null>(null);
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const syncingRef = useRef(false);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    logsRef.current = logs;
  }, [logs]);

  useEffect(() => {
    journalsRef.current = journals;
  }, [journals]);

  /** Persist a merged dataset to IndexedDB + memory. Does not schedule a push. */
  const persistMerged = useCallback(async (merged: ValidatedExport) => {
    await importAll(
      { dailyLogs: merged.dailyLogs, journals: merged.journals, settings: merged.settings },
      getActiveKey(),
    );
    const sorted = merged.dailyLogs.slice().sort((a, b) => a.date.localeCompare(b.date));
    logsRef.current = sorted;
    setLogs(sorted);
    journalsRef.current = merged.journals;
    setJournals(merged.journals);
    if (merged.settings) {
      setSettingsState((prev) => ({ ...prev, ...merged.settings }));
    }
  }, []);

  const runSync = useCallback(async () => {
    const session = sessionRef.current;
    if (!session || syncingRef.current) return;
    syncingRef.current = true;
    try {
      setSync((prev) => ({ ...prev, status: "syncing" }));
      const res = await pushAndMerge(session, logsRef.current, journalsRef.current, settingsRef.current);
      if (!res.ok) {
        setSync((prev) => ({ ...prev, status: "error", lastError: res.error.message }));
        logAudit("sync_error");
        return;
      }
      await persistMerged(res.data.merged);
      setSync((prev) => ({ ...prev, status: "unlocked", lastSyncedAt: new Date().toISOString(), lastError: undefined }));
    } finally {
      syncingRef.current = false;
    }
  }, [persistMerged]);

  /** Debounced best-effort flush of the current dataset to the vault. */
  const schedulePush = useCallback(() => {
    if (!sessionRef.current) return;
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    syncTimerRef.current = setTimeout(() => void runSync(), 5000);
  }, [runSync]);

  /** Load the decrypted dataset into memory. Uses the active key. */
  const loadDecrypted = useCallback(async () => {
    const key = getActiveKey();
    const [rawLogs, rawJournals] = await Promise.all([readAllDailyLogs(key), readAllJournals(key)]);
    const sorted = rawLogs.slice().sort((a, b) => a.date.localeCompare(b.date));
    logsRef.current = sorted;
    setLogs(sorted);
    setJournals(rawJournals);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const [rawSettings] = await Promise.all([readSettings()]);
        if (rawSettings) {
          // Strip the legacy djb2 PIN marker (M2); PIN presence now comes from
          // the vault itself, so nothing needs migrating here.
          setSettingsState((prev) => {
            const merged = { ...prev, ...rawSettings } as Settings & { privacyLockPin?: unknown };
            delete merged.privacyLockPin;
            return merged;
          });
        }
        if (hasVault()) {
          // Data is encrypted; wait for unlock before loading it.
          setLocked(true);
        } else {
          await loadDecrypted();
        }
      } catch {
        // keep defaults on storage failure
      } finally {
        logAudit("app_launch");
        setReady(true);
      }
    })();
  }, [loadDecrypted]);

  const setSettings = useCallback(async (patch: Partial<Settings>) => {
    setSettingsState((prev) => {
      const next = { ...prev, ...patch } as Settings;
      void writeSettings(next);
      return next;
    });
    schedulePush();
  }, [schedulePush]);

  const upsertLog = useCallback(
    async (date: string, patch: Partial<DailyLog>) => {
      const prev = logsRef.current.find((l) => l.date === date);
      const next: DailyLog = {
        date,
        flow: patch.flow ?? prev?.flow ?? "none",
        moods: patch.moods ?? prev?.moods ?? [],
        symptoms: patch.symptoms ?? prev?.symptoms ?? [],
        energy: patch.energy ?? prev?.energy,
        stress: patch.stress ?? prev?.stress,
        updatedAt: new Date().toISOString(),
      };
      const fresh = [...logsRef.current.filter((l) => l.date !== date), next].sort(
        (a, b) => a.date.localeCompare(b.date),
      );
      logsRef.current = fresh;
      setLogs(fresh);
      await writeDailyLog(date, next, getActiveKey());
      schedulePush();
    },
    [schedulePush],
  );

  const deleteLog = useCallback(async (date: string) => {
    const fresh = logsRef.current.filter((l) => l.date !== date);
    logsRef.current = fresh;
    setLogs(fresh);
    await removeDailyLog(date);
    schedulePush();
  }, [schedulePush]);

  const setFlowToday = useCallback(
    async (date: string, flow: FlowLevel) => {
      await upsertLog(date, { flow });
    },
    [upsertLog],
  );

  const saveJournal = useCallback(
    async (entry: Partial<JournalEntry>) => {
      const next: JournalEntry = {
        id: entry.id ?? uid(),
        date: entry.date ?? todayKey(),
        text: entry.text ?? "",
        moods: entry.moods ?? [],
        symptoms: entry.symptoms ?? [],
        createdAt: entry.createdAt ?? new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setJournals((cur) =>
        [...cur.filter((j) => j.id !== next.id), next].sort((a, b) =>
          a.date.localeCompare(b.date),
        ),
      );
      await writeJournal(next, getActiveKey());
      schedulePush();
    },
    [schedulePush],
  );

  const deleteJournal = useCallback(async (id: string) => {
    setJournals((cur) => cur.filter((j) => j.id !== id));
    await removeJournal(id);
    schedulePush();
  }, [schedulePush]);

  const wipeAll = useCallback(async () => {
    await clearAllData();
    clearVault();
    logsRef.current = [];
    setLogs([]);
    setJournals([]);
    setSettingsState(DEFAULT_SETTINGS);
    setLocked(false);
    // If a sync account exists, remove the cloud copy too so the wipe sticks.
    const session = sessionRef.current;
    if (session) {
      await deleteVault(session.user.id);
      await signOutRemote();
      sessionRef.current = null;
      setSync({ status: "signed_out" });
    }
    logAudit("wipe");
  }, []);

  const getLog = useCallback(
    (date: string) => logsRef.current.find((l) => l.date === date),
    [],
  );

  const addCustomItem = useCallback(
    async (item: Omit<CustomItem, "id" | "createdAt">) => {
      const slug = customSlug(item.label);
      if (!slug) return null;
      const id = `${slug}-${Date.now().toString(36).slice(-4)}` as `custom:${string}`;
      const newItem: CustomItem = {
        id,
        label: item.label,
        emoji: item.emoji,
        type: item.type,
        createdAt: new Date().toISOString(),
      };
      setSettingsState((prev) => {
        const next = {
          ...prev,
          customItems: [...(prev.customItems ?? []), newItem],
        } as Settings;
        void writeSettings(next);
        return next;
      });
      schedulePush();
      return newItem;
    },
    [schedulePush],
  );

  const removeCustomItem = useCallback(async (id: string) => {
    setSettingsState((prev) => {
      const next = {
        ...prev,
        customItems: (prev.customItems ?? []).filter((c) => c.id !== id),
      } as Settings;
      void writeSettings(next);
      return next;
    });
    schedulePush();
  }, [schedulePush]);

  const importBackup = useCallback(
    async (data: { dailyLogs: DailyLog[]; journals: JournalEntry[]; settings?: Partial<Settings> }) => {
      await importAll(
        {
          dailyLogs: data.dailyLogs,
          journals: data.journals,
          settings: data.settings,
        },
        getActiveKey(),
      );
      const sorted = data.dailyLogs.slice().sort((a, b) => a.date.localeCompare(b.date));
      logsRef.current = sorted;
      setLogs(sorted);
      setJournals(data.journals);
      if (data.settings) setSettingsState((prev) => ({ ...prev, ...data.settings }));
      logAudit("import");
      schedulePush();
    },
    [schedulePush],
  );

  /* ------------------------- Vault operations ------------------------- */

  const unlock = useCallback(
    async (pin: string): Promise<boolean> => {
      const key = await unlockVault(pin);
      if (!key) {
        logAudit("unlock_failed");
        return false;
      }
      await loadDecrypted();
      setLocked(false);
      logAudit("unlock");
      return true;
    },
    [loadDecrypted],
  );

  const lock = useCallback(() => {
    lockVault();
    logsRef.current = [];
    setLogs([]);
    setJournals([]);
    setLocked(true);
    logAudit("lock");
  }, []);

  /** Set a PIN for the first time: create vault + encrypt all existing data. */
  const enablePin = useCallback(async (pin: string): Promise<boolean> => {
    const oldKey = getActiveKey(); // null → plaintext
    const newKey = await createVault(pin);
    if (!newKey) return false;
    await reencryptAll(oldKey, newKey);
    logAudit("pin_set");
    return true;
  }, []);

  /** Change the PIN: verify old, re-encrypt everything with the new key. */
  const changePin = useCallback(async (oldPin: string, newPin: string): Promise<boolean> => {
    const oldKey = await unlockVault(oldPin);
    if (!oldKey) return false;
    const newKey = await createVault(newPin);
    if (!newKey) return false;
    await reencryptAll(oldKey, newKey);
    logAudit("pin_changed");
    return true;
  }, []);

  /** Remove the PIN: verify, drop the vault, write data back to plaintext. */
  const disablePin = useCallback(async (pin: string): Promise<boolean> => {
    const oldKey = await unlockVault(pin);
    if (!oldKey) return false;
    await reencryptAll(oldKey, null);
    clearVault();
    logAudit("pin_disabled");
    return true;
  }, []);

  /* --------------------------- Sync operations --------------------------- */

  const signUpSync = useCallback(
    async (username: string, password: string): Promise<{ ok: boolean; recoveryKey?: string; error?: string }> => {
      const u = validateUsername(username);
      if (!u.ok) return { ok: false, error: u.error };
      const p = validatePassword(password);
      if (!p.ok) return { ok: false, error: p.error };
      const res = await createSession(username, password, logsRef.current, journalsRef.current, settingsRef.current);
      if (!res.ok) return { ok: false, error: res.error.message };
      sessionRef.current = res.data.session;
      setSync({ status: "unlocked", username, lastSyncedAt: new Date().toISOString() });
      logAudit("sync_signup");
      return { ok: true, recoveryKey: res.data.recoveryKey };
    },
    [],
  );

  const signInSync = useCallback(
    async (username: string, password: string): Promise<{ ok: boolean; error?: string }> => {
      const res = await openSession(username, password);
      if (!res.ok) return { ok: false, error: res.error.message };
      sessionRef.current = res.data;
      setSync((prev) => ({ ...prev, status: "syncing", username }));
      const syncRes = await pushAndMerge(res.data, logsRef.current, journalsRef.current, settingsRef.current);
      if (!syncRes.ok) {
        sessionRef.current = null;
        setSync((prev) => ({ ...prev, status: "error", lastError: syncRes.error.message }));
        logAudit("sync_error");
        return { ok: false, error: syncRes.error.message };
      }
      await persistMerged(syncRes.data.merged);
      setSync({ status: "unlocked", username, lastSyncedAt: new Date().toISOString() });
      logAudit("sync_signin");
      return { ok: true };
    },
    [persistMerged],
  );

  const signOutSync = useCallback(async () => {
    await signOutRemote();
    sessionRef.current = null;
    setSync((prev) => ({ ...prev, status: "signed_out", lastSyncedAt: undefined, lastError: undefined }));
    logAudit("sync_signout");
  }, []);

  const syncNow = useCallback(async (): Promise<{ ok: boolean; error?: string }> => {
    if (!sessionRef.current) return { ok: false, error: "Not signed in." };
    await runSync();
    return { ok: true };
  }, [runSync]);

  const changeSyncPassword = useCallback(
    async (newPassword: string): Promise<{ ok: boolean; error?: string }> => {
      const session = sessionRef.current;
      if (!session) return { ok: false, error: "Not signed in." };
      const p = validatePassword(newPassword);
      if (!p.ok) return { ok: false, error: p.error };
      const res = await changeAccountPassword(session, newPassword);
      if (!res.ok) return { ok: false, error: res.error.message };
      setSync((prev) => ({ ...prev, lastSyncedAt: new Date().toISOString() }));
      logAudit("sync_password");
      return { ok: true };
    },
    [],
  );

  const recoverSync = useCallback(
    async (username: string, recoveryKey: string, newPassword: string): Promise<{ ok: boolean; error?: string }> => {
      const p = validatePassword(newPassword);
      if (!p.ok) return { ok: false, error: p.error };
      const res = await recoverAccount(username, recoveryKey, newPassword);
      if (!res.ok) return { ok: false, error: res.error.message };
      sessionRef.current = null;
      setSync({ status: "signed_out" });
      logAudit("sync_recovery");
      return { ok: true };
    },
    [],
  );

  const deleteAccount = useCallback(
    async (password: string): Promise<{ ok: boolean; error?: string }> => {
      const username = sync.username;
      if (!username) return { ok: false, error: "No account to delete." };
      const verify = await openSession(username, password);
      if (!verify.ok) return { ok: false, error: "Wrong password." };
      const res = await deleteAccountRequest();
      if (!res.ok) return { ok: false, error: res.error.message };
      sessionRef.current = null;
      setSync({ status: "signed_out" });
      logAudit("sync_delete");
      return { ok: true };
    },
    [sync.username],
  );

  // On app start, detect an existing account (session persists in localStorage).
  useEffect(() => {
    if (!isSyncConfigured()) return;
    restoreSession().then((res) => {
      if (res.ok) setSync((prev) => ({ ...prev, status: "locked", username: res.data.user.username }));
    });
  }, []);

  // Best-effort final flush when the tab is hidden or closed.
  useEffect(() => {
    const onHide = () => {
      if (sessionRef.current && syncingRef.current === false) void runSync();
    };
    window.addEventListener("pagehide", onHide);
    return () => window.removeEventListener("pagehide", onHide);
  }, [runSync]);

  const value = useMemo<StoreValue>(
    () => ({
      ready,
      locked,
      settings,
      logs,
      journals,
      sync,
      setSettings,
      upsertLog,
      deleteLog,
      setFlowToday,
      saveJournal,
      deleteJournal,
      wipeAll,
      importBackup,
      getLog,
      addCustomItem,
      removeCustomItem,
      unlock,
      lock,
      enablePin,
      changePin,
      disablePin,
      signUpSync,
      signInSync,
      signOutSync,
      syncNow,
      changeSyncPassword,
      recoverSync,
      deleteAccount,
    }),
    [
      ready,
      locked,
      settings,
      logs,
      journals,
      sync,
      setSettings,
      upsertLog,
      deleteLog,
      setFlowToday,
      saveJournal,
      deleteJournal,
      wipeAll,
      importBackup,
      getLog,
      addCustomItem,
      removeCustomItem,
      unlock,
      lock,
      enablePin,
      changePin,
      disablePin,
      signUpSync,
      signInSync,
      signOutSync,
      syncNow,
      changeSyncPassword,
      recoverSync,
      deleteAccount,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): StoreValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useStore must be used within StoreProvider");
  return v;
}
