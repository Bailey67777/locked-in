import type { AppData, Countdown, DayHabit, DayRecord, HabitDef, PlanItem, Reminders, Settings, Submission, TierId, Todo } from "./types";
import { AUTO_EMOJIS, DEFAULT_COLOR, DEFAULT_HABITS, DEFAULT_NAME, HABIT_COLORS } from "./defaults";
import { DEFAULT_DAY_COMPLETE_SOUND, DEFAULT_TODO_SOUND, SOUND_IDS } from "./sounds";

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

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const HEX_RE = /^#[0-9a-fA-F]{6}$/;

export function normalizeHabitDef(raw: unknown): HabitDef | null {
  const h = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  if (typeof h.id !== "string" || typeof h.name !== "string") return null;
  const def: HabitDef = { id: h.id, name: h.name };
  if (typeof h.emoji === "string" && h.emoji.trim()) def.emoji = h.emoji.trim().slice(0, 8);
  if (typeof h.color === "string" && HEX_RE.test(h.color)) def.color = h.color.toLowerCase();
  if (typeof h.time === "string" && TIME_RE.test(h.time)) def.time = h.time;
  if (typeof h.sound === "string" && SOUND_IDS.includes(h.sound)) def.sound = h.sound;
  if (typeof h.keystone === "boolean") def.keystone = h.keystone;
  return def;
}

export function normalizeDay(date: string, raw: unknown): DayRecord {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const ratings = (r.ratings && typeof r.ratings === "object" ? r.ratings : {}) as Record<string, unknown>;
  const day: DayRecord = {
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
  };
  if (typeof r.thumb === "string" && r.thumb.startsWith("data:image/")) day.thumb = r.thumb;
  if (typeof r.updatedAt === "number") day.updatedAt = r.updatedAt;
  if (typeof r.recall === "string" && r.recall) day.recall = r.recall;
  if (typeof r.song === "string" && r.song) day.song = r.song;
  if (typeof r.screenMinutes === "number" && r.screenMinutes >= 0 && r.screenMinutes <= 24 * 60) day.screenMinutes = Math.round(r.screenMinutes);
  const plan = asArray<Partial<PlanItem>>(r.plan)
    .filter((p) => typeof p.id === "string" && typeof p.start === "string" && TIME_RE.test(p.start))
    .map((p) => {
      const item: PlanItem = {
        id: p.id as string,
        title: String(p.title ?? ""),
        start: p.start as string,
        mins: Math.max(5, Math.min(24 * 60, Math.round(Number(p.mins) || 30))),
        done: Boolean(p.done),
      };
      if (typeof p.color === "string" && HEX_RE.test(p.color)) item.color = p.color.toLowerCase();
      if (typeof p.emoji === "string" && p.emoji.trim()) item.emoji = p.emoji.trim().slice(0, 8);
      return item;
    })
    .sort((a, b) => a.start.localeCompare(b.start));
  if (plan.length) day.plan = plan;
  const sub = (r.submitted && typeof r.submitted === "object" ? r.submitted : null) as Partial<Submission> | null;
  if (sub && typeof sub.at === "number" && typeof sub.pct === "number" && TIERS.some((t) => t.id === sub.tier)) {
    day.submitted = { at: sub.at, pct: Math.max(0, Math.min(100, Math.round(sub.pct))), tier: sub.tier as TierId, keystoneMissed: Boolean(sub.keystoneMissed) };
  }
  return day;
}

/** Habits with a time come first, ordered by time; untimed ones keep their manual order after them. */
export function sortHabits(habits: HabitDef[]): HabitDef[] {
  const timed = habits.filter((h) => h.time).sort((a, b) => (a.time as string).localeCompare(b.time as string));
  const untimed = habits.filter((h) => !h.time);
  return [...timed, ...untimed];
}

export function normalizeSettings(raw: unknown): Settings {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const habits = asArray<unknown>(r.habits)
    .map(normalizeHabitDef)
    .filter((h): h is HabitDef => h !== null)
    // Habits saved before emoji/colour/sound existed get a varied default by position, so a long list isn't all checkmarks or one colour.
    .map((h, i) => ({
      ...h,
      // The one habit that matters most: anything with "goon" in its name is a must-do unless you say otherwise.
      keystone: h.keystone ?? /goon/i.test(h.name),
      emoji: h.emoji ?? AUTO_EMOJIS[i % AUTO_EMOJIS.length],
      color: h.color ?? HABIT_COLORS[i % HABIT_COLORS.length].hex,
      sound: h.sound ?? SOUND_IDS[i % SOUND_IDS.length],
    }));
  return {
    name: typeof r.name === "string" && r.name.trim() ? r.name : DEFAULT_NAME,
    habits: sortHabits(habits.length ? habits : DEFAULT_HABITS.map((h) => ({ ...h }))),
    soundsOn: typeof r.soundsOn === "boolean" ? r.soundsOn : true,
    dayCompleteSound: typeof r.dayCompleteSound === "string" && SOUND_IDS.includes(r.dayCompleteSound) ? r.dayCompleteSound : DEFAULT_DAY_COMPLETE_SOUND,
    todoSound: typeof r.todoSound === "string" && SOUND_IDS.includes(r.todoSound) ? r.todoSound : DEFAULT_TODO_SOUND,
    countdowns: asArray<Partial<Countdown>>(r.countdowns)
      .filter((c) => typeof c.id === "string" && typeof c.at === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(c.at))
      .map((c) => {
        const cd: Countdown = { id: c.id as string, title: String(c.title ?? "Countdown"), at: c.at as string, color: typeof c.color === "string" && HEX_RE.test(c.color) ? c.color.toLowerCase() : DEFAULT_COLOR };
        if (typeof c.emoji === "string" && c.emoji.trim()) cd.emoji = c.emoji.trim().slice(0, 8);
        return cd;
      }),
    reminders: normalizeReminders(r.reminders),
  };
}

