import type { CyclePrediction, CycleRegularity } from "@/types";

export const REGULARITY_OPTIONS: {
  id: CycleRegularity;
  label: string;
}[] = [
  { id: "very_regular", label: "Very regular" },
  { id: "mostly_regular", label: "Mostly regular" },
  { id: "somewhat_irregular", label: "Somewhat irregular" },
  { id: "very_irregular", label: "Very irregular" },
  { id: "not_sure", label: "I'm not sure" },
];

export const CONFIDENCE_LABEL: Record<CyclePrediction["confidence"], string> = {
  none: "No prediction yet",
  early: "Early estimate",
  moderate: "Moderate confidence",
  higher: "Higher confidence",
};

export const PHASE_COLORS: Record<
  string,
  { label: string; from: string; to: string }
> = {
  menstrual: { label: "Menstrual", from: "#6b4fa3", to: "#8a6bbf" },
  follicular: { label: "Follicular", from: "#d99a4e", to: "#e6b06a" },
  ovulation: { label: "Fertile window", from: "#e0b34e", to: "#f3c6a1" },
  luteal: { label: "Luteal", from: "#9a6bbf", to: "#c58aa9" },
};