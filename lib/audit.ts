/**
 * Local, bounded, content-free audit trail (M4). Records security- and
 * privacy-relevant events (unlock attempts, PIN changes, imports, wipes) so a
 * problem can be diagnosed on-device. Deliberately stores NO user data — only
 * event names and timestamps — and never leaves the device.
 */

export type AuditEvent =
  | "app_launch"
  | "unlock"
  | "unlock_failed"
  | "lock"
  | "pin_set"
  | "pin_changed"
  | "pin_disabled"
  | "import"
  | "import_failed"
  | "export"
  | "export_encrypted"
  | "wipe"
  | "sync_signup"
  | "sync_signin"
  | "sync_signout"
  | "sync_password"
  | "sync_recovery"
  | "sync_delete"
  | "sync_error";

export interface AuditEntry {
  /** Epoch milliseconds. */
  t: number;
  e: AuditEvent;
}

const AUDIT_KEY = "lantern:audit";
export const MAX_AUDIT_ENTRIES = 200;

function read(): AuditEntry[] {
  try {
    const raw = localStorage.getItem(AUDIT_KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter(
          (x): x is AuditEntry =>
            !!x && typeof x === "object" && typeof (x as AuditEntry).t === "number" && typeof (x as AuditEntry).e === "string",
        );
      }
    }
  } catch {
    /* ignore */
  }
  return [];
}

function write(entries: AuditEntry[]): void {
  try {
    localStorage.setItem(AUDIT_KEY, JSON.stringify(entries));
  } catch {
    /* ignore quota errors */
  }
}

export function logAudit(e: AuditEvent): void {
  const entries = read();
  entries.push({ t: Date.now(), e });
  while (entries.length > MAX_AUDIT_ENTRIES) entries.shift();
  write(entries);
}

export function readAudit(): AuditEntry[] {
  return read();
}

export function clearAudit(): void {
  write([]);
}

/** Human-friendly label for the diagnostics view. */
export function auditEventLabel(e: AuditEvent): string {
  const labels: Record<AuditEvent, string> = {
    app_launch: "App opened",
    unlock: "Unlocked",
    unlock_failed: "Unlock failed",
    lock: "Locked",
    pin_set: "PIN set",
    pin_changed: "PIN changed",
    pin_disabled: "PIN removed",
    import: "Backup imported",
    import_failed: "Import failed",
    export: "Backup exported",
    export_encrypted: "Encrypted backup exported",
    wipe: "All data deleted",
    sync_signup: "Sync account created",
    sync_signin: "Sync signed in",
    sync_signout: "Sync signed out",
    sync_password: "Sync password changed",
    sync_recovery: "Password recovered",
    sync_delete: "Sync account deleted",
    sync_error: "Sync error",
  };
  return labels[e] ?? e;
}
