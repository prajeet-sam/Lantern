"use client";

import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import type { JournalEntry } from "@/types";
import { formatPretty, todayKey } from "@/lib/dates";
import { EmptyState, Card, Button } from "@/components/ui";
import { Sheet } from "@/components/sheet";
import { Search, Trash2, NotebookPen } from "lucide-react";
import { moodLabel, symptomLabel } from "@/lib/constants";

export function JournalView() {
  const { journals, saveJournal, deleteJournal, settings } = useStore();
  const [editing, setEditing] = useState<null | "new" | string>(null);
  const [q, setQ] = useState("");

  const editingEntry = typeof editing === "string" && editing !== "new" ? journals.find((j) => j.id === editing) ?? null : null;

  const list = useMemo(() => {
    const filtered = journals.filter((j) => j.text.toLowerCase().includes(q.toLowerCase()));
    return [...filtered].sort((a, b) => b.date.localeCompare(a.date));
  }, [journals, q]);

  return (
    <div className="mx-auto w-full max-w-md space-y-4">
      <header className="flex items-end justify-between px-1 pt-2">
        <div>
          <h1 className="font-display text-2xl font-semibold text-foreground">Journal</h1>
          <p className="text-sm text-muted-foreground">
            Private — stays on this device
          </p>
        </div>
        <Button size="sm" onClick={() => setEditing("new")}>
          <NotebookPen className="h-4 w-4" /> New note
        </Button>
      </header>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search notes"
          className="w-full rounded-full border border-[var(--border)] bg-[var(--card)] py-2.5 pl-10 pr-4 text-sm text-foreground outline-none focus:border-[var(--primary)]"
        />
      </div>

      <div className="space-y-3">
        {list.length === 0 && (
          <EmptyState title={q ? "No matches" : "Nothing written yet"} subtitle={q ? "Try another search." : "Leave yourself a little note."} />
        )}
        {list.map((j) => (
          <Card key={j.id} className="p-4">
            <button onClick={() => setEditing(j.id)} className="w-full text-left">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-[var(--rose)]">{formatPretty(j.date)}</span>
                <span className="text-xs text-muted-foreground">{j.moods.length ? j.moods.map((m) => moodLabel(m, settings.customItems)).join(", ") : "no mood marked"}</span>
              </div>
              <p className="mt-2 line-clamp-4 whitespace-pre-wrap text-sm leading-relaxed text-foreground">{j.text}</p>
              {j.symptoms.length ? (
                <div className="mt-2 flex flex-wrap gap-1">
                  {j.symptoms.map((s) => (
                    <span key={s} className="rounded-full bg-[var(--secondary)]/50 px-2 py-0.5 text-xs text-[var(--secondary-foreground)]">{symptomLabel(s, settings.customItems)}</span>
                  ))}
                </div>
              ) : null}
            </button>
          </Card>
        ))}
      </div>

      <JournalEditorTask
        key={editing ?? "closed"}
        entry={editingEntry}
        isNew={editing === "new"}
        open={editing !== null}
        onClose={() => setEditing(null)}
        onSave={saveJournal}
        onDelete={deleteJournal}
      />
      <div className="h-20" />
    </div>
  );
}

function JournalEditorTask({
  entry,
  isNew,
  open,
  onClose,
  onSave,
  onDelete,
}: {
  entry: JournalEntry | null;
  isNew: boolean;
  open: boolean;
  onClose: () => void;
  onSave: (e: Partial<JournalEntry>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [text, setText] = useState(entry?.text ?? "");
  const [date, setDate] = useState(entry?.date ?? todayKey());
  const [confirmDel, setConfirmDel] = useState(false);

  return (
    <Sheet open={open} onClose={onClose} title={isNew ? "New note" : "Edit note"}>
      <div className="space-y-3">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm text-foreground outline-none focus:border-[var(--primary)]"
        />
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={6}
          placeholder="How are you feeling today? Anything worth remembering?"
          className="w-full resize-none rounded-2xl border border-[var(--border)] bg-[var(--card)] p-3 text-sm leading-relaxed text-foreground outline-none focus:border-[var(--primary)]"
        />
        <p className="text-xs text-muted-foreground">This note is private and stays on this device. It&rsquo;s never uploaded or shared.</p>
        <div className="flex gap-2">
          <Button className="flex-1" onClick={() => { void onSave({ id: entry?.id, date, text }); onClose(); }}>
            Save note
          </Button>
          {entry?.id && (
            confirmDel ? (
              <Button variant="danger" onClick={() => { void onDelete(entry.id); onClose(); }}>Confirm</Button>
            ) : (
              <Button variant="danger" onClick={() => setConfirmDel(true)} aria-label="Delete note">
                <Trash2 className="h-4 w-4" />
              </Button>
            )
          )}
        </div>
        {confirmDel && (
          <p className="text-center text-sm text-[var(--danger)]">Tap confirm to delete this note permanently.</p>
        )}
      </div>
    </Sheet>
  );
}