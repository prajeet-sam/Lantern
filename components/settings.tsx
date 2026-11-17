"use client";

import { useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { useTheme } from "@/lib/theme";
import { REGULARITY_OPTIONS } from "@/lib/labels";
import { APP_VERSION, buildBackup, downloadBackup, downloadCSV, downloadDoctorSummary, decryptBackup, downloadEncryptedBackup, encryptBackup, sniffBackup, type EncryptedBackup } from "@/lib/export";
import { MAX_IMPORT_BYTES, parseExport } from "@/lib/validation";
import { getNotificationStatus, requestNotificationPermission } from "@/lib/notifications";
import { isValidPin } from "@/lib/pin";
import { securityService } from "@/lib/security/service";
import { auditEventLabel, clearAudit, logAudit, readAudit } from "@/lib/audit";
import { Card, Button } from "@/components/ui";
import { Sheet } from "@/components/sheet";
import type { CycleRegularity, CustomItem, ThemeMode } from "@/types";
import { Moon, Sun, Monitor, Database, Shield, Download as DownloadIcon, Upload, Trash2, Info, FileText, Lock, Tags, Plus, X, Activity, Cloud, KeyRound, Copy, Check, RefreshCw, LogIn, UserPlus, Unlock } from "lucide-react";

export function SettingsView() {
  const { settings, setSettings, logs, journals, wipeAll, importBackup, sync } = useStore();
  const { mode, setMode } = useTheme();
  const fileRef = useRef<HTMLInputElement>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [notifStatus, setNotifStatus] = useState<string>(() => getNotificationStatus());
  const [encSheet, setEncSheet] = useState<null | "export" | "import">(null);
  const [encPassword, setEncPassword] = useState("");
  const [pendingEncFile, setPendingEncFile] = useState<File | null>(null);

  async function readFile(file: File) {
    if (file.size > MAX_IMPORT_BYTES) {
      setNotice("That backup is too large to import safely (max 8 MB).");
      return;
    }
    const text = await file.text();
    const kind = sniffBackup(text);
    if (kind === "encrypted") {
      setPendingEncFile(file);
      setEncPassword("");
      setEncSheet("import");
      return;
    }
    if (kind !== "plain") {
      setNotice("That doesn't look like a Lantern backup.");
      logAudit("import_failed");
      return;
    }
    const parsed = parseExport(text);
    if (!parsed.ok) {
      setNotice(parsed.error);
      logAudit("import_failed");
      return;
    }
    await importBackup(parsed.data);
    setNotice("Backup imported successfully.");
  }

  function closeEncSheet() {
    setEncSheet(null);
    setEncPassword("");
    setPendingEncFile(null);
  }

  async function submitEncSheet() {
    if (encPassword.length < 8) {
      setNotice("Use a password of at least 8 characters.");
      return;
    }
    if (encSheet === "export") {
      const payload = await encryptBackup(buildBackup(logs, journals, settings), encPassword);
      downloadEncryptedBackup(payload);
      closeEncSheet();
      logAudit("export_encrypted");
      setNotice("Encrypted backup downloaded. Keep that password safe — it can't be recovered.");
      return;
    }
    if (encSheet === "import" && pendingEncFile) {
      if (pendingEncFile.size > MAX_IMPORT_BYTES) {
        setNotice("That backup is too large to import safely (max 8 MB).");
        logAudit("import_failed");
        return;
      }
      const text = await pendingEncFile.text();
      const payload = JSON.parse(text) as EncryptedBackup;
      const backup = await decryptBackup(payload, encPassword);
      if (!backup) {
        setNotice("Wrong password, or the backup was tampered with.");
        logAudit("import_failed");
        setEncPassword("");
        return;
      }
      await importBackup(backup);
      closeEncSheet();
      setNotice("Encrypted backup imported successfully.");
    }
  }

  return (
    <div className="mx-auto w-full max-w-md space-y-4">
      <header className="px-1 pt-2">
        <h1 className="font-display text-2xl font-semibold text-foreground">Settings</h1>
      </header>

      {notice && (
        <div className="rounded-2xl bg-[var(--secondary)]/50 px-4 py-3 text-sm text-foreground">
          {notice} <button className="ml-2 text-muted-foreground underline" onClick={() => setNotice(null)}>dismiss</button>
        </div>
      )}

      {/* Appearance */}
      <Card className="p-5">
        <h2 className="mb-3 font-display text-lg font-semibold text-foreground">Appearance</h2>
        <div className="mb-4 flex gap-2">
          {(
            [
              ["light", "Light", <Sun key="l" className="h-4 w-4" />],
              ["dark", "Dark", <Moon key="d" className="h-4 w-4" />],
              ["system", "System", <Monitor key="s" className="h-4 w-4" />],
            ] as [ThemeMode, string, React.ReactNode][]
          ).map(([m, label, icon]) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              aria-pressed={mode === m}
              className={`flex-1 rounded-2xl border p-3 text-sm font-medium transition ${
                mode === m ? "border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]" : "border-[var(--border)] bg-[var(--card)] text-muted-foreground"
              }`}
            >
              <span className="flex items-center justify-center gap-1.5">{icon}{label}</span>
            </button>
          ))}
        </div>
        <ToggleRow label="Reduce motion" hint="Turn off most animation" value={settings.reducedMotion} onChange={(v) => setSettings({ reducedMotion: v })} />
        <ToggleRow label="High contrast" hint="Stronger borders and text" value={settings.highContrast} onChange={(v) => setSettings({ highContrast: v })} />
      </Card>

      {/* Profile / cycle */}
      <Card className="p-5">
        <h2 className="mb-3 font-display text-lg font-semibold text-foreground">Your cycle</h2>
        <label className="block text-sm font-medium text-muted-foreground">Typical cycle length (days)</label>
        <input
          type="number"
          min={21}
          max={45}
          value={settings.typicalCycleLength ?? 28}
          onChange={(e) => setSettings({ typicalCycleLength: clamp(Number(e.target.value), 21, 45) })}
          className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm text-foreground outline-none focus:border-[var(--primary)]"
        />
        <label className="mt-4 block text-sm font-medium text-muted-foreground">Typical period duration (days)</label>
        <input
          type="number"
          min={2}
          max={10}
          value={settings.typicalPeriodDuration ?? 5}
          onChange={(e) => setSettings({ typicalPeriodDuration: clamp(Number(e.target.value), 2, 10) })}
          className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm text-foreground outline-none focus:border-[var(--primary)]"
        />
        <label className="mt-4 block text-sm font-medium text-muted-foreground">Usual regularity</label>
        <select
          value={settings.regularity ?? "not_sure"}
          onChange={(e) => setSettings({ regularity: e.target.value as CycleRegularity })}
          className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm text-foreground outline-none focus:border-[var(--primary)]"
        >
          {REGULARITY_OPTIONS.map((r) => (
            <option key={r.id} value={r.id}>{r.label}</option>
          ))}
        </select>
        <label className="mt-4 block text-sm font-medium text-muted-foreground">First day of week</label>
        <select
          value={settings.firstDayOfWeek}
          onChange={(e) => setSettings({ firstDayOfWeek: Number(e.target.value) })}
          className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm text-foreground outline-none focus:border-[var(--primary)]"
        >
          <option value={0}>Sunday</option>
          <option value={1}>Monday</option>
        </select>
      </Card>

      {/* Reminders */}
      <Card className="p-5">
        <h2 className="mb-3 font-display text-lg font-semibold text-foreground">Reminders</h2>
        <div className="mb-3 flex items-center justify-between rounded-2xl border border-[var(--border)] p-3">
          <div>
            <div className="text-sm font-medium text-foreground">Device notifications</div>
            <div className="text-xs text-muted-foreground">
              {notifStatus === "granted"
                ? "Allowed — reminders can appear."
                : notifStatus === "unsupported"
                  ? "Not supported in this browser."
                  : "Not allowed yet."}
            </div>
          </div>
          {notifStatus === "default" && (
            <Button variant="secondary" onClick={async () => setNotifStatus(await requestNotificationPermission())}>
              Allow
            </Button>
          )}
        </div>
        <ToggleRow label="Upcoming period" hint="A gentle heads up" value={settings.notifyPeriod} onChange={(v) => setSettings({ notifyPeriod: v })} />
        <ToggleRow label="Daily check-in" hint="A tiny nudge to log today" value={settings.notifyCheckIn} onChange={(v) => setSettings({ notifyCheckIn: v })} />
        <ToggleRow label="Period logging" hint="Reminder to update flow" value={settings.notifyFlow} onChange={(v) => setSettings({ notifyFlow: v })} />
        <div className="mt-3">
          <label className="block text-sm font-medium text-muted-foreground">Privacy on lock screen</label>
          <div className="mt-1 flex gap-2">
            <OptionPill active={settings.notificationPrivacy === "private"} onClick={() => setSettings({ notificationPrivacy: "private" })} label="Generic ✨" />
            <OptionPill active={settings.notificationPrivacy === "detailed"} onClick={() => setSettings({ notificationPrivacy: "detailed" })} label="Detailed (shows cycle info)" />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Reminders are best-effort in a web app and may require the app to be open. Notifications are optional and can be turned off here at any time.
          </p>
        </div>
      </Card>

      {/* Custom tracking */}
      <CustomTrackingCard />

      {/* Privacy lock */}
      <PrivacyLockCard />

      {/* Cloud sync */}
      <SyncCard />

      {/* Privacy center */}
      <Card className="p-5">
        <div className="flex items-center gap-2 font-display text-lg font-semibold text-foreground">
          <Shield className="h-5 w-5 text-[var(--rose)]" /> Privacy & data
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Lantern stores your data locally on this device. If you set up Sync, a copy is uploaded only after being
          encrypted with your password — we can&rsquo;t read it. Nothing is sold or used for ads.
        </p>
        <div className="mt-3 space-y-2">
          <InfoRow icon={<Database className="h-4 w-4" />} title="Storage" value="On-device (IndexedDB)" />
          <InfoRow icon={<Upload className="h-4 w-4" />} title="Sync" value={sync.status === "off" ? "Off" : sync.status === "signed_out" ? "Optional" : `On (@${sync.username})`} />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={() => { downloadBackup(buildBackup(logs, journals, settings)); logAudit("export"); }}>
            <DownloadIcon className="h-4 w-4" /> Export (JSON)
          </Button>
          <Button variant="secondary" onClick={() => downloadCSV(logs)}>
            <FileText className="h-4 w-4" /> Export (CSV)
          </Button>
          <Button variant="secondary" onClick={() => downloadDoctorSummary(logs, journals, settings)}>
            <Info className="h-4 w-4" /> My summary
          </Button>
          <Button variant="secondary" onClick={() => fileRef.current?.click()}>
            <Upload className="h-4 w-4" /> Import backup
          </Button>
          <input ref={fileRef} type="file" accept="application/json,application/octet-stream" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void readFile(f); e.target.value = ""; }} />
        </div>

        <Button variant="secondary" className="mt-2 w-full" onClick={() => { setEncPassword(""); setEncSheet("export"); }}>
          <Lock className="h-4 w-4" /> Export (encrypted backup)
        </Button>
        <p className="mt-1 text-xs text-muted-foreground">
          Password-protected copy of everything. Safe to keep in a cloud folder — but never forget the password.
        </p>

        {!confirmDelete ? (
          <Button variant="danger" className="mt-4 w-full" onClick={() => setConfirmDelete(true)}>
            <Trash2 className="h-4 w-4" /> Delete everything
          </Button>
        ) : (
          <div className="mt-4 rounded-2xl border border-[var(--danger)]/40 bg-[var(--danger)]/10 p-4">
            <p className="text-sm font-medium text-foreground">
              This permanently deletes your cycle history, symptoms, journal entries and settings
              {sync.status === "unlocked" || sync.status === "locked" ? " — and the encrypted copy in your sync account." : " — on this device."}
            </p>
            <div className="mt-3 flex gap-2">
              <Button variant="danger" onClick={async () => { await wipeAll(); setConfirmDelete(false); setNotice("All your data was deleted from this device."); }}>
                Yes, delete everything
              </Button>
              <Button variant="ghost" onClick={() => setConfirmDelete(false)}>Cancel</Button>
            </div>
          </div>
        )}
      </Card>

      {/* Diagnostics */}
      <DiagnosticsCard />

      {/* About */}
      <Card className="p-5">
        <h2 className="font-display text-lg font-semibold text-foreground">About</h2>
        <p className="mt-1 text-sm text-muted-foreground">Lantern v{APP_VERSION}</p>
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
          Lantern is a cycle and wellness tracker — a companion, not a diagnostic or medical device. It provides calendar
          estimates that can be inaccurate, especially with irregular cycles, and calendar-based methods are not reliable
          contraception. If something feels unusually severe or concerning, please speak with a healthcare professional.
        </p>
      </Card>

      <Sheet open={encSheet !== null} onClose={closeEncSheet} title={encSheet === "export" ? "Create an encrypted backup" : "Unlock this backup"}>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {encSheet === "export"
              ? "Choose a password to seal your data. It uses 200,000 rounds of PBKDF2 and AES-256, so the file is unreadable without it. Lantern can't reset or recover a forgotten password."
              : "This backup is encrypted. Enter the password it was created with."}
          </p>
          <input
            type="password"
            value={encPassword}
            onChange={(e) => setEncPassword(e.target.value)}
            placeholder={encSheet === "export" ? "Password (8+ characters)" : "Password"}
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-sm text-foreground outline-none focus:border-[var(--primary)]"
          />
          {encSheet === "export" && (
            <p className="text-xs text-muted-foreground">Minimum 8 characters.</p>
          )}
          <Button className="w-full" onClick={() => void submitEncSheet()}>
            {encSheet === "export" ? "Download encrypted backup" : "Decrypt & import"}
          </Button>
          <div className="h-1" />
        </div>
      </Sheet>
      <div className="h-20" />
    </div>
  );
}

