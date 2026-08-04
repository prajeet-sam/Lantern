"use client";

import type { Cycle, CustomItem, DailyLog } from "@/types";
import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { useCycle } from "@/lib/use-cycle";
import { generateInsights, compareCycles, findSymptomCorrelations, computeMilestones, type Milestone } from "@/lib/insights/engine";
import { EmptyState, Card, Button } from "@/components/ui";
import { Info, Sparkles, BarChart2, Heart, GitCompare, Droplet, Radar, Trophy } from "lucide-react";
import { getAllSymptoms } from "@/lib/constants";
import { addDaysKey } from "@/lib/dates";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export function InsightsView() {
  const { logs, settings, journals } = useStore();
  const ctx = useCycle();

  const insights = useMemo(() => generateInsights(logs, settings.customItems), [logs, settings.customItems]);
  const milestones = useMemo(() => computeMilestones(logs, journals.length), [logs, journals.length]);
  const hasHistory = ctx.cycles.length > 0;

  return (
    <div className="mx-auto w-full max-w-md space-y-5">
      <header className="px-1 pt-2">
        <h1 className="font-display text-2xl font-semibold text-foreground">Insights</h1>
        <p className="text-sm text-muted-foreground">Patterns Lantern has noticed — not a diagnosis.</p>
      </header>

      {!hasHistory && (
        <EmptyState
          icon={<Sparkles className="h-6 w-6" />}
          title="Nothing to notice yet"
          subtitle="Once you've logged a few cycles, Lantern can surface gentle patterns."
        />
      )}

      {hasHistory && (
        <>
          {/* Milestones */}
          {milestones.length > 0 && <MilestoneCard milestones={milestones} />}

          {/* Short overview */}
          <Card className="p-5">
            <div className="font-display text-lg font-semibold text-foreground">Recent rhythm</div>
            <div className="mt-2 grid grid-cols-3 gap-2 text-center">
              <Stat label="Cycles" value={String(ctx.cycles.length)} />
              <Stat label="Avg length" value={ctx.prediction.estimatedCycleLength ? `~${ctx.prediction.estimatedCycleLength}d` : "—"} />
              <Stat label="Variability" value={ctx.prediction.variability ? `${ctx.prediction.variability}d` : "—"} />
            </div>
          </Card>

          {/* Cycle length trend */}
          <CycleTrendChart cycles={ctx.cycles} />

          {/* Cycle comparison */}
          {ctx.cycles.length >= 1 && <CycleComparisonCard logs={logs} cycles={ctx.cycles} customItems={settings.customItems} />}

          {/* Symptom ↔ cycle correlations */}
          {ctx.cycles.length >= 1 && <CorrelationCard logs={logs} customItems={settings.customItems} />}

          {/* Symptoms worth mentioning */}
          <SymptomSummaryCard logs={logs} cycles={ctx.cycles} customItems={settings.customItems} />

          <div className="space-y-3">
            {insights.length === 0 && (
              <EmptyState icon={<Sparkles className="h-6 w-6" />} title="No insights yet" subtitle="More data will reveal gentle patterns over time." />
            )}
            {insights.map((ins) => (
              <Card key={ins.id} className="p-5">
                <div className="flex items-start gap-3">
                  <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[var(--accent)]" />
                  <div>
                    <p className="font-medium leading-snug text-foreground">{ins.observation}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{ins.evidence}</p>
                    {ins.action && <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{ins.action}</p>}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      <div className="flex items-start gap-2 rounded-2xl bg-[var(--secondary)]/40 p-4 text-sm text-muted-foreground">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-[var(--rose)]" />
        <p className="leading-relaxed">
          Lantern notices patterns in what you log. It cannot diagnose conditions. If a pattern worries you or something
          feels unusually off, please talk with a healthcare professional.
        </p>
      </div>
      <div className="h-20" />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-display text-2xl font-bold text-foreground">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function MilestoneCard({ milestones }: { milestones: Milestone[] }) {
  const [collapsed, setCollapsed] = useState(true);
  const visible = collapsed ? milestones.slice(0, 3) : milestones;

  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 mb-3">
        <Trophy className="h-5 w-5 text-[var(--accent)]" />
        <span className="font-display text-lg font-semibold text-foreground">Little wins</span>
      </div>
      <div className="space-y-2">
        {visible.map((m) => (
          <div key={m.id} className="flex items-start gap-3 rounded-xl bg-[var(--secondary)]/40 px-3 py-2.5">
            <span className="text-xl leading-none">{m.emoji}</span>
            <div>
              <p className="text-sm font-medium text-foreground">{m.title}</p>
              <p className="text-xs text-muted-foreground">{m.detail}</p>
            </div>
          </div>
        ))}
      </div>
      {milestones.length > 3 && (
        <Button variant="ghost" size="sm" className="mt-3 w-full" onClick={() => setCollapsed((c) => !c)}>
          {collapsed ? `Show ${milestones.length - 3} more` : "Show fewer"}
        </Button>
      )}
    </Card>
  );
}

function CorrelationCard({
  logs,
  customItems,
}: {
  logs: DailyLog[];
  customItems: CustomItem[];
}) {
  const correlations = useMemo(() => findSymptomCorrelations(logs, customItems), [logs, customItems]);

  if (correlations.length === 0) return null;

  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 mb-3">
        <Radar className="h-5 w-5 text-[var(--rose)]" />
        <span className="font-display text-lg font-semibold text-foreground">When things tend to show up</span>
      </div>
      <p className="text-sm text-muted-foreground mb-3">
        A pattern, not a prediction. Based only on the days you chose to log.
      </p>
      <ul className="space-y-2">
        {correlations.map((c) => (
          <li key={c.id} className="flex items-center justify-between gap-3 rounded-xl bg-[var(--secondary)]/40 px-3 py-2">
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">{c.label}</p>
              <p className="text-xs text-muted-foreground">{c.description}</p>
            </div>
            <span className="shrink-0 rounded-full bg-[var(--peach)]/15 px-2 py-0.5 text-xs font-medium text-[var(--peach)]">
              {Math.round(c.share * 100)}% of {c.occurrences} logs
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function CycleComparisonCard({
  logs,
  cycles,
  customItems,
}: {
  logs: { date: string; flow: string; moods: string[]; symptoms: string[] }[];
  cycles: Cycle[];
  customItems: CustomItem[];
}) {
  const comparisons = useMemo(() => compareCycles(logs as never, cycles, customItems, 4), [logs, cycles, customItems]);

  if (comparisons.length === 0) return null;

  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 mb-3">
        <GitCompare className="h-5 w-5 text-[var(--accent)]" />
        <span className="font-display text-lg font-semibold text-foreground">Cycle by cycle</span>
      </div>
      <p className="text-sm text-muted-foreground mb-3">
        A glance at your recent cycles — just the numbers you logged, side by side.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="py-1 pr-3 font-medium">Cycle</th>
              <th className="py-1 pr-3 font-medium">Length</th>
              <th className="py-1 pr-3 font-medium">Period</th>
              <th className="py-1 pr-3 font-medium">Flow</th>
              <th className="py-1 pr-3 font-medium">Moods</th>
              <th className="py-1 font-medium">Symptoms</th>
            </tr>
          </thead>
          <tbody>
            {comparisons.map((c) => (
              <tr key={c.start} className="border-t border-[var(--border)]/60 align-top">
                <td className="py-2.5 pr-3 whitespace-nowrap">
                  <span className="font-medium text-foreground">{c.index}</span>
                  <div className="text-xs text-muted-foreground">
                    {c.start.slice(5).replace("-", "/")}–{c.end.slice(5).replace("-", "/")}
                  </div>
                </td>
                <td className="py-2.5 pr-3 whitespace-nowrap text-foreground">{c.cycleLength ? `${c.cycleLength}d` : "…"}</td>
                <td className="py-2.5 pr-3 whitespace-nowrap text-foreground">{c.periodDuration ? `${c.periodDuration}d` : "—"}</td>
                <td className="py-2.5 pr-3 whitespace-nowrap text-foreground">{c.avgFlowLabel}</td>
                <td className="py-2.5 pr-3">
                  {c.topMoods.length ? (
                    <div className="flex flex-wrap gap-1">
                      {c.topMoods.map((m) => (
                        <span key={m.id} className="rounded-full bg-[var(--secondary)]/50 px-2 py-0.5 text-xs text-[var(--secondary-foreground)]">
                          {m.emoji ? `${m.emoji} ` : ""}{m.label}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </td>
                <td className="py-2.5">
                  {c.topSymptoms.length ? (
                    <div className="flex flex-wrap gap-1">
                      {c.topSymptoms.map((s) => (
                        <span key={s.id} className="rounded-full bg-[var(--peach)]/15 px-2 py-0.5 text-xs text-[var(--peach)]">
                          {s.label}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex items-start gap-2 text-xs text-muted-foreground">
        <Droplet className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--rose)]" />
        <span>Flow is the most common logged intensity. Length only appears once a following period is logged.</span>
      </div>
    </Card>
  );
}

function CycleTrendChart({
  cycles,
}: {
  cycles: { start: string; cycleLength?: number }[];
}) {
  const data = useMemo(() => {
    const withLength = cycles.filter((c): c is { start: string; cycleLength: number } => typeof c.cycleLength === "number");
    return withLength.map((c, i) => ({
      cycle: i + 1,
      start: c.start,
      length: c.cycleLength,
    }));
  }, [cycles]);

  if (data.length < 2) return null;

  const minLen = Math.max(20, Math.min(...data.map((d) => d.length)) - 5);
  const maxLen = Math.min(50, Math.max(...data.map((d) => d.length)) + 5);

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <BarChart2 className="h-5 w-5 text-[var(--accent)]" />
          <span className="font-display text-lg font-semibold text-foreground">Cycle length trend</span>
        </div>
        <span className="text-xs text-muted-foreground">
          Based on {data.length} completed cycle{data.length === 1 ? "" : "s"}
        </span>
      </div>
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 5, left: -10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis
              dataKey="cycle"
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              axisLine={{ stroke: "var(--border)" }}
            />
            <YAxis
              domain={[minLen, maxLen]}
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{
                background: "var(--card)",
                border: "1px solid var(--border)",
                borderRadius: "0.75rem",
              }}
              labelFormatter={(v) => `Cycle ${v}`}
              formatter={(v) => [`${v} days`, "Length"]}
            />
            <Line
              type="monotone"
              dataKey="length"
              stroke="var(--primary)"
              strokeWidth={2.5}
              dot={{ r: 4, strokeWidth: 2, fill: "var(--card)", stroke: "var(--primary)" }}
              activeDot={{ r: 6, strokeWidth: 2 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

function SymptomSummaryCard({
  logs,
  cycles,
  customItems,
}: {
  logs: { date: string; symptoms: string[]; flow: string }[];
  cycles: { start: string; end?: string; periodDuration?: number }[];
  customItems: import("@/types").CustomItem[];
}) {
  // Build a set of all period days across cycles
  const periodDays = useMemo(() => {
    const days = new Set<string>();
    for (const c of cycles) {
      let d = c.start;
      let i = 0;
      const dur = c.periodDuration ?? 0;
      while (i < dur) {
        days.add(d);
        d = addDaysKey(d, 1);
        i++;
      }
    }
    return days;
  }, [cycles]);

  // Count symptom occurrences on period days vs total
  const symptomStats = useMemo(() => {
    const stats: Record<string, { total: number; onPeriod: number; label: string }> = {};
    for (const sym of getAllSymptoms(customItems)) {
      stats[sym.id] = { total: 0, onPeriod: 0, label: sym.label };
    }
    for (const l of logs) {
      for (const s of l.symptoms) {
        if (stats[s]) {
          stats[s].total++;
          if (periodDays.has(l.date)) stats[s].onPeriod++;
        }
      }
    }
    return stats;
  }, [logs, periodDays, customItems]);

  // Filter to symptoms logged at least twice, and on period >= 40% of occurrences
  const notable = Object.entries(symptomStats)
    .filter(([, v]) => v.total >= 2 && v.onPeriod / v.total >= 0.4)
    .sort((a, b) => b[1].onPeriod - a[1].onPeriod);

  if (notable.length === 0) return null;

  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 mb-3">
        <Heart className="h-5 w-5 text-[var(--rose)]" />
        <span className="font-display text-lg font-semibold text-foreground">Symptoms worth mentioning</span>
      </div>
      <p className="text-sm text-muted-foreground mb-3">
        These show up noticeably on your period days. If any feel unusually severe or
        disruptive, it can help to bring them up with a healthcare professional.
      </p>
      <ul className="space-y-2">
        {notable.slice(0, 6).map(([id, v]) => (
          <li key={id} className="flex items-center justify-between text-sm">
            <span className="text-foreground">{v.label}</span>
            <span className="text-xs text-muted-foreground">
              {v.onPeriod} of {v.total} logged days on period
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}