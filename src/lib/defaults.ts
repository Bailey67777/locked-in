import type { HabitDef } from "./types";

/**
 * The six daily non-negotiables, in the order they happen across a day.
 * Fully editable in Settings; this is only the starting point.
 */
export const DEFAULT_HABITS: HabitDef[] = [
  { id: "wake-outside", name: "Up on time, outside with water before the phone" },
  { id: "mobility", name: "10 min mobility + slow breathing" },
  { id: "move", name: "Train or move: basketball, gym or a real walk" },
  { id: "real-food", name: "Real meals, no rules, no guilt" },
  { id: "study-block", name: "One focused study block, phone in another room" },
  { id: "wind-down", name: "Dim evening, phone out of the bedroom, lights out on time" },
];

export const DEFAULT_NAME = "Hugo";

export const ONE_LINERS = [
  "Outside first. Phone last.",
  "Confidence is evidence. Today is a deposit.",
  "The basics, done boringly, beat everything.",
  "Do the block. Then enjoy the evening.",
  "Comfort is the trap. Pick the harder rep.",
  "Bright mornings, dark evenings, same bedtime.",
  "Real food, real friends, real dopamine.",
  "Six things. Nothing else. Every day.",
  "Grade the day on the process, not the future.",
  "No hacks needed. Just the reps.",
  "Water, sky, breath. Then the day can start.",
  "Show up early, warm up properly, play to get better.",
  "Hard things feel good afterwards. That is the point.",
  "One honest effort beats three half ones.",
];

export function oneLinerFor(dateKey: string): string {
  let h = 0;
  for (let i = 0; i < dateKey.length; i++) h = (h * 31 + dateKey.charCodeAt(i)) >>> 0;
  return ONE_LINERS[h % ONE_LINERS.length];
}
