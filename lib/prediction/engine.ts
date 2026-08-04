import type { Cycle, CyclePrediction, Settings, Confidence } from "@/types";
import { fullCycleLengths, median, medianAbsDev } from "@/lib/cycle/engine";
import { addDaysKey } from "@/lib/dates";

export const PREDICTION_ALGORITHM_VERSION = "1.0";

/**
 * Prediction engine.
 * Uses robust statistics (median + median absolute deviation) over the most
 * recent logged cycle lengths. Prefers median over mean to resist outliers.
 * Predictions are honest: confidence and a range widen with variability, and
 * nothing is ever presented as guaranteed.
 */
export function predict(
  cycles: Cycle[],
  settings: Pick<Settings, "typicalCycleLength">,
): CyclePrediction {
  const lengths = fullCycleLengths(cycles);
  const n = lengths.length;
  const reasons: string[] = [];

  if (!cycles.length) {
    return {
      available: false,
      confidence: "none",
      algorithmVersion: PREDICTION_ALGORITHM_VERSION,
      reasons: [
        "Your story is just beginning. Log your first period and Lantern will start learning your rhythm.",
      ],
    };
  }

  const lastStart =
    cycles[cycles.length - 1].start;
  let typicalLen: number;
  let source: string;

  if (n >= 3) {
    typicalLen = median(lengths);
    source = "average of your recent cycle lengths";
  } else if (n === 2) {
    typicalLen = median(lengths);
    source = "your first two cycles — we're starting to learn your pattern";
  } else if (n === 1) {
    if (settings.typicalCycleLength) {
      typicalLen = settings.typicalCycleLength;
      source = "the cycle length you entered, since we only have one cycle so far";
    } else {
      typicalLen = lengths[0];
      source = "your only recorded cycle — an early estimate";
    }
  } else {
    typicalLen = settings.typicalCycleLength ?? 28;
    source = "a common 28-day estimate, since no cycles are recorded yet";
  }

  const variability = n >= 2 ? medianAbsDev(lengths) : 0;

  // Confidence language based on data available + variability. Deliberately no
  // fabricated percentages.
  let confidence: Confidence = "none";
  if (n <= 1) confidence = "early";
  else if (variability >= 6) confidence = "early";
  else if (n <= 2) confidence = "moderate";
  else if (variability >= 3) confidence = "moderate";
  else confidence = "higher";

  reasons.push(`Based on ${source}.`);

  const estimatedDate = addDaysKey(lastStart, typicalLen);
  const halfWidth = Math.max(3, Math.round(variability * 1.25));
  const rangeStart = addDaysKey(estimatedDate, -halfWidth);
  const rangeEnd = addDaysKey(estimatedDate, +halfWidth);

  if (variability >= 4) {
    reasons.push(
      "Your cycle has varied recently, so your next period is harder to predict and may arrive over a wider range.",
    );
  }

  return {
    available: true,
    estimatedDate,
    rangeStart,
    rangeEnd,
    estimatedCycleLength: typicalLen,
    variability: Math.round(variability * 10) / 10,
    confidence,
    algorithmVersion: PREDICTION_ALGORITHM_VERSION,
    reasons,
    fullDays: n,
  };
}