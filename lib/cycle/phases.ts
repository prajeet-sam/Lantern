import type { CyclePrediction } from "@/types";
import { diffDays } from "@/lib/dates";

export type PhaseId = "menstrual" | "follicular" | "ovulation" | "luteal";

/**
 * Approximate day-of-cycle ovulation, using a ~14 day luteal phase.
 * Shared so the calendar, feed ring, and phase label never disagree.
 */
export function ovulationDay(len: number): number {
  return Math.max(1, Math.round(len - 14));
}

export interface PhaseEstimate {
  id: PhaseId;
  label: string;
  cycleDay?: number;
  explanation: string;
}

function lastStartAtOrBefore(starts: string[], date: string): string | undefined {
  let candidate: string | undefined;
  for (const s of starts) {
    if (date.localeCompare(s) >= 0) candidate = s;
    else break;
  }
  return candidate;
}

export function estimatePhase(
  starts: string[],
  date: string,
  prediction: CyclePrediction,
): PhaseEstimate | null {
  if (starts.length === 0) return null;
  const mildStart = lastStartAtOrBefore(starts, date);
  if (!mildStart) {
    return {
      id: "luteal",
      label: "Before your first log",
      explanation: "No logged period yet for this date.",
    };
  }
  const cycleDay = diffDays(date, mildStart) + 1;
  const len = prediction.estimatedCycleLength ?? 28;
  const ov = ovulationDay(len);

  if (cycleDay <= 5) {
    return {
      id: "menstrual",
      label: "Menstrual",
      cycleDay,
      explanation: "Estimated period — around your logged period.",
    };
  }
  if (cycleDay >= ov - 2 && cycleDay <= ov + 2) {
    return {
      id: "ovulation",
      label: "Estimated fertile window",
      cycleDay,
      explanation:
        "Calendar estimates can be inaccurate, especially with irregular cycles. This is not reliable contraception.",
    };
  }
  if (cycleDay < ov) {
    return {
      id: "follicular",
      label: "Follicular",
      cycleDay,
      explanation: "Estimated earlier half of your cycle.",
    };
  }
  return {
    id: "luteal",
    label: "Luteal",
    cycleDay,
    explanation: "Estimated latter half of your cycle, approaching your next period.",
  };
}