function clamp(n: number, lo: number, hi: number) {
  if (Number.isNaN(n)) return lo;
  return Math.max(lo, Math.min(hi, n));
}

const CUSTOM_TYPES: { id: CustomItem["type"]; label: string }[] = [
  { id: "mood", label: "Mood" },
  { id: "symptom", label: "Symptom" },
  { id: "tag", label: "Tag" },
];

function CustomTrackingCard() {
  const { settings, addCustomItem, removeCustomItem } = useStore();
  const customItems = settings.customItems ?? [];
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [emoji, setEmoji] = useState("");
  const [type, setType] = useState<CustomItem["type"]>("mood");
  const [error, setError] = useState<string | null>(null);

  function submit() {
    const trimmed = label.trim();
    if (!trimmed) {
      setError("Give it a short name first.");
      return;
    }
    if (customItems.some((c) => c.label.toLowerCase() === trimmed.toLowerCase())) {
      setError("That one already exists.");
      return;
    }
    void addCustomItem({ label: trimmed, emoji: emoji.trim() || undefined, type });
    setLabel("");
    setEmoji("");
    setError(null);
    setOpen(false);
  }

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 font-display text-lg font-semibold text-foreground">
          <Tags className="h-5 w-5 text-[var(--accent)]" /> Custom tracking
        </div>
        <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> Add
        </Button>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Create your own moods, symptoms, or tags. They show up in check-ins and journal entries — and stay on this device.
      </p>

      {customItems.length === 0 ? (
        <p className="mt-3 text-xs text-muted-foreground">No custom items yet.</p>
      ) : (
        <ul className="mt-3 space-y-1.5">
          {customItems.map((c) => (
            <li key={c.id} className="flex items-center gap-2 rounded-xl bg-[var(--secondary)]/40 px-3 py-2">
              <span className="text-sm">{c.emoji ?? "•"}</span>
              <span className="flex-1 text-sm text-foreground">{c.label}</span>
              <span className="rounded-full bg-[var(--secondary)] px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                {c.type}
              </span>
              <button
                aria-label={`Remove ${c.label}`}
                onClick={() => void removeCustomItem(c.id)}
                className="rounded-full p-1 text-muted-foreground hover:bg-[var(--danger)]/10 hover:text-[var(--danger)]"
              >
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <Sheet open={open} onClose={() => setOpen(false)} title="Add a custom item">
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">Type</label>
            <div className="flex gap-2">
              {CUSTOM_TYPES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setType(t.id)}
                  aria-pressed={type === t.id}
                  className={`flex-1 rounded-xl border px-3 py-2 text-sm font-medium transition ${
                    type === t.id
                      ? "border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]"
                      : "border-[var(--border)] text-muted-foreground"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">Name</label>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Braided hair, moon tea, focus…"
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2.5 text-sm text-foreground outline-none focus:border-[var(--primary)]"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">Emoji (optional)</label>
            <input
              value={emoji}
              onChange={(e) => setEmoji(e.target.value.slice(0, 4))}
              placeholder="✨"
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2.5 text-sm text-foreground outline-none focus:border-[var(--primary)]"
            />
          </div>
          {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
          <Button className="w-full" onClick={submit}>
            Add item
          </Button>
          <div className="h-1" />
        </div>
      </Sheet>
    </Card>
  );
}

function PrivacyLockCard() {
  const { settings, setSettings, enablePin, changePin, disablePin, lock } = useStore();
  const hasPin = securityService.hasVault();
  const [open, setOpen] = useState<null | "set" | "change" | "remove">(null);
  const [current, setCurrent] = useState("");
  const [nextPin, setNextPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function close() {
    setOpen(null);
    setCurrent("");
    setNextPin("");
    setError(null);
  }

  async function save() {
    if (busy) return;
    setError(null);

    if (open === "set") {
      if (!isValidPin(nextPin)) {
        setError("Use exactly 4 digits.");
        return;
      }
      setBusy(true);
      const ok = await enablePin(nextPin);
      setBusy(false);
      if (!ok) {
        setError("Couldn't create the encryption key. Try again.");
        return;
      }
      setNotice("Privacy lock set — your data is now encrypted on this device.");
      close();
      return;
    }

    if (open === "change") {
      if (!isValidPin(current) || !isValidPin(nextPin)) {
        setError("Both PINs must be exactly 4 digits.");
        return;
      }
      setBusy(true);
      const ok = await changePin(current, nextPin);
      setBusy(false);
      if (!ok) {
        setError("That's not your current PIN.");
        return;
      }
      setNotice("PIN updated — everything was re-encrypted.");
      close();
      return;
    }

    if (open === "remove") {
      if (!isValidPin(current)) {
        setError("Use exactly 4 digits.");
        return;
      }
      setBusy(true);
      const ok = await disablePin(current);
      setBusy(false);
      if (!ok) {
        setError("That PIN didn't match.");
        return;
      }
      setNotice("Privacy lock removed. Your data is back to unencrypted.");
      close();
      return;
    }
  }

  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 font-display text-lg font-semibold text-foreground">
        <Lock className="h-5 w-5 text-[var(--rose)]" /> Privacy lock
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        {hasPin
          ? "A 4-digit PIN locks the app and encrypts your data at rest. It unlocks only while you're here."
          : "Add a 4-digit PIN to lock the app and encrypt your data at rest."}
      </p>

      {notice && <p className="mt-2 text-sm text-[var(--success)]">{notice}</p>}
      {error && <p className="mt-2 text-sm text-[var(--danger)]">{error}</p>}

      <div className="mt-3 flex flex-wrap gap-2">
        {hasPin && (
          <Button variant="secondary" size="sm" onClick={() => lock()}>
            Lock now
          </Button>
        )}
        <Button variant="secondary" size="sm" onClick={() => setOpen(hasPin ? "change" : "set")}>
          {hasPin ? "Change PIN" : "Set PIN"}
        </Button>
        {hasPin && (
          <Button variant="ghost" size="sm" onClick={() => setOpen("remove")}>
            Remove PIN
          </Button>
        )}
      </div>

      <Sheet
        open={open !== null}
        onClose={close}
        title={open === "remove" ? "Remove PIN" : open === "change" ? "Change PIN" : "Set a PIN"}
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {open === "remove"
              ? "Enter your current PIN to remove the lock and unencrypt your data."
              : open === "change"
                ? "Enter your current PIN, then choose a new 4-digit PIN. Everything gets re-encrypted."
                : "Choose a 4-digit PIN. Keep it somewhere safe — you need it to unlock Lantern."}
          </p>
          {open === "change" && (
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={current}
              onChange={(e) => setCurrent(e.target.value.replace(/\D/g, ""))}
              placeholder="Current PIN"
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-center text-xl tracking-[0.5em] text-foreground outline-none focus:border-[var(--primary)]"
            />
          )}
          {open === "remove" && (
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={current}
              onChange={(e) => setCurrent(e.target.value.replace(/\D/g, ""))}
              placeholder="••••"
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-center text-xl tracking-[0.5em] text-foreground outline-none focus:border-[var(--primary)]"
            />
          )}
          {open !== "remove" && (
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={nextPin}
              onChange={(e) => setNextPin(e.target.value.replace(/\D/g, ""))}
              placeholder={open === "change" ? "New PIN" : "••••"}
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-center text-xl tracking-[0.5em] text-foreground outline-none focus:border-[var(--primary)]"
            />
          )}
          <p className="text-xs text-muted-foreground">
            The PIN is derived into an encryption key with 200,000 rounds of PBKDF2 — it&rsquo;s never stored or sent anywhere.
          </p>
          <Button className="w-full" onClick={() => void save()} disabled={busy}>
            {busy ? "Working…" : open === "remove" ? "Remove lock" : "Save PIN"}
          </Button>
          <div className="h-1" />
        </div>
      </Sheet>

      <div className="mt-4 space-y-3 border-t border-[var(--border)] pt-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-foreground">Auto-lock</label>
          <select
            value={settings.autoLockMinutes ? String(settings.autoLockMinutes) : "off"}
            onChange={(e) => {
              const v = e.target.value;
              void setSettings({ autoLockMinutes: v === "off" ? null : Number(v) });
            }}
            disabled={!hasPin}
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2.5 text-sm text-foreground outline-none focus:border-[var(--primary)] disabled:opacity-50"
          >
            <option value="off">Off</option>
            <option value="1">After 1 minute</option>
            <option value="5">After 5 minutes</option>
            <option value="15">After 15 minutes</option>
            <option value="30">After 30 minutes</option>
          </select>
          {!hasPin && <p className="mt-1 text-xs text-muted-foreground">Set a PIN to use auto-lock.</p>}
        </div>
        <ToggleRow
          label="Blur on hide"
          hint="Fuzz the screen when you switch away, so nothing is readable."
          value={settings.blurOnHide ?? false}
          onChange={(v) => void setSettings({ blurOnHide: v })}
          disabled={!hasPin}
        />
        {!hasPin && <p className="text-xs text-muted-foreground">Blur on hide only works with a PIN set.</p>}
      </div>
    </Card>
  );
}

function SyncCard() {
  const { sync, signUpSync, signInSync, signOutSync, syncNow, changeSyncPassword, recoverSync, deleteAccount } = useStore();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [recoveryKey, setRecoveryKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [sheet, setSheet] = useState<null | "unlock" | "change" | "recover" | "delete">(null);

  function clearForm() {
    setUsername("");
    setPassword("");
    setError(null);
  }

  async function copyRecovery() {
    if (!recoveryKey) return;
    try {
      await navigator.clipboard.writeText(recoveryKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  }

  async function submitAccount() {
    if (busy) return;
    setError(null);
    const u = username.trim();
    if (!u) {
      setError("Choose a username.");
      return;
    }
    if (mode === "signup" && password.length < 12) {
      setError("Use a password of at least 12 characters.");
      return;
    }
    if (mode === "signin" && password.length < 8) {
      setError("Enter your password.");
      return;
    }
    setBusy(true);
    let res: { ok: boolean; recoveryKey?: string; error?: string };
    if (mode === "signup") res = await signUpSync(u, password);
    else res = await signInSync(u, password);
    setBusy(false);
    if (!res.ok) {
      setError(res.error ?? "Something went wrong.");
      return;
    }
    if (res.recoveryKey) {
      setRecoveryKey(res.recoveryKey);
    } else {
      clearForm();
      setNotice("Signed in. Your data is synced across devices.");
    }
  }

  async function submitUnlock() {
    if (busy || !sync.username) return;
    setBusy(true);
    setError(null);
    const res = await signInSync(sync.username, password);
    setBusy(false);
    if (!res.ok) {
      setError(res.error ?? "Couldn't unlock sync.");
      return;
    }
    setSheet(null);
    setPassword("");
    setNotice("Sync unlocked.");
  }

  async function submitChange() {
    if (busy) return;
    setBusy(true);
    setError(null);
    const res = await changeSyncPassword(password);
    setBusy(false);
    if (!res.ok) {
      setError(res.error ?? "Couldn't change the password.");
      return;
    }
    setSheet(null);
    setPassword("");
    setNotice("Password changed. Use it to sign in on other devices.");
  }

  async function submitRecover() {
    if (busy) return;
    setBusy(true);
    setError(null);
    const res = await recoverSync(username.trim() || (sync.username ?? ""), recoveryKey ?? "", password);
    setBusy(false);
    if (!res.ok) {
      setError(res.error ?? "Couldn't recover the account.");
      return;
    }
    setSheet(null);
    setRecoveryKey(null);
    setPassword("");
    setUsername("");
    setNotice("Password reset. Sign in with your new password.");
  }

  async function submitDelete() {
    if (busy) return;
    setBusy(true);
    setError(null);
    const res = await deleteAccount(password);
    setBusy(false);
    if (!res.ok) {
      setError(res.error ?? "Couldn't delete the account.");
      return;
    }
    setSheet(null);
    setPassword("");
    setNotice("Your account was deleted. This device's data stays local.");
  }

  const lastSynced = sync.lastSyncedAt ? new Date(sync.lastSyncedAt).toLocaleString() : null;

  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 font-display text-lg font-semibold text-foreground">
        <Cloud className="h-5 w-5 text-[var(--primary)]" /> Sync
      </div>

      {notice && <p className="mt-2 text-sm text-[var(--success)]">{notice}</p>}
      {error && <p className="mt-2 text-sm text-[var(--danger)]">{error}</p>}

      {sync.status === "off" && (
        <p className="mt-2 text-sm text-muted-foreground">
          Cloud sync isn&rsquo;t configured on this device.
        </p>
      )}

      {(sync.status === "unlocked" || sync.status === "syncing" || sync.status === "error") && (
        <>
          <div className="mt-3 space-y-1 rounded-2xl bg-[var(--secondary)]/40 px-3 py-2.5 text-sm">
            <div className="flex items-center gap-2">
              <span className="font-medium text-foreground">@{sync.username}</span>
              <span className="ml-auto rounded-full bg-[var(--primary)]/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[var(--primary)]">
                {sync.status === "syncing" ? "Syncing…" : sync.status === "error" ? "Error" : "Synced"}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              {sync.status === "error"
                ? sync.lastError ?? "Sync had a problem."
                : lastSynced
                  ? `Last synced ${lastSynced}`
                  : "Everything is encrypted before it leaves this device."}
            </p>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={() => void syncNow()} disabled={sync.status === "syncing"}>
              <RefreshCw className={`h-4 w-4 ${sync.status === "syncing" ? "animate-spin" : ""}`} /> Sync now
            </Button>
            <Button variant="secondary" size="sm" onClick={() => { setPassword(""); setError(null); setSheet("change"); }}>
              <KeyRound className="h-4 w-4" /> Change password
            </Button>
            <Button variant="secondary" size="sm" onClick={() => { setError(null); setSheet("recover"); }}>
              <Unlock className="h-4 w-4" /> Forgot password
            </Button>
            <Button variant="ghost" size="sm" onClick={() => void signOutSync()}>
              Sign out
            </Button>
          </div>
        </>
      )}

      {sync.status === "locked" && (
        <>
          <p className="mt-2 text-sm text-muted-foreground">
            You&rsquo;re signed in as <span className="font-medium text-foreground">@{sync.username}</span>. Enter your password
            to unlock sync for this session.
          </p>
          <div className="mt-3 flex gap-2">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="min-w-0 flex-1 rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2.5 text-sm text-foreground outline-none focus:border-[var(--primary)]"
            />
            <Button onClick={() => void submitUnlock()} disabled={busy || !password}>
              {busy ? "…" : "Unlock"}
            </Button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="ghost" size="sm" onClick={() => { setError(null); setSheet("recover"); }}>
              <Unlock className="h-4 w-4" /> Forgot password
            </Button>
            <Button variant="ghost" size="sm" onClick={() => void signOutSync()}>
              Sign out
            </Button>
          </div>
        </>
      )}

      {sync.status === "signed_out" && (
        <>
          <p className="mt-2 text-sm text-muted-foreground">
            Create an account to keep an encrypted copy of your data in sync across devices. It&rsquo;s sealed with your
            password before it ever leaves this device.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => { setMode("signin"); setError(null); }}
              aria-pressed={mode === "signin"}
              className={`flex-1 rounded-xl border px-3 py-2 text-sm font-medium transition ${mode === "signin" ? "border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]" : "border-[var(--border)] text-muted-foreground"}`}
            >
              Sign in
            </button>
            <button
              onClick={() => { setMode("signup"); setError(null); }}
              aria-pressed={mode === "signup"}
              className={`flex-1 rounded-xl border px-3 py-2 text-sm font-medium transition ${mode === "signup" ? "border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]" : "border-[var(--border)] text-muted-foreground"}`}
            >
              Create account
            </button>
          </div>
          <div className="mt-3 space-y-2">
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Username"
              autoCapitalize="none"
              autoCorrect="off"
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2.5 text-sm text-foreground outline-none focus:border-[var(--primary)]"
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === "signup" ? "Password (12+ characters)" : "Password"}
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2.5 text-sm text-foreground outline-none focus:border-[var(--primary)]"
            />
          </div>
          <Button className="mt-3 w-full" onClick={() => void submitAccount()} disabled={busy || !username.trim() || !password}>
            {busy ? "Working…" : mode === "signup" ? <><UserPlus className="h-4 w-4" /> Create account</> : <><LogIn className="h-4 w-4" /> Sign in</>}
          </Button>
          {mode === "signup" && (
            <p className="mt-2 text-xs text-muted-foreground">
              Your password is never sent to our servers. It&rsquo;s used on this device to encrypt your data before upload.
            </p>
          )}
        </>
      )}

      {sync.status === "unlocked" && (
        <div className="mt-4 space-y-3 border-t border-[var(--border)] pt-4">
          <Button variant="danger" size="sm" onClick={() => { setPassword(""); setError(null); setSheet("delete"); }}>
            <Trash2 className="h-4 w-4" /> Delete account
          </Button>
        </div>
      )}

      {recoveryKey && (
        <Sheet open onClose={() => { setRecoveryKey(null); clearForm(); }} title="Save your recovery key">
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              This is the only way to get your data back if you forget your password. Lantern can&rsquo;t recover it for you.
              Save it somewhere safe — it&rsquo;s shown only once.
            </p>
            <div className="rounded-xl border border-[var(--primary)]/40 bg-[var(--primary)]/5 p-3">
              <code className="break-all font-mono text-sm text-foreground select-all">{recoveryKey}</code>
            </div>
            <Button variant="secondary" className="w-full" onClick={() => void copyRecovery()}>
              {copied ? <><Check className="h-4 w-4" /> Copied</> : <><Copy className="h-4 w-4" /> Copy key</>}
            </Button>
            <Button className="w-full" onClick={() => { setRecoveryKey(null); clearForm(); setNotice("Account created — your recovery key is saved with you."); }}>
              I&rsquo;ve saved it
            </Button>
            <div className="h-1" />
          </div>
        </Sheet>
      )}

      <Sheet
        open={sheet === "change" || sheet === "recover" || sheet === "unlock" || sheet === "delete"}
        onClose={() => { setSheet(null); setPassword(""); setError(null); }}
        title={sheet === "change" ? "Change sync password" : sheet === "recover" ? "Forgot your password?" : sheet === "delete" ? "Delete account" : "Unlock sync"}
      >
        <div className="space-y-4">
          {sheet === "recover" && (
            <>
              <p className="text-sm text-muted-foreground">
                Enter your username, recovery key and a new password. The recovery key is checked against a hash —
                never stored or sent in plaintext.
              </p>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder={sync.username ? `Username (${sync.username})` : "Username"}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-sm text-foreground outline-none focus:border-[var(--primary)]"
              />
              <input
                type="password"
                value={recoveryKey ?? ""}
                onChange={(e) => setRecoveryKey(e.target.value)}
                placeholder="Recovery key"
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-sm text-foreground outline-none focus:border-[var(--primary)]"
              />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="New password (12+ characters)"
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-sm text-foreground outline-none focus:border-[var(--primary)]"
              />
              <Button className="w-full" onClick={() => void submitRecover()} disabled={busy}>
                {busy ? "Working…" : "Reset password"}
              </Button>
            </>
          )}

          {sheet === "change" && (
            <>
              <p className="text-sm text-muted-foreground">
                Choose a new password (12+ characters). Your data stays encrypted — only the lock is changed.
              </p>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="New password"
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-sm text-foreground outline-none focus:border-[var(--primary)]"
              />
              <Button className="w-full" onClick={() => void submitChange()} disabled={busy || password.length < 12}>
                {busy ? "Working…" : "Change password"}
              </Button>
            </>
          )}

          {sheet === "delete" && (
            <>
              <p className="text-sm text-muted-foreground">
                This permanently deletes your account, the encrypted copy in the cloud, and your recovery key. Your data
                on this device stays. Enter your password to confirm.
              </p>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-sm text-foreground outline-none focus:border-[var(--primary)]"
              />
              <Button variant="danger" className="w-full" onClick={() => void submitDelete()} disabled={busy || !password}>
                {busy ? "Working…" : "Delete account permanently"}
              </Button>
            </>
          )}
          <div className="h-1" />
        </div>
      </Sheet>
    </Card>
  );
}

function DiagnosticsCard() {
  const [entries, setEntries] = useState(readAudit());

  function refresh() {
    setEntries(readAudit());
  }

  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 font-display text-lg font-semibold text-foreground">
        <Activity className="h-5 w-5 text-[var(--accent)]" /> Diagnostics
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        A small local activity log (unlocks, PIN changes, imports). It never contains your data and never leaves this device.
      </p>
      <div className="mt-3 space-y-1.5">
        {entries.length === 0 ? (
          <p className="text-xs text-muted-foreground">No activity recorded yet.</p>
        ) : (
          entries
            .slice(-8)
            .reverse()
            .map((e, i) => (
              <div key={`${e.t}-${i}`} className="flex items-center justify-between rounded-xl bg-[var(--secondary)]/40 px-3 py-1.5 text-sm">
                <span className="text-foreground">{auditEventLabel(e.e)}</span>
                <span className="text-xs text-muted-foreground">{new Date(e.t).toLocaleString()}</span>
              </div>
            ))
        )}
      </div>
      <div className="mt-3 flex gap-2">
        <Button size="sm" variant="secondary" onClick={refresh}>Refresh</Button>
        <Button size="sm" variant="ghost" onClick={() => { clearAudit(); setEntries([]); }}>Clear log</Button>
      </div>
    </Card>
  );
}

function ToggleRow({ label, hint, value, onChange, disabled }: { label: string; hint?: string; value: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1">
      <div>
        <div className="text-sm font-medium text-foreground">{label}</div>
        {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
      </div>
      <input type="checkbox" checked={value} disabled={disabled} onChange={(e) => onChange(e.target.checked)} className="h-5 w-9 appearance-none rounded-full bg-[var(--border)] transition checked:bg-[var(--primary)] relative after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:transition checked:after:translate-x-4 disabled:opacity-50" />
    </div>
  );
}

function InfoRow({ icon, title, value }: { icon: React.ReactNode; title: string; value: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground">{icon}</span>
      <span className="text-foreground">{title}</span>
      <span className="ml-auto text-muted-foreground">{value}</span>
    </div>
  );
}

function OptionPill({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${active ? "border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]" : "border-[var(--border)] text-muted-foreground"}`}>
      {label}
    </button>
  );
}