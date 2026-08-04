import type { BuiltInMoodId, BuiltInSymptomId, CustomItem, FlowLevel, MoodId, SymptomId } from "@/types";

export const FLOW_LEVELS: { id: FlowLevel; label: string; level: number }[] = [
  { id: "none", label: "None", level: 0 },
  { id: "spotting", label: "Spotting", level: 1 },
  { id: "light", label: "Light", level: 2 },
  { id: "medium", label: "Medium", level: 3 },
  { id: "heavy", label: "Heavy", level: 4 },
];

export const BUILTIN_MOODS: { id: BuiltInMoodId; label: string; emoji?: string }[] = [
  { id: "happy", label: "Happy" },
  { id: "calm", label: "Calm" },
  { id: "energetic", label: "Energetic" },
  { id: "low", label: "Low" },
  { id: "irritated", label: "Irritated" },
  { id: "anxious", label: "Anxious" },
  { id: "emotional", label: "Emotional" },
  { id: "tired", label: "Tired" },
];

export const BUILTIN_SYMPTOMS: { id: BuiltInSymptomId; label: string }[] = [
  { id: "cramps", label: "Cramps" },
  { id: "headache", label: "Headache" },
  { id: "backache", label: "Backache" },
  { id: "bloating", label: "Bloating" },
  { id: "acne", label: "Acne" },
  { id: "breast_tenderness", label: "Breast tenderness" },
  { id: "fatigue", label: "Fatigue" },
  { id: "nausea", label: "Nausea" },
  { id: "food_cravings", label: "Food cravings" },
  { id: "appetite_changes", label: "Appetite changes" },
  { id: "pelvic_discomfort", label: "Pelvic discomfort" },
  { id: "other", label: "Other" },
];

export const SYMPTOM_ICONS: Record<BuiltInSymptomId, string> = {
  cramps: "activity",
  headache: "brain",
  backache: "bone",
  bloating: "circle-dot",
  acne: "sparkles",
  breast_tenderness: "heart",
  fatigue: "battery-low",
  nausea: "dizzy",
  food_cravings: "cookie",
  appetite_changes: "utensils",
  pelvic_discomfort: "cross",
  other: "more-horizontal",
};

/** Build a slug for custom IDs: lowercase, alphanumeric + hyphen. */
export function customSlug(label: string): string {
  return "custom:" + label
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

/** Check if an ID is a custom item. */
export function isCustomId(id: string): boolean {
  return id.startsWith("custom:");
}

/** Get the display label for any mood (built-in or custom). */
export function moodLabel(id: string, customItems: CustomItem[] = []): string {
  if (isCustomId(id)) {
    const custom = customItems.find((c) => c.id === id && c.type === "mood");
    return custom?.label ?? id.replace("custom:", "");
  }
  const m = BUILTIN_MOODS.find((x) => x.id === id);
  return m ? m.label : id;
}

/** Get the display label for any symptom (built-in or custom). */
export function symptomLabel(id: string, customItems: CustomItem[] = []): string {
  if (isCustomId(id)) {
    const custom = customItems.find((c) => c.id === id && c.type === "symptom");
    return custom?.label ?? id.replace("custom:", "");
  }
  const s = BUILTIN_SYMPTOMS.find((x) => x.id === id);
  return s ? s.label : id;
}

/** Get the emoji for a mood (built-in or custom). */
export function moodEmoji(id: MoodId, customItems: CustomItem[] = []): string | undefined {
  if (isCustomId(id)) {
    const custom = customItems.find((c) => c.id === id && c.type === "mood");
    return custom?.emoji;
  }
  const m = BUILTIN_MOODS.find((x) => x.id === id);
  return m?.emoji;
}

/** Get all moods (built-in + custom) for rendering chips. */
export function getAllMoods(customItems: CustomItem[] = []): { id: MoodId; label: string; emoji?: string }[] {
  const customMoods = customItems.filter((c) => c.type === "mood").map((c) => ({
    id: c.id as MoodId,
    label: c.label,
    emoji: c.emoji,
  }));
  return [...BUILTIN_MOODS, ...customMoods];
}

/** Get all symptoms (built-in + custom) for rendering chips. */
export function getAllSymptoms(customItems: CustomItem[] = []): { id: SymptomId; label: string }[] {
  const customSymptoms = customItems.filter((c) => c.type === "symptom").map((c) => ({
    id: c.id as SymptomId,
    label: c.label,
  }));
  return [...BUILTIN_SYMPTOMS, ...customSymptoms];
}

export function flowLabel(id: FlowLevel): string {
  const f = FLOW_LEVELS.find((x) => x.id === id);
  return f ? f.label : "None";
}

// Backward-compatible exports (used in validation, insights, etc.)
export const MOODS = BUILTIN_MOODS;
export const SYMPTOMS = BUILTIN_SYMPTOMS;

export const DEFAULT_SETTINGS: Omit<Record<string, unknown>, "onboardingComplete"> = {}; // settings defaults live in storage/settings.ts