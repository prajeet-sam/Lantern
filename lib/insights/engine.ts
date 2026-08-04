import type { CustomItem, DailyLog, Cycle } from "@/types";
import { median, mean } from "@/lib/cycle/engine";
import { deriveCycles, fullCycleLengths, countBy } from "@/lib/cycle/engine";
import { addDaysKey, diffDays } from "@/lib/dates";
import { getAllSymptoms, getAllMoods } from "@/lib/constants";

export interface Insight {
  id: string;
  observation: string;
  evidence: string;
  action?: string;
}

/** Rules-based insight engine. Transparent, non-diagnostic. */
export function generateInsights(
  rawLogs: DailyLog[],
  customItems: CustomItem[] = [],
): Insight[] {
  const cycles = deriveCycles(rawLogs);
  const logs = rawLogs.slice().sort((a, b) => a.date.localeCompare(b.date));
  const out: Insight[] = [];

  // Cycle consistency
  const lengths = fullCycleLengths(cycles);
  if (lengths.length >= 2) {
    const med = median(lengths);
    const lo = Math.min(...lengths);
    const hi = Math.max(...lengths);
    if (hi - lo <= 4) {
      out.push({
        id: "consistency",
        observation: `Your recent cycles have usually been around ${med} days.`,
        evidence: `Based on ${lengths.length} logged cycles (${lo}–${hi} days).`,
        action: "That's a fairly steady rhythm. Keep logging and estimates can stay personal to you.",
      });
    } else {
      out.push({
        id: "consistency-variable",
        observation:
          "Your recent cycle lengths have varied quite a bit.",
        evidence: `Over ${lengths.length} logged cycles, they ranged from ${lo} to ${hi} days.`,
        action:
          "This is common. If it feels unusually heavy on you or continues to concern you, it's worth a conversation with a healthcare professional.",
      });
    }
  }

  // Average period duration
  const durations = cycles
    .map((c) => c.periodDuration ?? 0)
    .filter(Boolean);
  if (durations.length >= 2) {
    const avg = Math.round(mean(durations) * 10) / 10;
    out.push({
      id: "duration",
      observation: `Your logged periods recently lasted around ${avg} days.`,
      evidence: `Based on ${durations.length} logged periods.`,
    });
  }

  // Symptom pattern during period days
  const periodDays = new Set<string>();
  for (const c of cycles) {
    let d = c.start;
    let i = 0;
    while (i < (c.periodDuration ?? 0)) {
      periodDays.add(d);
      d = addDaysKey(d, 1);
      i++;
    }
  }
  for (const sym of getAllSymptoms(customItems)) {
    const symLogs = logs.filter((l) => l.symptoms.includes(sym.id));
    if (symLogs.length === 0) continue;
    const symPeriod = symLogs.filter((l) => periodDays.has(l.date)).length;
    const pct = symLogs.length > 0 ? symPeriod / symLogs.length : 0;
    if (symLogs.length >= 2 && pct >= 0.4) {
      out.push({
        id: `symptom-${sym.id}`,
        observation: `${sym.label} appear${sym.label.endsWith("s") ? "" : "s"} in your logs more often on period days.`,
        evidence: `Logged on ${symPeriod} of ${symLogs.length} days where you recorded it.`,
        action:
          "If it's ever unusually severe or keeps interrupting your days, mention the pattern to a healthcare professional.",
      });
    }
  }

  // Low energy / low mood frequency
  const lowEnergy = logs.filter((l) => (l.energy ?? 0) <= 2);
  if (lowEnergy.length >= 3) {
    out.push({
      id: "energy",
      observation: "You've logged lower energy on several days.",
      evidence: `${lowEnergy.length} days with energy at 2 or below.`,
      action: "Low-energy days are a normal part of many cycles. Rest and gentleness are okay.",
    });
  }

  return out;
}

export interface CycleComparison {
  index: number;
  start: string;
  end: string;
  cycleLength?: number;
  periodDuration?: number;
  loggedDays: number;
  topMoods: { id: string; label: string; count: number; emoji?: string }[];
  topSymptoms: { id: string; label: string; count: number }[];
  avgFlowLabel: string;
}

