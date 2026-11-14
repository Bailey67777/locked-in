import type { HabitDef } from "./types";

/**
 * The ten, built from what Santa Cruz Medicinals repeats most for daily health. The top one is the must-do: days
 * it's missed get a slash on the calendar. Each has its own sound. Fixed ids, so two devices write the same list.
 */
export const DEFAULT_HABITS: HabitDef[] = [
  { id: "sc-nogoon", name: "No gooning", sound: "bell" },
  { id: "sc-sun", name: "Sunlight + water", sound: "glass" },
  { id: "sc-mobility", name: "10-min mobility", sound: "marimba" },
  { id: "sc-nophone", name: "No phone first hour", sound: "drop" },
  { id: "sc-protein", name: "Body weight in protein", sound: "pluck" },
  { id: "sc-steps", name: "10,000 steps", sound: "rise" },
  { id: "sc-train", name: "Lift or hard cardio", sound: "thud" },
  { id: "sc-food", name: "Real food only", sound: "knock" },
  { id: "sc-screens", name: "Screens off by 9", sound: "sonar" },
  { id: "sc-sleep", name: "In bed by 9:45", sound: "swish" },
];

/** The day the current run started: stats and the calendar count from here (moved from the 14th to the 15th). */
export const START_DATE = "2026-11-15";

/** Added on 14 November 2026, the day the run started: fourteen habits for the 14th. */
export const EXTRA_HABITS: HabitDef[] = [
  { id: "sc-grounding", name: "2 Minutes Grounding", sound: "bell" },
  { id: "sc-phone5", name: "No Phone Until 5pm", sound: "whistle" },
  { id: "sc-redlight", name: "Red Light >6pm", sound: "zap" },
  { id: "sc-posture", name: "Conscious Posture & Breathing", sound: "knock" },
];

/** Added on 15 November 2026 with a placeholder name, to be renamed in Settings: fifteen habits for the 15th. */
export const FIFTEENTH_HABIT: HabitDef = { id: "sc-15", name: "Habit 15", sound: "bell" };

/** Always exactly fifteen. */
export const MAX_HABITS = 15;

export const DEFAULT_NAME = "Hugo";

/** Colours you can give a habit. */
export const HABIT_COLORS: { name: string; hex: string }[] = [
  { name: "Ocean", hex: "#1a6fd1" },
  { name: "Teal", hex: "#1f9a8a" },
  { name: "Sunset", hex: "#d95f18" },
  { name: "Peach", hex: "#ef8a3c" },
  { name: "Lime", hex: "#5b8c00" },
  { name: "Grape", hex: "#6b4fbb" },
  { name: "Coral", hex: "#d9435f" },
  { name: "Sky", hex: "#3f9bd0" },
  { name: "Gold", hex: "#c99a06" },
  { name: "Slate", hex: "#46596a" },
];

export const DEFAULT_COLOR = "#1a6fd1";

/** Assigned round-robin to any habit that doesn't have its own emoji yet. Deliberately no checkmarks. */
export const AUTO_EMOJIS = [
  "🌊", "🔥", "⭐", "💪", "🎯", "📚", "🧠", "☀️", "🌙", "🏀",
  "🧘", "🍎", "💧", "🎧", "🐶", "🌳", "⏰", "🚶", "🎮", "😁",
];

export const EMOJI_SUGGESTIONS = [
  "🌅", "☀️", "🌊", "🏄", "🏀", "🏋️", "🏃", "🚴", "🧘", "🫁", "💧", "🥤", "🍳", "🥩", "🥗", "🍎",
  "📐", "📚", "✏️", "🧠", "🎯", "⏰", "📵", "🌙", "😴", "🛏️", "🕯️", "🧊", "🔥", "💪", "🧹", "🎧",
  "🎸", "🎮", "🐶", "🌳", "🚶", "🤝", "😁", "⭐",
];