export function normalizeReminders(raw: unknown): Reminders {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    browser: r.browser === true,
    ntfy: r.ntfy === true,
    ntfyTopic: typeof r.ntfyTopic === "string" ? r.ntfyTopic.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 64) : "",
    submitTime: typeof r.submitTime === "string" && TIME_RE.test(r.submitTime) ? r.submitTime : "21:00",
  };
}

/* ---------- submitting a day ---------- */

export const TIERS: { id: TierId; min: number; label: string; blurb: string; emoji: string; file: string }[] = [
  { id: "t80", min: 80, label: "Locked in", blurb: "80–100%. You earned the good one.", emoji: "🎸", file: "day-80-100" },
  { id: "t50", min: 50, label: "Halfway house", blurb: "50–79%. Decent, not done.", emoji: "😐", file: "day-50-80" },
  { id: "t25", min: 25, label: "Slipping", blurb: "25–49%. That's a punishment.", emoji: "😬", file: "day-25-50" },
  { id: "t0", min: 0, label: "Rock bottom", blurb: "Under 25%, or the must-do habit was missed.", emoji: "💀", file: "day-0-25" },
];

export function tierById(id: TierId) {
  return TIERS.find((t) => t.id === id) ?? TIERS[TIERS.length - 1];
}

/** Must-do habits on this day that aren't ticked. */
export function missedKeystones(day: DayRecord, settings: Settings): DayHabit[] {
  const keystoneIds = new Set(settings.habits.filter((h) => h.keystone).map((h) => h.id));
  return day.habits.filter((h) => !h.done && (keystoneIds.has(h.id) || (!settings.habits.some((d) => d.id === h.id) && /goon/i.test(h.name))));
}

/** Which tier a day lands in: percentage of habits + to-dos, but a missed must-do habit means rock bottom. */
export function tierFor(day: DayRecord, settings: Settings): { tier: TierId; pct: number; keystoneMissed: boolean } {
  const pct = dayProgress(day).pct;
  const keystoneMissed = missedKeystones(day, settings).length > 0;
  if (keystoneMissed) return { tier: "t0", pct, keystoneMissed };
  const tier = TIERS.find((t) => pct >= t.min) ?? TIERS[TIERS.length - 1];
  return { tier: tier.id, pct, keystoneMissed };
}

/** Firebase rejects `undefined`; strip it (deeply) before writing. */
export function stripUndefined<T>(value: T): T {
  if (Array.isArray(value)) return value.map((v) => stripUndefined(v)) as unknown as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) if (v !== undefined) out[k] = stripUndefined(v);
    return out as T;
  }
  return value;
}

export function normalizeDays(raw: unknown): Record<string, DayRecord> {
  const daysRaw = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const days: Record<string, DayRecord> = {};
  for (const key of Object.keys(daysRaw)) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(key)) days[key] = normalizeDay(key, daysRaw[key]);
  }
  return days;
}

export function normalizeData(raw: unknown): AppData {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return { settings: normalizeSettings(r.settings), days: normalizeDays(r.days) };
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

/** Look up a habit's look (emoji/colour) by id, with sensible defaults for habits no longer in the list. */
export function habitLook(id: string, settings: Settings): { emoji: string; color: string; sound: string; time?: string } {
  const def = settings.habits.find((h) => h.id === id);
  return {
    // Habit no longer in the list (only happens looking at old days): a neutral dot, never a checkmark.
    emoji: def?.emoji ?? "🔹",
    color: def?.color ?? DEFAULT_COLOR,
    sound: def?.sound ?? "pop",
    time: def?.time,
  };
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
    day.journal.trim().length > 0 ||
    Boolean(day.recall?.trim()) ||
    Boolean(day.song?.trim()) ||
    Boolean(day.plan?.length) ||
    Boolean(day.submitted) ||
    Boolean(day.thumb)
  );
}

export function hasRatings(day: DayRecord | undefined): boolean {
  return Boolean(day && (day.ratings.day || day.ratings.health || day.ratings.happy));
}
