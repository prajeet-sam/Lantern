"use client";

import { useState } from "react";
import type { FlowLevel, MoodId, SymptomId } from "@/types";
import { useStore } from "@/lib/store";
import { getAllMoods, getAllSymptoms, FLOW_LEVELS } from "@/lib/constants";
import { formatPretty } from "@/lib/dates";
import { Button, Chip } from "@/components/ui";
import { Sheet } from "@/components/sheet";
import { Droplet, Activity } from "lucide-react";

export function CheckInSheet({
  date,
  open,
  onClose,
}: {
  date: string;
  open: boolean;
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <Sheet open={!!open} onClose={onClose} title={`Check in · ${formatPretty(date)}`}>
      {/* key resets local state whenever the picked date changes */}
      <CheckInForm key={date} date={date} onClose={onClose} />
    </Sheet>
  );
}

function CheckInForm({ date, onClose }: { date: string; onClose: () => void }) {
  const { getLog, upsertLog, settings } = useStore();
  const existing = getLog(date);
  const [flow, setFlow] = useState<FlowLevel>(existing?.flow ?? "none");
  const [moods, setMoods] = useState<MoodId[]>(existing?.moods ?? []);
  const [symptoms, setSymptoms] = useState<SymptomId[]>(existing?.symptoms ?? []);
  const [energy, setEnergy] = useState<number | undefined>(existing?.energy);
  const [stress, setStress] = useState<number | undefined>(existing?.stress);

  const customItems = settings.customItems ?? [];
  const moodsList = getAllMoods(customItems);
  const symptomsList = getAllSymptoms(customItems);

  const dirty = existing
    ? flow !== existing.flow ||
      JSON.stringify(moods) !== JSON.stringify(existing.moods) ||
      JSON.stringify(symptoms) !== JSON.stringify(existing.symptoms) ||
      energy !== existing.energy ||
      stress !== existing.stress
    : flow !== "none" || moods.length || symptoms.length || !!(energy || stress);

  async function save() {
    if (dirty) {
      await upsertLog(date, { flow, moods, symptoms, energy, stress });
    }
    onClose();
  }

  return (
    <div className="space-y-5">
      <section>
        <div className="mb-2 flex items-center gap-1.5 text-sm font-medium text-foreground">
          <Droplet className="h-4 w-4 text-[var(--rose)]" /> Flow
        </div>
        <div className="flex flex-wrap gap-2">
          {FLOW_LEVELS.map((f) => (
            <Chip key={f.id} active={flow === f.id} onClick={() => setFlow(f.id)}>
              {f.label}
            </Chip>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-2 text-sm font-medium text-foreground">Mood</div>
        <div className="flex flex-wrap gap-2">
          {moodsList.map((m) => (
            <Chip key={m.id} active={moods.includes(m.id)} onClick={() => setMoods(toggle(moods, m.id))}>
              {m.emoji ? `${m.emoji} ` : ""}{m.label}
            </Chip>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-2 flex items-center gap-1.5 text-sm font-medium text-foreground">
          <Activity className="h-4 w-4 text-[var(--accent)]" /> Symptoms
          <span className="text-xs text-muted-foreground">(optional)</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {symptomsList.map((s) => (
            <Chip key={s.id} active={symptoms.includes(s.id)} onClick={() => setSymptoms(toggle(symptoms, s.id))}>
              {s.label}
            </Chip>
          ))}
        </div>
      </section>

      <section className="grid grid-cols-2 gap-4">
        {(
          [
            ["Energy", energy, setEnergy],
            ["Stress", stress, setStress],
          ] as const
        ).map(([label, val, set]) => (
          <div key={label}>
            <div className="mb-2 text-sm font-medium text-foreground">{label}</div>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  onClick={() => set(val === n ? undefined : n)}
                  aria-pressed={val === n}
                  className={`h-9 w-9 rounded-full text-xs font-semibold transition-all ${
                    val === n
                      ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                      : "bg-[var(--secondary)]/50 text-[var(--secondary-foreground)] hover:bg-[var(--secondary)]"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        ))}
      </section>

      <p className="rounded-2xl bg-[var(--secondary)]/40 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
        Lantern doesn&apos;t interpret these as a diagnosis — it just notices patterns that belong to you. Nothing here is shared or uploaded.
      </p>

      <Button className="w-full" size="lg" onClick={save}>
        {moods.length || flow !== "none" ? "Save check-in ✨" : "Done"}
      </Button>
      <div className="h-2" />
    </div>
  );
}

function toggle<T>(arr: T[], v: T): T[] {
  return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];
}