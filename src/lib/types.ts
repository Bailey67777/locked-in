export type HabitDef = {
  id: string;
  name: string;
  emoji?: string; // e.g. "🌅"
  color?: string; // hex, e.g. "#1a6fd1"
  time?: string; // "HH:MM" — when in the day it happens; used for ordering
  sound?: string; // id from sounds.ts
};

export type DayHabit = { id: string; name: string; done: boolean };

export type Todo = { id: string; text: string; done: boolean };

/** 1–10, or 0 when not set yet. */
export type Ratings = { day: number; health: number; happy: number };

export type DayRecord = {
  date: string; // YYYY-MM-DD
  habits: DayHabit[]; // snapshot of the habit list for this day
  todos: Todo[];
  ratings: Ratings;
  journal: string;
  thumb?: string; // tiny JPEG data URL shown on the calendar
  updatedAt?: number;
};

export type Settings = {
  name: string;
  habits: HabitDef[];
  soundsOn: boolean;
  dayCompleteSound: string;
  todoSound: string;
};

export type AppData = {
  settings: Settings;
  days: Record<string, DayRecord>;
};
