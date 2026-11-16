import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { eventsBetween } from "@/lib/hub/ics";
import { beforeAndNow, normalizeData, normalizeWhoop, safeKey, uid, upcomingExams, type CalendarEvent } from "@/lib/hub/model";
import { GRADES, SUBJECT_IDS, SUBJECT_META, isSubject, subjectFromTitle } from "@/lib/hub/subjects";
import type { DayLesson, Grade, HubData, HubSettings, SubjectId, Todo, Whoop } from "@/lib/hub/types";
import { sync as whoopSync } from "./whoop";

/**
 * Server side of the Claude connector (the MCP server at /api/mcp/<token>). Talks to the Realtime Database over
 * REST, only ever under <space>/hub plus the habit list and each day's habit ticks. It never reads or writes voice
 * notes, photos, the photo vault, journals, vlogs or edits: `allowed()` below refuses any other path. (For photos it
 * may ask one thing only: how many of the day's five were taken, never which or where they are.)
 *
 * Everything that depends on "what day is it" uses Europe/London, whatever time zone the server runs in.
 */

/* ---------- the secret in the connector link ---------- */

/** Compare two strings without leaking where they differ. */
export function safeEqual(a: string, b: string): boolean {
  return timingSafeEqual(createHash("sha256").update(a).digest(), createHash("sha256").update(b).digest());
}

/** The server's one secret, or null when it isn't set up with a proper one. It never leaves the server. */
function serverSecret(): string | null {
  const secret = process.env.CLAUDE_API_SECRET;
  return secret && secret.length >= 16 ? secret : null;
}

/**
 * What goes in the connector link: a token made FROM the secret, not the secret. The link is handed to anyone who
 * holds the app's public data key, and other things (the photo lock) depend on the secret staying on the server, so
 * the two must not be the same value, and one must not be workable from the other. To replace a leaked link without
 * touching anything else, set CONNECTOR_VERSION to a new value on the server and copy the new link.
 */
export function connectorToken(): string | null {
  const secret = serverSecret();
  return secret ? createHmac("sha256", secret).update(`hugo-connector-token:${process.env.CONNECTOR_VERSION || "1"}`).digest("hex") : null;
}

/* ---------- dates and times, always Europe/London ---------- */

const LONDON = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
const pad = (n: number) => String(n).padStart(2, "0");

function londonParts(ms: number): { y: number; mo: number; d: number; h: number; mi: number; s: number } {
  const p: Record<string, number> = {};
  for (const part of LONDON.formatToParts(new Date(ms))) if (part.type !== "literal") p[part.type] = Number(part.value);
  return { y: p.year, mo: p.month, d: p.day, h: p.hour % 24, mi: p.minute, s: p.second };
}

/** The date in London at a moment, as YYYY-MM-DD. */
export function londonDate(ms: number): string {
  const p = londonParts(ms);
  return `${p.y}-${pad(p.mo)}-${pad(p.d)}`;
}

/** The clock time in London at a moment, as HH:MM. */
export function londonClock(ms: number): string {
  const p = londonParts(ms);
  return `${pad(p.h)}:${pad(p.mi)}`;
}

function londonOffset(ms: number): number {
  const p = londonParts(ms);
  return Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi, p.s) - Math.floor(ms / 1000) * 1000;
}

/** The moment a London wall-clock time happens. */
export function londonMs(date: string, hhmm = "00:00"): number {
  const [y, mo, d] = date.split("-").map(Number);
  const [h, mi] = hhmm.split(":").map(Number);
  const guess = Date.UTC(y, mo - 1, d, h || 0, mi || 0);
  const first = londonOffset(guess);
  let t = guess - first;
  const second = londonOffset(t);
  if (second !== first) t = guess - second;
  return t;
}

export function addDays(date: string, n: number): string {
  const [y, mo, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, mo - 1, d + n)).toISOString().slice(0, 10);
}

/** Midnight to midnight of a London day (23 or 25 hours when the clocks change). */
export function londonDayBounds(date: string): [number, number] {
  return [londonMs(date), londonMs(addDays(date, 1))];
}

/** 0 = Sunday … 6 = Saturday. */
export function weekdayOf(date: string): number {
  const [y, mo, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, mo - 1, d)).getUTCDay();
}

/** Whole days from a to b (negative when b is earlier). */
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);
}

