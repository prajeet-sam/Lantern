"use client";

import { useMemo } from "react";
import { useStore } from "@/lib/store";
import { deriveCycles, periodStarts } from "@/lib/cycle/engine";
import { predict } from "@/lib/prediction/engine";
import { estimatePhase } from "@/lib/cycle/phases";
import { todayKey, diffDays } from "@/lib/dates";
import type { Cycle, CyclePrediction } from "@/types";

export interface CycleContext {
  cycles: Cycle[];
  prediction: CyclePrediction;
  today: string;
  cycleDayToday?: number;
  todayHasPeriod: boolean;
  phase: ReturnType<typeof estimatePhase>;
  nextPeriodInDays?: number;
}

export function useCycle(): CycleContext {
  const { logs, settings } = useStore();
  const today = todayKey();

  return useMemo(() => {
    const cycles = deriveCycles(logs);
    const prediction = predict(cycles, settings) as CyclePrediction;
    const starts = periodStarts(cycles);

    const recentStarts = starts.filter((s) => s <= today);
    let cycleDayToday: number | undefined;
    let todayHasPeriod = false;
    if (recentStarts.length) {
      const last = recentStarts[recentStarts.length - 1];
      cycleDayToday = diffDays(today, last) + 1;
      todayHasPeriod = logs.some((l) => l.date === today && l.flow !== "none");
    }

    const phase = estimatePhase(starts, today, prediction);

    let nextPeriodInDays: number | undefined;
    if (prediction.available && prediction.estimatedDate) {
      nextPeriodInDays = diffDays(prediction.estimatedDate, today);
    }

    return {
      cycles,
      prediction,
      today,
      cycleDayToday,
      todayHasPeriod,
      phase,
      nextPeriodInDays,
    };
  }, [logs, settings, today]);
}