const FLOW_LEVEL: Record<string, number> = { spotting: 1, light: 2, medium: 3, heavy: 4 };const FLOW_LEVEL_LABEL: Record<number, string> = { 1: "Spotting", 2: "Light", 3: "Medium", 4: "Heavy" };
const flowLevelLabel = (n: number) => FLOW_LEVEL_LABEL[n] ?? "Light";

/** Build a per-cycle summary table for the most recent cycles. */
export function compareCycles(
  rawLogs: DailyLog[],
  cycles: Cycle[],
  customItems: CustomItem[] = [],
  count = 4,
): CycleComparison[] {
  const logsByDate = new Map(rawLogs.map((l) => [l.date, l]));
  const moodLabels = new Map<string, { label: string; emoji?: string }>();
  const symptomLabels = new Map<string, string>();
  for (const m of getAllMoods(customItems)) moodLabels.set(m.id, { label: m.label, emoji: m.emoji });
  for (const s of getAllSymptoms(customItems)) symptomLabels.set(s.id, s.label);

  return cycles
    .slice(-count)
    .map((c) => {
      const dayKeys: string[] = [];
      let d = c.start;
      while (d <= (c.end ?? c.start)) {
        dayKeys.push(d);
        d = addDaysKey(d, 1);
      }
      const dayLogs = dayKeys.flatMap((k) => (logsByDate.get(k) ? [logsByDate.get(k)!] : []));
      const moodCounts = countBy(dayLogs.flatMap((l) => l.moods));
      const symptomCounts = countBy(dayLogs.flatMap((l) => l.symptoms));
      const flows = dayLogs.map((l) => FLOW_LEVEL[l.flow] ?? 0).filter((n) => n > 0);
      const avgFlow = flows.length ? mean(flows) : 0;

      return {
        index: c.index,
        start: c.start,
        end: c.end ?? c.start,
        cycleLength: c.cycleLength,
        periodDuration: c.periodDuration,
        loggedDays: dayLogs.length,
        topSymptoms: Object.entries(symptomCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([id, count]) => ({ id, label: symptomLabels.get(id) ?? id, count })),
        topMoods: Object.entries(moodCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([id, count]) => ({ id, ...(moodLabels.get(id) ?? { label: id }), count })),
        avgFlowLabel: avgFlow === 0 ? "—" : flowLevelLabel(Math.round(avgFlow)),
      };
    })
    .reverse();
}

export interface SymptomCorrelation {
  id: string;
  label: string;
  window: "before" | "during" | "after" | "spread";
  share: number; // 0..1 fraction of occurrences in the dominant window
  occurrences: number;
  description: string;
}

const WINDOW_DAYS = 5;

/**
 * Where does each symptom tend to sit relative to your period?
 * Windows: the 5 days before a period, the period itself, or the 5 days after.
 * Requires at least 3 occurrences and a clear majority in one window.
 */