export function isDate(v: unknown): v is string {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const [y, mo, d] = v.split("-").map(Number);
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return y >= 2000 && y <= 2100 && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

const DAY_LABEL = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short", year: "numeric" });
const dayLabel = (date: string) => DAY_LABEL.format(new Date(`${date}T12:00:00Z`)).replace(/,/g, "");
const shortDay = (date: string) => dayLabel(date).replace(/ \d{4}$/, "");

/* ---------- the database, over REST ---------- */

const DB_URL = (process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL ?? "").replace(/\/$/, "");
const DATA_KEY = process.env.NEXT_PUBLIC_DATA_KEY || "default";

/** The only places the connector may read. */
const READABLE = /^(hub\/(settings|days|stares|grades|todos|ratings|goy|whoop)(\/|$)|hub\/photos\/\d{4}-\d{2}-\d{2}$|settings\/habits$|days\/\d{4}-\d{2}-\d{2}\/habits$)/;
/** The only places it may write, each a specific child (never a whole parent). */
const WRITABLE = /^hub\/(days\/\d{4}-\d{2}-\d{2}\/claude|grades\/[^/]+|todos\/[^/]+(\/done)?|settings\/exams\/[^/]+|ratings\/\d{4}-\d{2}-\d{2})$/;

export function allowed(method: "GET" | "PUT" | "PATCH" | "DELETE", path: string): boolean {
  if (path.split("/").some((part) => !part || part === "." || part === "..")) return false;
  return (method === "GET" ? READABLE : WRITABLE).test(path);
}

/** Where the tools read and write. The real one is `restDb`; tests pass their own. */
export type Db = {
  get(path: string, query?: Record<string, string>): Promise<unknown>;
  put(path: string, value: unknown): Promise<void>;
  /** Sets each key (a child path, slashes allowed) and leaves everything else alone. */
  patch(path: string, value: Record<string, unknown>): Promise<void>;
  del(path: string): Promise<void>;
};

async function rest(method: "GET" | "PUT" | "PATCH" | "DELETE", path: string, body?: unknown, query?: Record<string, string>): Promise<unknown> {
  if (!DB_URL) throw new Error("Database URL is not configured on the server.");
  if (!allowed(method, path)) throw new Error(`The connector may not ${method} ${path}`);
  const where = path.split("/").map(encodeURIComponent).join("/");
  const qs = query && Object.keys(query).length ? `?${new URLSearchParams(query)}` : "";
  const res = await fetch(`${DB_URL}/spaces/${encodeURIComponent(DATA_KEY)}/${where}.json${qs}`, {
    method,
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
    headers: { "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  if (!res.ok) throw new Error(`Database ${method} ${path} failed: ${res.status}`);
  return res.json();
}

export const restDb: Db = {
  get: (path, query) => rest("GET", path, undefined, query),
  put: async (path, value) => void (await rest("PUT", path, value)),
  patch: async (path, value) => void (await rest("PATCH", path, value)),
  del: async (path) => void (await rest("DELETE", path)),
};

/** Run `fn` over `items`, a few at a time. */
async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

/* ---------- the calendar ---------- */

const MAX_CALENDAR_BYTES = 5_000_000;

/** The linked calendar's events between two moments. Throws if it can't be read. */
export async function fetchCalendar(rawUrl: string, from: number, to: number): Promise<CalendarEvent[]> {
  const url = new URL(rawUrl.trim().replace(/^webcals?:\/\//i, "https://"));
  if (url.protocol !== "https:" || /^(localhost|0\.|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|\[)|\.(local|internal)$/.test(url.hostname)) throw new Error("Not a public https calendar link.");
  const res = await fetch(url, { headers: { Accept: "text/calendar, */*" }, cache: "no-store", signal: AbortSignal.timeout(10_000), redirect: "follow" });
  if (!res.ok) throw new Error(`Calendar answered ${res.status}`);
  const text = await res.text();
  if (text.length > MAX_CALENDAR_BYTES || !text.includes("BEGIN:VCALENDAR")) throw new Error("Not a usable iCal calendar.");
  return eventsBetween(text, from, to);
}

/* ---------- lessons, study time, to-dos, habits: the app's rules with the London day ---------- */

/**
 * The day's lessons, with the same keys the app gives them: from the calendar if one is linked, else the weekly
 * timetable, else one per subject. (`lessonsFor` in the hub model does this with the device's clock; this is the
 * same thing on London time.)
 */
export function lessonsForLondon(date: string, settings: HubSettings, events: CalendarEvent[] | null): DayLesson[] {
  let lessons: DayLesson[] = [];
  const hasPlan = Boolean(settings.calendarUrl) || Object.keys(settings.timetable).length > 0;
  if (settings.calendarUrl && events) {
    lessons = events
      .map((e) => ({ e, subject: subjectFromTitle(e.title) }))
      .filter((x): x is { e: CalendarEvent; subject: SubjectId } => x.subject !== null)
      .sort((a, b) => a.e.start - b.e.start)
      .map(({ e, subject }) => ({ key: `${subject}@${londonClock(e.start)}`, subject, start: londonClock(e.start), end: londonClock(e.end), title: e.title }));
  } else if (!settings.calendarUrl) {
    lessons = (settings.timetable[String(weekdayOf(date))] ?? []).map((l) => ({ key: `${l.subject}@${l.start}`, subject: l.subject, start: l.start, end: l.end }));
  }
  const seen = new Set<string>();
  lessons = lessons.filter((l) => (seen.has(l.key) ? false : (seen.add(l.key), true)));
  if (!lessons.length && !hasPlan) lessons = SUBJECT_IDS.map((id) => ({ key: id, subject: id }));
  return lessons;
}

export type TodoItem = Todo & { id: string };
export type TodoLists = { today: TodoItem[]; tomorrow: TodoItem[]; later: TodoItem[] };

/** The three lists, by the same rules as `todoLists` in the hub model, with "today" being the London day. */
export function londonTodoLists(todos: Record<string, Todo>, today: string): TodoLists {
  const [from, to] = londonDayBounds(today);
  const out: TodoLists = { today: [], tomorrow: [], later: [] };
  for (const [id, t] of Object.entries(todos)) {
    if (t.done && !(t.done >= from && t.done < to)) continue;
    const item = { id, ...t };
    if (t.when === "later") out.later.push(item);
    else if ((t.date ?? today) <= today) out.today.push(item);
    else out.tomorrow.push(item);
  }
  for (const list of [out.today, out.tomorrow, out.later]) list.sort((a, b) => a.at - b.at);
  return out;
}

export type HabitTick = { id: string; name: string; done: boolean };

const rows = (v: unknown): Record<string, unknown>[] =>
  (Array.isArray(v) ? v : v && typeof v === "object" ? Object.values(v) : []).filter((x): x is Record<string, unknown> => Boolean(x && typeof x === "object"));

/** The habit list from settings/habits: only ids and names are kept. */
export function habitDefs(raw: unknown): { id: string; name: string }[] {
  return rows(raw)
    .filter((h) => typeof h.id === "string" && h.id)
    .map((h) => ({ id: h.id as string, name: String(h.name ?? "").trim() || "(unnamed)" }));
}

/** A day's ticks from days/<date>/habits, or null when the day has no record. */
export function habitRecord(raw: unknown): HabitTick[] | null {
  const list = rows(raw)
    .filter((h) => typeof h.id === "string")
    .map((h) => ({ id: h.id as string, name: String(h.name ?? "").trim() || "(unnamed)", done: Boolean(h.done) }));
  return list.length ? list : null;
}

/** Today and later follow the current habit list (ticks kept by id); a past day keeps what it was saved with. */
export function habitsOn(date: string, today: string, defs: { id: string; name: string }[], record: HabitTick[] | null): HabitTick[] {
  if (record && (date < today || !defs.length)) return record;
  const ticked = new Map((record ?? []).map((h) => [h.id, h.done] as const));
  return defs.map((d) => ({ ...d, done: ticked.get(d.id) ?? false }));
}

/* ---------- turning data into text Claude can use ---------- */

const CONF_WORD: Record<number, string> = { 1: "shaky", 2: "okay", 3: "solid" };
const MAX_LOG_CHARS = 6000;
const subjectName = (id: SubjectId) => SUBJECT_META[id].name;
const oneLine = (s: string) => s.replace(/\s+/g, " ").trim();
const quote = (s: string) => {
  const text = s.trim();
  const cut = text.length > MAX_LOG_CHARS ? `${text.slice(0, MAX_LOG_CHARS)} … (cut short)` : text;
  return cut.split(/\n+/).map((line) => `> ${line.trim()}`).join("\n");
};

function gradeDetail(g: Grade): string {
  return `${g.grade} (${[g.date, g.label, g.score].filter(Boolean).join(", ")})`;
}

function gradeSummary(data: HubData): string[] {
  const lines: string[] = [];
  for (const id of SUBJECT_IDS) {
    const { before, now } = beforeAndNow(id, data.grades, data.settings.shiftDate);
    const target = data.settings.targets[id];
    const path = [before ? `before ${gradeDetail(before)}` : "", now ? `now ${gradeDetail(now)}` : ""].filter(Boolean).join(" → ");
    const parts = [path || "no grades yet", target ? `target ${target}` : "no target set"];
    lines.push(`- ${subjectName(id)} (${SUBJECT_META[id].board}): ${parts.join(" · ")}`);
  }
  return lines;
}

function examLines(settings: HubSettings, today: string, includePast: boolean): string[] {
  const line = (e: { title: string; date: string; subject?: SubjectId }) => {
    const n = daysBetween(today, e.date);
    const when = n === 0 ? "today" : n === 1 ? "tomorrow" : n > 0 ? `in ${n} days` : `${-n} days ago`;
    return `- ${e.title}${e.subject ? ` (${subjectName(e.subject)})` : ""}: ${e.date}, ${when}`;
  };
  const upcoming = upcomingExams(settings, today).map(line);
  if (!includePast) return upcoming;
  const past = Object.values(settings.exams)
    .filter((e) => e.date < today)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(line);
  return [...past, ...upcoming];
}

export function renderTodos(lists: TodoLists, today: string): string[] {
  const tomorrow = addDays(today, 1);
  const item = (t: TodoItem, note: string) => `- [${t.done ? "x" : " "}] ${oneLine(t.text)} (id ${t.id}${note})`;
  const block = (title: string, items: string[]) => [`**${title}**`, ...(items.length ? items : ["- nothing"])];
  return [
    ...block("Today", lists.today.map((t) => item(t, t.date && t.date < today ? `, carried over from ${t.date}` : ""))),
    ...block("Tomorrow", lists.tomorrow.map((t) => item(t, t.date && t.date !== tomorrow ? `, for ${t.date}` : ""))),
    ...block("Miscellaneous", lists.later.map((t) => item(t, ""))),
  ];
}

export type DayInput = {
  date: string;
  today: string;
  now: number;
  /** The hub tree, already through `normalizeData`. Only `days[date]` needs to be present. */
  data: HubData;
  events: CalendarEvent[] | null;
  /** Set when a calendar is linked but couldn't be read. */
  calendarFailed: boolean;
  habits: HabitTick[];
  /** How many of the day's five progress photos were taken (0–5). */
  photos: number;
  /** That morning's WHOOP numbers, when a WHOOP is connected and it had any. */
  whoop?: Whoop | null;
};

/** Everything `get_day` returns, as Markdown. */
export function renderDay({ date, today, data, events, calendarFailed, habits, photos, whoop }: DayInput): string {
  const rel = date === today ? " (today)" : date === addDays(today, -1) ? " (yesterday)" : date === addDays(today, 1) ? " (tomorrow)" : "";
  const out: string[] = [`# ${dayLabel(date)}${rel}`, ""];
  const day = data.days[date] ?? { logs: {} };
  const lessons = lessonsForLondon(date, data.settings, events);
  const said = (log: { text: string; conf?: number } | undefined) => {
    if (!log || (!log.text.trim() && !log.conf)) return []; // the app no longer asks him about lessons, so silence means nothing
    return [...(log.conf ? [`Felt: ${CONF_WORD[log.conf]}`] : []), ...(log.text.trim() ? [quote(log.text)] : ["(no words, just the rating)"])];
  };

  out.push("## Lessons");
  if (calendarFailed) out.push("His calendar couldn't be read just now, so the lesson list is missing; anything he logged is below.");
  else if (!lessons.length) out.push("No lessons on this day.");
  const used = new Set<string>();
  lessons.forEach((l, i) => {
    // He says one thing per subject per day (kept under the bare subject); a note tied to this exact lesson time
    // comes first if there is one. A second lesson of the same subject points back at the first.
    const own = safeKey(l.key);
    const key = day.logs[own] ? own : l.subject;
    const time = l.start ? `, ${l.start}${l.end && l.end !== l.start ? `–${l.end}` : ""}` : "";
    const title = l.title && oneLine(l.title).toLowerCase() !== subjectName(l.subject).toLowerCase() ? ` ("${oneLine(l.title)}")` : "";
    out.push(`### ${i + 1}. ${subjectName(l.subject)}${time}${title}`, ...(used.has(key) && day.logs[key] ? ["(Same subject as above: what he said covers both lessons.)"] : said(day.logs[key])));
    used.add(key);
    used.add(own);
  });
  const extra = Object.entries(day.logs).filter(([key, log]) => !used.has(key) && (log.text.trim() || log.conf));
  if (extra.length) {
    out.push("", calendarFailed ? "## What he logged" : "## Also logged (not matching a lesson above)");
    for (const [key, log] of extra.sort((a, b) => a[1].at - b[1].at)) {
      const at = key.match(/@(\d{2}:\d{2})$/)?.[1];
      out.push(`### ${subjectName(log.subject)}${at ? `, ${at}` : ""}`, ...said(log));
    }
  }

  const notes = day.claude?.subjects ?? {};
  out.push("", "## Notes you already saved for this day");
  if (!Object.keys(notes).length) out.push("None yet.");
  for (const id of SUBJECT_IDS) {
    const n = notes[id];
    if (!n) continue;
    out.push(`### ${subjectName(id)}`);
    if (n.summary) out.push(n.summary);
    if (n.solid.length) out.push(`Solid: ${n.solid.join("; ")}`);
    if (n.open.length) out.push(`Open: ${n.open.join("; ")}`);
  }

  const done = habits.filter((h) => h.done);
  const left = habits.filter((h) => !h.done);
  out.push("", `## Habits: ${done.length}/${habits.length} done`);
  if (habits[0]) out.push(`His must-do (the first habit): ${habits[0].name}, ${habits[0].done ? "done" : "NOT done"}.`);
  if (done.length) out.push(`Done: ${done.map((h) => h.name).join(", ")}`);
  if (left.length) out.push(`Not done: ${left.map((h) => h.name).join(", ")}`);

  out.push("", "## Health", `Progress photos taken: ${photos} of 5.`);
  out.push(`"Goy" eaten (his own word for the one junk item a day he allows himself at most): ${data.goy[date] ? oneLine(data.goy[date]) : "nothing written down, which means he ate none. That is a win, never something to mark down"}.`);

  if (whoop) {
    const bits = [
      whoop.recovery !== undefined ? `recovery ${whoop.recovery}%` : "",
      whoop.sleep !== undefined ? `sleep ${whoop.sleep}%${whoop.asleep ? ` (${Math.floor(whoop.asleep / 60)}h ${whoop.asleep % 60}m asleep)` : ""}` : "",
      whoop.hrv !== undefined ? `HRV ${whoop.hrv} ms` : "",
      whoop.rhr !== undefined ? `resting heart rate ${whoop.rhr}` : "",
      whoop.strain !== undefined ? `strain ${whoop.strain} of 21` : "",
    ].filter(Boolean);
    if (bits.length) out.push(`WHOOP (the night before and that morning; for context only, it never changes the day's rating): ${bits.join(", ")}.`);
  } else if (data.settings.whoop) out.push("WHOOP: nothing recorded for this day.");

  const rating = data.ratings[date];
  out.push("", "## Your rating of this day", rating ? `${rating.score.toFixed(2)} out of 10${rating.why ? `: ${oneLine(rating.why)}` : ""}` : "Not rated yet.");

  out.push("", date === today ? "## To-dos" : "## To-dos (as they stand today)", ...renderTodos(londonTodoLists(data.todos, today), today));

  // Counted from the day being looked at: "tomorrow" on a past day has to mean that day's tomorrow, not today's.
  const exams = examLines(data.settings, date < today ? date : today, false);
  out.push("", date < today ? `## Upcoming exams (how far off they were on ${date}, not today)` : "## Upcoming exams", ...(exams.length ? exams : ["None set."]));
  out.push("", `## Grades (before = latest dated before ${data.settings.shiftDate}, now = latest since)`, ...gradeSummary(data));
  return out.join("\n");
}

export type ProgressInput = {
  today: string;
  now: number;
  /** How many days, ending today. */
  days: number;
  data: HubData;
  /** date → that day's saved ticks, or null when the day has no record. */
  records: Record<string, HabitTick[] | null>;
  defs: { id: string; name: string }[];
};

/** Everything `get_progress` returns, as Markdown. */
export function renderProgress({ today, days, data, records, defs }: ProgressInput): string {
  const dates = Array.from({ length: days }, (_, i) => addDays(today, i - (days - 1)));
  const lines: string[] = [];
  let quiet = 0;
  for (const date of dates) {
    const record = records[date] ?? null;
    const ticks = record ? habitsOn(date, today, defs, record) : null;
    if (!ticks && !data.ratings[date]) {
      quiet++;
      continue;
    }
    const habits = ticks?.length ? `habits ${Math.round((ticks.filter((h) => h.done).length / ticks.length) * 100)}%` : "habits not recorded";
    const rated = data.ratings[date] ? ` · rated ${data.ratings[date].score.toFixed(2)}` : "";
    lines.push(`- ${shortDay(date)}: ${habits}${rated}`);
  }
  const [from] = londonDayBounds(dates[0]);
  const [, to] = londonDayBounds(today);
  const stares = Object.values(data.stares);
  const staresIn = stares.filter((s) => s.start >= from && s.start < to).length;

  const out = [`# Last ${days} day${days === 1 ? "" : "s"}: ${dates[0]} to ${today}`, "", "## Totals"];
  out.push(`Stare at Wall sessions: ${staresIn} (${stares.length} ever)`);
  const scores = dates.map((d) => data.ratings[d]?.score).filter((s): s is number => typeof s === "number");
  out.push(scores.length ? `Your day ratings: ${scores.length} in this window, average ${(scores.reduce((t, s) => t + s, 0) / scores.length).toFixed(2)} out of 10.` : "Your day ratings: none in this window yet.");
  out.push("", "## Day by day", ...(lines.length ? lines : ["Nothing recorded in this window."]));
  if (quiet && lines.length) out.push(`(${quiet} day${quiet === 1 ? "" : "s"} with nothing recorded left out.)`);

  const grades = Object.values(data.grades).sort((a, b) => (a.date === b.date ? a.at - b.at : a.date.localeCompare(b.date)));
  out.push("", "## Grades, oldest first");
  out.push(...(grades.length ? grades.map((g) => `- ${g.date} ${subjectName(g.subject)}: ${g.grade}${g.label ? `, ${g.label}` : ""}${g.score ? ` (${g.score})` : ""}`) : ["None recorded."]));
  out.push("", `## Where each subject stands (before = latest dated before ${data.settings.shiftDate}, now = latest since)`, ...gradeSummary(data));
  const exams = examLines(data.settings, today, true);
  out.push("", "## Exams", ...(exams.length ? exams : ["None set."]));
  return out.join("\n");
}

/* ---------- the tools ---------- */

const DATE_SCHEMA = { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$", description: "YYYY-MM-DD, Europe/London. Defaults to today." };
const SUBJECT_SCHEMA = { type: "string", enum: SUBJECT_IDS, description: "maths includes Further Maths; econ is Economics." };
const WHEN = ["today", "tomorrow", "later"];

type ToolDef = {
  name: string;
  title: string;
  description: string;
  inputSchema: { type: "object"; properties: Record<string, unknown>; required?: string[]; additionalProperties: false };
  annotations: { title: string; readOnlyHint: boolean; destructiveHint: false; idempotentHint: boolean; openWorldHint: false };
};

function tool(name: string, title: string, description: string, properties: Record<string, unknown>, required: string[], hints: { readOnly?: boolean; idempotent?: boolean } = {}): ToolDef {
  return {
    name,
    title,
    description,
    inputSchema: { type: "object", properties, ...(required.length ? { required } : {}), additionalProperties: false },
    annotations: { title, readOnlyHint: Boolean(hints.readOnly), destructiveHint: false, idempotentHint: Boolean(hints.readOnly || hints.idempotent), openWorldHint: false },
  };
}

/** What `tools/list` answers. */
export const TOOLS: ToolDef[] = [
  tool(
    "get_day",
    "Read Hugo's day",
    "One day of Hugo's school life in a single read: his lessons in order (the app no longer asks him to say what he did in each, so most have nothing under them), notes you already saved, habits, to-dos, upcoming exams, grades and targets. Call it first when he runs /today or starts talking about his day.",
    { date: DATE_SCHEMA },
    [],
    { readOnly: true },
  ),
  tool(
    "save_lesson_notes",
    "Save lesson notes",
    "Save your notes on one subject for one day; the app shows them under that lesson. Call once per subject after working it through with him. Saving again for the same day and subject replaces the earlier notes.",
    {
      date: DATE_SCHEMA,
      subject: SUBJECT_SCHEMA,
      summary: { type: "string", maxLength: 1200, description: "What the lesson covered, in precise terms, in 1 to 3 sentences." },
      solid: { type: "array", items: { type: "string", maxLength: 400 }, maxItems: 8, description: "Points he now has." },
      open: { type: "array", items: { type: "string", maxLength: 400 }, maxItems: 8, description: "Points still shaky or unresolved." },
    },
    ["subject", "summary"],
    { idempotent: true },
  ),
  tool(
    "rate_day",
    "Rate a day",
    "Give one finished day a single mark out of 10, to two decimal places (for example 6.85). The app shows him just the number the next time he opens it, so the number has to carry your whole judgement. Read get_day for that date first, and get_progress for your earlier marks so you stay consistent. Judge the day against what it asked of him: a school day with lessons on the timetable is held to more than a Sunday. Weigh his habits (the first one is his must-do, and missing it should cost a lot), his academics, to-dos finished, the photos, and the one-junk-item rule (nothing written under Goy means he ate none, which is a win). He does not time his studying, so there are no study minutes: never judge a day by time spent. For academics, look at which exams are coming and how close they were on that day, his grades against his targets, and schoolwork to-dos. The app does not ask him to log his lessons: never mark a day down because nothing is written under a lesson. His WHOOP numbers, if shown, are for context only and never move the mark up or down. Be honest and exact: an ordinary day is around 5 to 6, 8 and above is rare and earned, and never round to a whole or half number out of politeness. Rating the same day again replaces the mark and shows it to him again.",
    {
      date: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$", description: "YYYY-MM-DD, Europe/London. Defaults to yesterday. A day can only be rated once it is over." },
      score: { type: "number", minimum: 0, maximum: 10, description: "Out of 10, two decimal places." },
      why: { type: "string", maxLength: 300, description: "One line on what decided it, for your own later reference. He does not see this in the pop-up." },
    },
    ["score"],
    { idempotent: true },
  ),
  tool(
    "get_progress",
    "Read Hugo's progress",
    "Trends over the last N days ending today: habit completion, your day ratings, every grade with before/now per subject, exams, and Stare at Wall sessions.",
    { days: { type: "integer", minimum: 1, maximum: 120, description: "How many days back, counting today. Defaults to 14." } },
    [],
    { readOnly: true },
  ),
  tool(
    "add_grade",
    "Add a grade",
    "Record a grade Hugo got on a test, mock or piece of work. Adds a new entry each time.",
    {
      subject: SUBJECT_SCHEMA,
      grade: { type: "string", enum: GRADES, description: "A-level letter grade." },
      date: { ...DATE_SCHEMA, description: "The day he got it, YYYY-MM-DD. Defaults to today. Not in the future." },
      label: { type: "string", maxLength: 120, description: "What it was, e.g. \"Mechanics end-of-topic test\"." },
      score: { type: "string", maxLength: 40, description: "The raw mark if he gave one, e.g. \"34/50\"." },
    },
    ["subject", "grade"],
  ),
  tool(
    "set_exam",
    "Set an exam",
    "Add an exam, or change one that has the same title (matched ignoring case). Leave `date` out to remove the exam with that title.",
    {
      title: { type: "string", maxLength: 120, description: "The exam's name, e.g. \"Physics Paper 1\"." },
      date: { ...DATE_SCHEMA, description: "The exam date, YYYY-MM-DD. Omit to remove the exam." },
      subject: SUBJECT_SCHEMA,
    },
    ["title"],
    { idempotent: true },
  ),
  tool("list_todos", "Read to-dos", "Hugo's three to-do lists (today, tomorrow, for a while) with the id each item needs for complete_todo.", {}, [], { readOnly: true }),
  tool(
    "add_todo",
    "Add a to-do",
    "Add a to-do. Use it when Hugo asks to be reminded of something.",
    {
      text: { type: "string", maxLength: 300, description: "The to-do, short and in his words." },
      when: { type: "string", enum: WHEN, description: "today, tomorrow, or later (the undated \"for a while\" list)." },
    },
    ["text", "when"],
  ),
  tool(
    "complete_todo",
    "Tick a to-do",
    "Tick a to-do off, or untick it with done=false. Ids come from list_todos or get_day.",
    { id: { type: "string", description: "The to-do's id." }, done: { type: "boolean", description: "Defaults to true." } },
    ["id"],
    { idempotent: true },
  ),
];

/** A problem the model can fix by calling again (bad input, unknown id): its message is sent back as is. */
export class ToolError extends Error {}

type Args = Record<string, unknown>;
export type ToolDeps = { db: Db; now: number; calendar: typeof fetchCalendar };
type Ctx = ToolDeps & { today: string };

function only(args: Args, keys: string[]) {
  const extra = Object.keys(args).filter((k) => !keys.includes(k));
  if (extra.length) throw new ToolError(`Unknown argument${extra.length > 1 ? "s" : ""}: ${extra.join(", ")}. Allowed: ${keys.join(", ") || "none"}.`);
}

function dateArg(args: Args, today: string, key = "date"): string {
  const v = args[key];
  if (v === undefined || v === null || v === "") return today;
  if (!isDate(v)) throw new ToolError(`${key} must be a real date written YYYY-MM-DD (today is ${today}).`);
  return v;
}

function subjectArg(args: Args): SubjectId {
  if (!isSubject(args.subject)) throw new ToolError(`subject must be one of: ${SUBJECT_IDS.join(", ")} (maths includes Further Maths).`);
  return args.subject;
}

function textArg(args: Args, key: string, max: number): string {
  const v = args[key];
  if (typeof v !== "string" || !v.trim()) throw new ToolError(`${key} is required and must be text.`);
  if (v.trim().length > max) throw new ToolError(`${key} is too long: keep it under ${max} characters.`);
  return v.trim();
}

function optionalText(args: Args, key: string, max: number): string {
  const v = args[key];
  if (v === undefined || v === null) return "";
  if (typeof v !== "string") throw new ToolError(`${key} must be text.`);
  if (v.trim().length > max) throw new ToolError(`${key} is too long: keep it under ${max} characters.`);
  return v.trim();
}

/** A list of short points: trimmed, blanks dropped, at most 8, each at most 400 characters. */
function pointsArg(args: Args, key: string): string[] {
  const v = args[key];
  if (v === undefined || v === null) return [];
  if (!Array.isArray(v) || v.some((x) => typeof x !== "string")) throw new ToolError(`${key} must be a list of short strings.`);
  return (v as string[])
    .map((s) => s.trim().slice(0, 400))
    .filter(Boolean)
    .slice(0, 8);
}

function notFuture(date: string, today: string) {
  if (date > today) throw new ToolError(`date can't be in the future (today is ${today}).`);
}

async function getDay(args: Args, { db, now, today, calendar }: Ctx): Promise<string> {
  only(args, ["date"]);
  const date = dateArg(args, today);
  const [settings, day, grades, todos, defsRaw, ticksRaw, rating, goy, poses] = await Promise.all([
    db.get("hub/settings"),
    db.get(`hub/days/${date}`),
    db.get("hub/grades"),
    db.get("hub/todos"),
    db.get("settings/habits"),
    db.get(`days/${date}/habits`),
    db.get(`hub/ratings/${date}`),
    db.get(`hub/goy/${date}`),
    // Names of the poses taken that day and nothing else ("shallow"): enough to count them.
    db.get(`hub/photos/${date}`, { shallow: "true" }),
  ]);
  const data = normalizeData({ settings, days: { [date]: day }, grades, todos, ratings: { [date]: rating }, goy: { [date]: goy } });
  const photos = poses && typeof poses === "object" ? Math.min(5, Object.keys(poses).length) : 0;
  let events: CalendarEvent[] | null = null;
  let calendarFailed = false;
  if (data.settings.calendarUrl) {
    try {
      events = await calendar(data.settings.calendarUrl, ...londonDayBounds(date));
    } catch {
      calendarFailed = true;
    }
  }
  // With a WHOOP connected, ask it first (so the night's numbers are in even if he hasn't opened the app), but
  // never let a slow or broken WHOOP hold up the day.
  let whoop: Whoop | null = null;
  if (data.settings.whoop) {
    const latest = await Promise.race([whoopSync(now), new Promise<null>((done) => setTimeout(() => done(null), 7000))]).catch(() => null);
    whoop = latest?.[date] ?? normalizeWhoop(await db.get(`hub/whoop/${date}`).catch(() => null));
  }
  return renderDay({ date, today, now, data, events, calendarFailed, habits: habitsOn(date, today, habitDefs(defsRaw), habitRecord(ticksRaw)), photos, whoop });
}

async function rateDay(args: Args, { db, now, today }: Ctx): Promise<string> {
  only(args, ["date", "score", "why"]);
  const date = args.date === undefined || args.date === null ? addDays(today, -1) : dateArg(args, today);
  if (date >= today) throw new ToolError(`A day can only be rated once it is over. Today is ${today}; rate ${addDays(today, -1)} or earlier.`);
  const raw = args.score;
  if (typeof raw !== "number" || !Number.isFinite(raw) || raw < 0 || raw > 10) throw new ToolError("score must be a number from 0 to 10, with two decimal places (for example 6.85).");
  const score = Math.round(raw * 100) / 100;
  const why = optionalText(args, "why", 300);
  await db.put(`hub/ratings/${date}`, { score, at: now, ...(why ? { why } : {}) });
  return `Rated ${date}: ${score.toFixed(2)} out of 10. He will see the number the next time he opens the app.`;
}

async function saveLessonNotes(args: Args, { db, now, today }: Ctx): Promise<string> {
  only(args, ["date", "subject", "summary", "solid", "open"]);
  const date = dateArg(args, today);
  const subject = subjectArg(args);
  if (typeof args.summary !== "string" || !args.summary.trim()) throw new ToolError("summary is required: the lesson in precise terms, in 1 to 3 sentences.");
  const summary = args.summary.trim().slice(0, 1200);
  const solid = pointsArg(args, "solid");
  const open = pointsArg(args, "open");
  await db.patch(`hub/days/${date}/claude`, { [`subjects/${subject}`]: { summary, solid, open }, at: now });
  return `Saved ${subjectName(subject)} notes for ${date}: summary, ${solid.length} solid, ${open.length} open. They now show under that lesson in the app.`;
}

async function getProgress(args: Args, { db, now, today }: Ctx): Promise<string> {
  only(args, ["days"]);
  const days = args.days === undefined || args.days === null ? 14 : args.days;
  if (typeof days !== "number" || !Number.isInteger(days) || days < 1 || days > 120) throw new ToolError("days must be a whole number from 1 to 120.");
  const dates = Array.from({ length: days }, (_, i) => addDays(today, i - (days - 1)));
  const [settings, hubDays, stares, grades, defsRaw, ticks, ratings] = await Promise.all([
    db.get("hub/settings"),
    db.get("hub/days", { orderBy: JSON.stringify("$key"), startAt: JSON.stringify(dates[0]), endAt: JSON.stringify(today) }),
    db.get("hub/stares"),
    db.get("hub/grades"),
    db.get("settings/habits"),
    mapLimit(dates, 16, (d) => db.get(`days/${d}/habits`)),
    db.get("hub/ratings", { orderBy: JSON.stringify("$key"), startAt: JSON.stringify(dates[0]), endAt: JSON.stringify(today) }),
  ]);
  const records: Record<string, HabitTick[] | null> = {};
  dates.forEach((d, i) => (records[d] = habitRecord(ticks[i])));
  const data = normalizeData({ settings, days: hubDays, stares, grades, ratings });
  return renderProgress({ today, now, days, data, records, defs: habitDefs(defsRaw) });
}

async function addGrade(args: Args, { db, now, today }: Ctx): Promise<string> {
  only(args, ["subject", "grade", "date", "label", "score"]);
  const subject = subjectArg(args);
  const grade = typeof args.grade === "string" ? args.grade.trim().toUpperCase() : "";
  if (!GRADES.includes(grade)) throw new ToolError(`grade must be one of: ${GRADES.join(", ")}.`);
  const date = dateArg(args, today);
  notFuture(date, today);
  const label = optionalText(args, "label", 120);
  const score = optionalText(args, "score", 40);
  await db.put(`hub/grades/${uid()}`, { subject, grade, date, label, ...(score ? { score } : {}), at: now });
  return `Recorded ${subjectName(subject)} grade ${grade} for ${date}${label ? `: ${label}` : ""}${score ? ` (${score})` : ""}.`;
}

async function setExam(args: Args, { db, today }: Ctx): Promise<string> {
  only(args, ["title", "date", "subject"]);
  const title = textArg(args, "title", 120);
  const remove = args.date === undefined || args.date === null || args.date === "";
  const subject = args.subject === undefined || args.subject === null ? null : subjectArg(args);
  const raw = await db.get("hub/settings/exams");
  const existing = Object.entries(raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {})
    .map(([id, v]) => ({ id, exam: (v && typeof v === "object" ? v : {}) as Record<string, unknown> }))
    .filter((e) => typeof e.exam.title === "string" && e.exam.title.trim().toLowerCase() === title.toLowerCase());
  if (remove) {
    if (!existing.length) throw new ToolError(`There is no exam called "${title}" to remove. Give a date to add it.`);
    for (const e of existing) await db.del(`hub/settings/exams/${e.id}`);
    return `Removed the exam "${String(existing[0].exam.title).trim()}".`;
  }
  const date = dateArg(args, today);
  const match = existing[0];
  const keep = match && isSubject(match.exam.subject) ? match.exam.subject : null;
  const subj = subject ?? keep;
  await db.put(`hub/settings/exams/${match?.id ?? uid()}`, { title, date, ...(subj ? { subject: subj } : {}) });
  const n = daysBetween(today, date);
  return `${match ? "Updated" : "Added"} the exam "${title}" on ${date}${subj ? ` (${subjectName(subj)})` : ""}: ${n >= 0 ? `${n} day${n === 1 ? "" : "s"} to go` : "already past"}.`;
}

async function listTodos(args: Args, { db, today }: Ctx): Promise<string> {
  only(args, []);
  const data = normalizeData({ todos: await db.get("hub/todos") });
  return [`# To-dos on ${dayLabel(today)}`, "", ...renderTodos(londonTodoLists(data.todos, today), today)].join("\n");
}

async function addTodo(args: Args, { db, now, today }: Ctx): Promise<string> {
  only(args, ["text", "when"]);
  const text = oneLine(textArg(args, "text", 300));
  const when = args.when;
  if (typeof when !== "string" || !WHEN.includes(when)) throw new ToolError(`when must be one of: ${WHEN.join(", ")}.`);
  const id = uid();
  if (when === "later") await db.put(`hub/todos/${id}`, { text, when: "later", at: now });
  else await db.put(`hub/todos/${id}`, { text, when: "day", date: when === "today" ? today : addDays(today, 1), at: now });
  return `Added to ${when === "later" ? "the for-a-while list" : when}: "${text}" (id ${id}).`;
}

async function completeTodo(args: Args, { db, now }: Ctx): Promise<string> {
  only(args, ["id", "done"]);
  const id = typeof args.id === "string" ? args.id.trim() : "";
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) throw new ToolError("id must be a to-do id from list_todos or get_day.");
  if (args.done !== undefined && args.done !== null && typeof args.done !== "boolean") throw new ToolError("done must be true or false.");
  const done = args.done !== false;
  const todo = normalizeData({ todos: { [id]: await db.get(`hub/todos/${id}`) } }).todos[id];
  if (!todo) throw new ToolError(`There is no to-do with id ${id}. Call list_todos for the current ids.`);
  if (done === Boolean(todo.done)) return `"${oneLine(todo.text)}" was already ${done ? "ticked" : "unticked"}.`;
  if (done) await db.put(`hub/todos/${id}/done`, now);
  else await db.del(`hub/todos/${id}/done`);
  return `${done ? "Ticked" : "Unticked"}: "${oneLine(todo.text)}".`;
}

const HANDLERS = new Map<string, (args: Args, ctx: Ctx) => Promise<string>>([
  ["get_day", getDay],
  ["save_lesson_notes", saveLessonNotes],
  ["rate_day", rateDay],
  ["get_progress", getProgress],
  ["add_grade", addGrade],
  ["set_exam", setExam],
  ["list_todos", listTodos],
  ["add_todo", addTodo],
  ["complete_todo", completeTodo],
]);

export const hasTool = (name: string) => HANDLERS.has(name);

export type ToolResult = { content: { type: "text"; text: string }[]; isError?: true };

/** Run a tool. Never throws: anything that goes wrong comes back as a result marked `isError`. */
export async function callTool(name: string, rawArgs: unknown, deps: Partial<ToolDeps> = {}): Promise<ToolResult> {
  const fail = (text: string): ToolResult => ({ content: [{ type: "text", text }], isError: true });
  const handler = HANDLERS.get(name);
  if (!handler) return fail(`Unknown tool: ${name}`);
  if (rawArgs !== undefined && rawArgs !== null && (typeof rawArgs !== "object" || Array.isArray(rawArgs))) return fail("arguments must be an object.");
  const now = deps.now ?? Date.now();
  try {
    const text = await handler((rawArgs ?? {}) as Args, { db: deps.db ?? restDb, calendar: deps.calendar ?? fetchCalendar, now, today: londonDate(now) });
    return { content: [{ type: "text", text }] };
  } catch (e) {
    if (e instanceof ToolError) return fail(e.message);
    console.error(`[mcp] ${name} failed:`, e instanceof Error ? e.message : e);
    return fail("Couldn't reach Hugo's data just now. Try again in a moment.");
  }
}
