export type HabitDef = { id: string; name: string };

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
  updatedAt?: number;
};

export type Settings = {
  name: string;
  habits: HabitDef[];
};

export type AppData = {
  settings: Settings;
  days: Record<string, DayRecord>;
};
