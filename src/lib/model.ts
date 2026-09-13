import type { AppData, DayHabit, DayRecord, Settings, Todo } from "./types";
import { DEFAULT_HABITS, DEFAULT_NAME } from "./defaults";

export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

export function emptyDay(date: string): DayRecord {
  return { date, habits: [], todos: [], ratings: { day: 0, health: 0, happy: 0 }, journal: "" };
}

function asArray<T>(v: unknown): T[] {
  if (Array.isArray(v)) return v.filter(Boolean) as T[];
  if (v && typeof v === "object") return Object.values(v as Record<string, T>).filter(Boolean);
  return [];
}

function clampRating(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(10, Math.round(n)));
}

export function normalizeDay(date: string, raw: unknown): DayRecord {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const ratings = (r.ratings && typeof r.ratings === "object" ? r.ratings : {}) as Record<string, unknown>;
  return {
    date,
    habits: asArray<Partial<DayHabit>>(r.habits)
      .filter((h) => typeof h.id === "string")
      .map((h) => ({ id: h.id as string, name: String(h.name ?? ""), done: Boolean(h.done) })),
    todos: asArray<Partial<Todo>>(r.todos)
      .filter((t) => typeof t.id === "string")
      .map((t) => ({ id: t.id as string, text: String(t.text ?? ""), done: Boolean(t.done) })),
    ratings: {
      day: clampRating(ratings.day),
      health: clampRating(ratings.health),
      happy: clampRating(ratings.happy),
    },
    journal: typeof r.journal === "string" ? r.journal : "",
    updatedAt: typeof r.updatedAt === "number" ? r.updatedAt : undefined,
  };
}

export function normalizeSettings(raw: unknown): Settings {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const habits = asArray<Partial<DayHabit>>(r.habits)
    .filter((h) => typeof h.id === "string" && typeof h.name === "string")
    .map((h) => ({ id: h.id as string, name: h.name as string }));
  return {
    name: typeof r.name === "string" && r.name.trim() ? r.name : DEFAULT_NAME,
    habits: habits.length ? habits : DEFAULT_HABITS.map((h) => ({ ...h })),
  };
}

export function normalizeData(raw: unknown): AppData {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const daysRaw = (r.days && typeof r.days === "object" ? r.days : {}) as Record<string, unknown>;
  const days: Record<string, DayRecord> = {};
  for (const key of Object.keys(daysRaw)) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(key)) days[key] = normalizeDay(key, daysRaw[key]);
  }
  return { settings: normalizeSettings(r.settings), days };
}

/**
 * The day as it should be displayed.
 * Today and future days follow the current habit list (names/order/additions apply going forward),
 * keeping any ticks already made. Past days keep their own snapshot so history is never rewritten.
 */
export function materializeDay(
  date: string,
  stored: DayRecord | undefined,
  settings: Settings,
  today: string,
): DayRecord {
  const base = stored ?? emptyDay(date);
  let habits: DayHabit[];
  if (date >= today || base.habits.length === 0) {
    const done = new Map(base.habits.map((h) => [h.id, h.done] as const));
    habits = settings.habits.map((h) => ({ id: h.id, name: h.name, done: done.get(h.id) ?? false }));
  } else {
    habits = base.habits;
  }
  return { ...base, habits };
}

export function dayProgress(day: DayRecord): { done: number; total: number; pct: number } {
  const total = day.habits.length + day.todos.length;
  const done = day.habits.filter((h) => h.done).length + day.todos.filter((t) => t.done).length;
  return { done, total, pct: total === 0 ? 0 : Math.round((done / total) * 100) };
}

export function habitsComplete(day: DayRecord): boolean {
  return day.habits.length > 0 && day.habits.every((h) => h.done);
}

export function dayHasEntry(day: DayRecord | undefined): boolean {
  if (!day) return false;
  return (
    day.habits.some((h) => h.done) ||
    day.todos.length > 0 ||
    day.ratings.day > 0 ||
    day.ratings.health > 0 ||
    day.ratings.happy > 0 ||
    day.journal.trim().length > 0
  );
}

export function hasRatings(day: DayRecord | undefined): boolean {
  return Boolean(day && (day.ratings.day || day.ratings.health || day.ratings.happy));
}
