export type HabitDef = {
  id: string;
  name: string;
  emoji?: string; // e.g. "🌅"
  color?: string; // hex, e.g. "#1a6fd1"
  time?: string; // "HH:MM" — when in the day it happens; used for ordering
  sound?: string; // id from sounds.ts
  /** Must-do habit: if it's missed, the submitted day drops straight to the bottom tier. */
  keystone?: boolean;
};

export type DayHabit = { id: string; name: string; done: boolean };

export type Todo = { id: string; text: string; done: boolean };

/** 1–10, or 0 when not set yet. */
export type Ratings = { day: number; health: number; happy: number };

/** One block in the rough day plan. */
export type PlanItem = {
  id: string;
  title: string;
  start: string; // "HH:MM"
  mins: number; // length in minutes
  color?: string;
  emoji?: string;
  done: boolean;
};

export type TierId = "t80" | "t50" | "t25" | "t0";

/** Written when the day is submitted (finalised). */
export type Submission = {
  at: number;
  pct: number;
  tier: TierId;
  keystoneMissed: boolean;
};

export type DayRecord = {
  date: string; // YYYY-MM-DD
  habits: DayHabit[]; // snapshot of the habit list for this day
  todos: Todo[];
  ratings: Ratings;
  journal: string;
  recall?: string; // active recall: everything learned / done, written from memory
  song?: string; // song of the day
  screenMinutes?: number; // phone screen time, typed in by hand
  plan?: PlanItem[];
  submitted?: Submission;
  thumb?: string; // tiny JPEG data URL shown on the calendar
  updatedAt?: number;
};

export type Countdown = {
  id: string;
  title: string;
  at: string; // local "YYYY-MM-DDTHH:MM"
  color: string;
  emoji?: string;
};

export type Reminders = {
  /** Browser notifications while the app is open (desktop / Android). */
  browser: boolean;
  /** Phone push through the free ntfy app. Off unless a topic is set and this is on. */
  ntfy: boolean;
  ntfyTopic: string;
  /** Evening nudge to submit the day, "HH:MM". */
  submitTime: string;
};

export type Settings = {
  name: string;
  habits: HabitDef[];
  soundsOn: boolean;
  dayCompleteSound: string;
  todoSound: string;
  countdowns: Countdown[];
  reminders: Reminders;
};

export type AppData = {
  settings: Settings;
  days: Record<string, DayRecord>;
};
