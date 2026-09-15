import type { HabitDef } from "./types";

/**
 * The six daily non-negotiables, in the order they happen across a day.
 * Fully editable in Settings; this is only the starting point.
 */
export const DEFAULT_HABITS: HabitDef[] = [
  { id: "wake-outside", name: "Up on time, outside with water before the phone", emoji: "🌅", color: "#ef8a3c", time: "06:50", sound: "chime" },
  { id: "mobility", name: "10 min mobility + slow breathing", emoji: "🧘", color: "#1f9a8a", time: "07:00", sound: "bubble" },
  { id: "move", name: "Train or move: basketball, gym or a real walk", emoji: "🏀", color: "#d95f18", time: "16:00", sound: "coin" },
  { id: "real-food", name: "Real meals, no rules, no guilt", emoji: "🍳", color: "#5b8c00", time: "18:00", sound: "pop" },
  { id: "study-block", name: "One focused study block, phone in another room", emoji: "📐", color: "#1a6fd1", time: "19:00", sound: "levelup" },
  { id: "wind-down", name: "Dim evening, phone out of the bedroom, lights out on time", emoji: "🌙", color: "#6b4fbb", time: "21:30", sound: "ding" },
];

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
