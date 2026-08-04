// Lantern shared types

export type FlowLevel = "none" | "spotting" | "light" | "medium" | "heavy";

export type BuiltInMoodId =
  | "happy"
  | "calm"
  | "energetic"
  | "low"
  | "irritated"
  | "anxious"
  | "emotional"
  | "tired";

export type BuiltInSymptomId =
  | "cramps"
  | "headache"
  | "backache"
  | "bloating"
  | "acne"
  | "breast_tenderness"
  | "fatigue"
  | "nausea"
  | "food_cravings"
  | "appetite_changes"
  | "pelvic_discomfort"
  | "other";

/** Union of built-in + custom (custom ids are arbitrary strings prefixed with "custom:") */
export type MoodId = BuiltInMoodId | `custom:${string}`;
export type SymptomId = BuiltInSymptomId | `custom:${string}`;

export type ThemeMode = "light" | "dark" | "system";

export type CycleRegularity =
  | "very_regular"
  | "mostly_regular"
  | "somewhat_irregular"
  | "very_irregular"
  | "not_sure";

export type Confidence = "none" | "early" | "moderate" | "higher";

/** A custom tracking item defined by the user. */
export interface CustomItem {
  id: string; // "custom:slugified-label"
  label: string;
  emoji?: string;
  type: "mood" | "symptom" | "tag";
  createdAt: string;
}

/** A single day's log. date is a local calendar day, 'YYYY-MM-DD'. */
export interface DailyLog {
  date: string;
  flow: FlowLevel;
  moods: MoodId[];
  symptoms: SymptomId[];
  energy?: number;
  stress?: number;
  updatedAt: string;
}

export interface JournalEntry {
  id: string;
  date: string;
  text: string;
  moods: MoodId[];
  symptoms: SymptomId[];
  createdAt: string;
  updatedAt: string;
}

/** A computed cycle, derived from period runs in daily logs. */
export interface Cycle {
  index: number;
  start: string; // local date of day 1 (first flow day)
  end?: string; // last flow day of the run
  cycleLength?: number; // days from this start to the next start
  periodDuration?: number; // days in the period run
}

export interface CyclePrediction {
  available: boolean;
  estimatedDate?: string;
  rangeStart?: string;
  rangeEnd?: string;
  estimatedCycleLength?: number;
  variability?: number;
  confidence: Confidence;
  algorithmVersion: string;
  reasons: string[];
  fullDays?: number;
}

export interface Settings {
  lastPeriodStart?: string;
  typicalCycleLength?: number | null;
  typicalPeriodDuration?: number | null;
  regularity?: CycleRegularity;
  displayName?: string;
  theme: ThemeMode;
  firstDayOfWeek: number;
  notifyPeriod: boolean;
  notifyCheckIn: boolean;
  notifyFlow: boolean;
  notificationPrivacy: "private" | "detailed";
  reminderTimeCheckIn: string;
  reminderTimePeriod: string;
  reducedMotion: boolean;
  highContrast: boolean;
  onboardingComplete: boolean;
  onboardedAt?: string;
  autoLockMinutes?: number | null;
  blurOnHide?: boolean;
  customItems: CustomItem[];
}