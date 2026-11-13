import type { HabitDef } from "./types";

/**
 * The ten, built from what Santa Cruz Medicinals repeats most for daily health: morning light and water, a
 * 10-minute mobility routine, protein, 10,000 steps, lifting, real food, no gooning, screens off and an early night.
 * Fixed ids, so two devices switching over at once write the same list. Fully editable in Settings.
 */
export const DEFAULT_HABITS: HabitDef[] = [
  { id: "sc-sun", name: "Sunlight + water", time: "07:00" },
  { id: "sc-mobility", name: "10-min mobility", time: "07:15" },
  { id: "sc-nophone", name: "No phone first hour" },
  { id: "sc-protein", name: "Body weight in protein" },
  { id: "sc-steps", name: "10,000 steps" },
  { id: "sc-train", name: "Lift or hard cardio" },
  { id: "sc-food", name: "Real food only" },
  { id: "sc-nogoon", name: "No gooning" },
  { id: "sc-screens", name: "Screens off by 9", time: "21:00" },
  { id: "sc-sleep", name: "In bed by 9:45", time: "21:45" },
];

/** The app is built around ten. */
export const MAX_HABITS = 10;

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
