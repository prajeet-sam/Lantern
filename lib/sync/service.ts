import type { DailyLog, JournalEntry, Settings } from "@/types";
import {
  changeAccountPassword,
  createSession,
  openSession,
  pushAndMerge,
  recoverAccount,
  restoreSession,
  type Session,
} from "@/lib/sync/scheduler";
import {
  deleteAccountRequest,
  deleteVault,
  isSyncConfigured,
  signOut as signOutRemote,
  type SyncResult,
} from "@/lib/sync/client";

export interface SyncService {
  isConfigured(): boolean;
  createSession(username: string, password: string, logs: DailyLog[], journals: JournalEntry[], settings: Settings): Promise<SyncResult<{ session: Session; recoveryKey: string }>>;
  openSession(username: string, password: string): Promise<SyncResult<Session>>;
  pushAndMerge(session: Session, logs: DailyLog[], journals: JournalEntry[], settings: Settings): Promise<SyncResult<{ merged: { dailyLogs: DailyLog[]; journals: JournalEntry[]; settings?: Partial<Settings> }; settings: Settings; rev: number }>>;
  changeAccountPassword(session: Session, newPassword: string): Promise<SyncResult<number>>;
  recoverAccount(username: string, recoveryKey: string, newPassword: string): Promise<SyncResult<null>>;
  restoreSession(): Promise<SyncResult<{ user: { id: string; username: string }; vault: unknown }>>;
  deleteAccountRequest(): Promise<SyncResult<null>>;
  deleteVault(userId: string): Promise<void>;
  signOutRemote(): Promise<void>;
  isConfiguredSync(): boolean;
}

export interface SyncServiceAdapter {
  isConfigured?: () => boolean;
  createSession?: typeof createSession;
  openSession?: typeof openSession;
  pushAndMerge?: typeof pushAndMerge;
  changeAccountPassword?: typeof changeAccountPassword;
  recoverAccount?: typeof recoverAccount;
  restoreSession?: typeof restoreSession;
  deleteAccountRequest?: typeof deleteAccountRequest;
  deleteVault?: typeof deleteVault;
  signOutRemote?: typeof signOutRemote;
}

export function createSyncService(adapter: SyncServiceAdapter = {}): SyncService {
  return {
    isConfigured() {
      return adapter.isConfigured ? adapter.isConfigured() : isSyncConfigured();
    },
    async createSession(username, password, logs, journals, settings) {
      return adapter.createSession ? adapter.createSession(username, password, logs, journals, settings) : createSession(username, password, logs, journals, settings);
    },
    async openSession(username, password) {
      return adapter.openSession ? adapter.openSession(username, password) : openSession(username, password);
    },
    async pushAndMerge(session, logs, journals, settings) {
      return adapter.pushAndMerge ? adapter.pushAndMerge(session, logs, journals, settings) : pushAndMerge(session, logs, journals, settings);
    },
    async changeAccountPassword(session, newPassword) {
      return adapter.changeAccountPassword ? adapter.changeAccountPassword(session, newPassword) : changeAccountPassword(session, newPassword);
    },
    async recoverAccount(username, recoveryKey, newPassword) {
      return adapter.recoverAccount ? adapter.recoverAccount(username, recoveryKey, newPassword) : recoverAccount(username, recoveryKey, newPassword);
    },
    async restoreSession() {
      return adapter.restoreSession ? adapter.restoreSession() : restoreSession();
    },
    async deleteAccountRequest() {
      return adapter.deleteAccountRequest ? adapter.deleteAccountRequest() : deleteAccountRequest();
    },
    async deleteVault(userId) {
      return adapter.deleteVault ? adapter.deleteVault(userId) : deleteVault(userId);
    },
    async signOutRemote() {
      return adapter.signOutRemote ? adapter.signOutRemote() : signOutRemote();
    },
    isConfiguredSync() {
      return this.isConfigured();
    },
  };
}

export const syncService = createSyncService();