export function findSymptomCorrelations(
  rawLogs: DailyLog[],
  customItems: CustomItem[] = [],
): SymptomCorrelation[] {
  const cycles = deriveCycles(rawLogs);
  const starts = cycles.map((c) => c.start);

  // Precompute period day sets per start
  const periodRuns = new Map<string, Set<string>>();
  const allPeriodDays = new Set<string>();
  for (const c of cycles) {
    const days = new Set<string>();
    let d = c.start;
    let i = 0;
    while (i < (c.periodDuration ?? 1)) {
      days.add(d);
      allPeriodDays.add(d);
      d = addDaysKey(d, 1);
      i++;
    }
    periodRuns.set(c.start, days);
  }

  const logs = rawLogs.slice().sort((a, b) => a.date.localeCompare(b.date));
  const symptomList = getAllSymptoms(customItems);
  const out: SymptomCorrelation[] = [];

  for (const sym of symptomList) {
    const entries: ("before" | "during" | "after")[] = [];
    let unclassified = 0;
    for (const l of logs) {
      if (!l.symptoms.includes(sym.id)) continue;
      let bucket: "before" | "during" | "after" | null = null;

      if (allPeriodDays.has(l.date)) {
        bucket = "during";
      } else {
        // Upcoming period start (smallest start on/after this date)
        let upcoming: string | undefined;
        for (const s of starts) {
          if (s >= l.date) {
            upcoming = s;
            break;
          }
        }
        if (upcoming) {
          const offset = diffDays(l.date, upcoming); // negative => before period
          if (offset < 0 && offset >= -WINDOW_DAYS) {
            bucket = "before";
          }
        }
        if (bucket === null) {
          // Right after a period: within WINDOW_DAYS of the previous run's last day
          let prev: string | undefined;
          for (const s of starts) {
            if (s <= l.date) prev = s;
            else break;
          }
          const prevRun = prev ? periodRuns.get(prev) : undefined;
          if (prevRun && prevRun.size > 0) {
            const lastDay = addDaysKey(prev!, prevRun.size - 1);
            const after = diffDays(l.date, lastDay);
            if (after > 0 && after <= WINDOW_DAYS) bucket = "after";
          }
        }
      }

      if (bucket) entries.push(bucket);
      else unclassified++;
    }

    const total = entries.length + unclassified;
    if (entries.length < 3 || total < 3) continue;

    const counts = countBy(entries);
    const best = (Object.entries(counts).sort((a, b) => b[1] - a[1])[0] ?? ["spread", 0]) as [string, number];
    const share = best[1] / total;
    if (share < 0.55) continue;

    const window = best[0] as SymptomCorrelation["window"];
    const verb = window === "during" ? "your period" : window === "before" ? `the ${WINDOW_DAYS} days before your period` : `the ${WINDOW_DAYS} days after your period`;
    out.push({
      id: `corr-${sym.id}`,
      label: sym.label,
      window,
      share,
      occurrences: entries.length,
      description: `Mostly around ${verb}`,
    });
  }

  return out.sort((a, b) => b.share - a.share).slice(0, 5);
}

export interface Milestone {
  id: string;
  emoji: string;
  title: string;
  detail: string;
}

/**
 * Gentle milestones — small acknowledgements of consistent tracking.
 * Computed from the data; nothing here is health advice.
 */
export function computeMilestones(
  rawLogs: DailyLog[],
  journalCount: number,
): Milestone[] {
  const cycles = deriveCycles(rawLogs);
  const logs = rawLogs.slice().sort((a, b) => a.date.localeCompare(b.date));
  const out: Milestone[] = [];

  if (logs.length > 0) {
    out.push({
      id: "first-log",
      emoji: "🌱",
      title: "You logged your first day",
      detail: "Every pattern starts with a single check-in.",
    });
  }

  if (cycles.length >= 2) {
    out.push({
      id: "two-cycles",
      emoji: "🔁",
      title: "Two periods tracked",
      detail: "That's enough for Lantern to start noticing your rhythm.",
    });
  }
  if (cycles.length >= 5) {
    out.push({
      id: "five-cycles",
      emoji: "🎉",
      title: "Five periods tracked",
      detail: "A solid picture of your usual rhythm is taking shape.",
    });
  }
  if (cycles.length >= 10) {
    out.push({
      id: "ten-cycles",
      emoji: "🌿",
      title: "Ten periods tracked",
      detail: "Ten cycles logged — a real personal archive.",
    });
  }

  // Check-in streak
  let streak = 0;
  let best = 0;
  for (let i = 0; i < logs.length; i++) {
    if (i > 0 && diffDays(logs[i].date, logs[i - 1].date) === 1) streak++;
    else streak = 1;
    if (streak > best) best = streak;
  }
  if (best >= 3) {
    out.push({
      id: "streak",
      emoji: "🔥",
      title: `${best}-day check-in streak`,
      detail: "Logging day after day is a gentle habit worth keeping.",
    });
  }

  if (journalCount >= 3) {
    out.push({
      id: "journal",
      emoji: "📖",
      title: `${journalCount} journal entries`,
      detail: "You're keeping a written record alongside your cycles.",
    });
  }

  return out;
}