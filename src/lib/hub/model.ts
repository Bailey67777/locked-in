import type { ClaudeNote, DayLesson, Exam, Grade, HubData, HubDay, HubSettings, LessonLog, PhotoMeta, PoseId, Rating, Sealed, Session, Stare, SubjectId, TimetableLesson, Todo, Vault, Whoop } from "./types";
import { POSE_IDS, SUBJECT_IDS, isSubject, subjectFromTitle } from "./subjects";
import { dayBounds, weekday } from "./time";
import { addDays, lastNDays } from "../dates";

/** Grades before this day are "before the shift", on or after it "now". */
export const SHIFT_DATE = "2026-11-15";

export const DEFAULT_SETTINGS: HubSettings = { targets: {}, stareMin: 10, timetable: {}, calendarUrl: "", shiftDate: SHIFT_DATE, exams: {}, whoop: false };

export function uid(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

/* ---------- reading whatever is in the database into a clean shape ---------- */

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : v && typeof v === "object" ? Object.values(v) : []);
const str = (v: unknown, fallback = "") => (typeof v === "string" ? v : fallback);
const num = (v: unknown, fallback = 0) => (typeof v === "number" && Number.isFinite(v) ? v : fallback);
const strs = (v: unknown) => list(v).filter((x): x is string => typeof x === "string" && x.trim() !== "");
const TIME_RE = /^\d{2}:\d{2}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const isDateKey = (v: unknown): v is string => typeof v === "string" && DATE_RE.test(v);

export function normalizeSettings(raw: unknown): HubSettings {
  const r = obj(raw);
  const targets: HubSettings["targets"] = {};
  for (const id of SUBJECT_IDS) {
    const t = str(obj(r.targets)[id]);
    if (t) targets[id] = t;
  }
  const timetable: HubSettings["timetable"] = {};
  // Firebase turns an object keyed 0–6 into an array, so read either.
  const tt = (r.timetable && typeof r.timetable === "object" ? r.timetable : {}) as Record<string, unknown>;
  for (let d = 0; d < 7; d++) {
    const lessons = list(tt[d])
      .map((x) => obj(x))
      .filter((l) => isSubject(l.subject) && TIME_RE.test(str(l.start)))
      .map((l): TimetableLesson => ({ id: str(l.id) || uid(), subject: l.subject as SubjectId, start: str(l.start), end: TIME_RE.test(str(l.end)) ? str(l.end) : str(l.start) }))
      .sort((a, b) => a.start.localeCompare(b.start));
    if (lessons.length) timetable[String(d)] = lessons;
  }
  const exams: HubSettings["exams"] = {};
  for (const [id, v] of Object.entries(obj(r.exams))) {
    const e = obj(v);
    if (!str(e.title).trim() || !isDateKey(e.date)) continue;
    exams[id] = { title: str(e.title).trim(), date: e.date, ...(isSubject(e.subject) ? { subject: e.subject } : {}) };
  }
  return {
    targets,
    stareMin: Math.min(60, Math.max(1, num(r.stareMin, DEFAULT_SETTINGS.stareMin))),
    timetable,
    calendarUrl: str(r.calendarUrl),
    shiftDate: isDateKey(r.shiftDate) ? r.shiftDate : SHIFT_DATE,
    exams,
    whoop: r.whoop === true,
  };
}

function normalizeNote(raw: unknown): ClaudeNote | null {
  const n = obj(raw);
  const note = { summary: str(n.summary).trim(), solid: strs(n.solid), open: strs(n.open) };
  return note.summary || note.solid.length || note.open.length ? note : null;
}

function normalizeDay(raw: unknown): HubDay {
  const r = obj(raw);
  const logs: HubDay["logs"] = {};
  for (const [key, v] of Object.entries(obj(r.logs))) {
    const l = obj(v);
    if (!isSubject(l.subject)) continue;
    const conf = l.conf === 1 || l.conf === 2 || l.conf === 3 ? l.conf : undefined;
    logs[key] = { subject: l.subject, text: str(l.text), at: num(l.at), ...(conf ? { conf } : {}) } as LessonLog;
  }
  const day: HubDay = { logs };
  const c = obj(r.claude);
  const subjects: Partial<Record<SubjectId, ClaudeNote>> = {};
  for (const id of SUBJECT_IDS) {
    const note = normalizeNote(obj(c.subjects)[id]);
    if (note) subjects[id] = note;
  }
  if (Object.keys(subjects).length) day.claude = { at: num(c.at), subjects };
  return day;
}

function normalizeSealed(raw: unknown): Sealed | null {
  const s = obj(raw);
  return str(s.iv) && str(s.ct) ? { iv: str(s.iv), ct: str(s.ct) } : null;
}

export function normalizeVault(raw: unknown): Vault | null {
  const v = obj(raw);
  const wrapped = normalizeSealed(v.wrapped);
  if (v.v !== 2 || !wrapped || !str(v.salt) || num(v.iterations) < 1000) return null;
  return { v: 2, salt: str(v.salt), iterations: num(v.iterations), wrapped, at: num(v.at) };
}

export function normalizeData(raw: unknown): HubData {
  const r = obj(raw);
  const days: HubData["days"] = {};
  for (const [k, v] of Object.entries(obj(r.days))) if (DATE_RE.test(k)) days[k] = normalizeDay(v);
  const sessions: HubData["sessions"] = {};
  for (const [k, v] of Object.entries(obj(r.sessions))) {
    const s = obj(v);
    const start = num(s.start);
    const end = num(s.end);
    if (isSubject(s.subject) && start > 0 && end > start) sessions[k] = { subject: s.subject, start, end };
  }
  const stares: HubData["stares"] = {};
  for (const [k, v] of Object.entries(obj(r.stares))) {
    const s = obj(v);
    if (num(s.start) > 0 && num(s.end) > num(s.start)) stares[k] = { start: num(s.start), end: num(s.end) };
  }
  const grades: HubData["grades"] = {};
  for (const [k, v] of Object.entries(obj(r.grades))) {
    const g = obj(v);
    if (!isSubject(g.subject) || !str(g.grade) || !isDateKey(g.date)) continue;
    grades[k] = { subject: g.subject, grade: str(g.grade), date: g.date, label: str(g.label), at: num(g.at), ...(str(g.score) ? { score: str(g.score) } : {}) };
  }
  const t = obj(r.timer);
  const timer = isSubject(t.subject) && num(t.start) > 0 ? { subject: t.subject, start: num(t.start) } : null;
  const todos: HubData["todos"] = {};
  for (const [k, v] of Object.entries(obj(r.todos))) {
    const d = obj(v);
    const text = str(d.text).trim();
    if (!text) continue;
    const later = d.when === "later" || !isDateKey(d.date);
    todos[k] = { text, when: later ? "later" : "day", at: num(d.at), ...(later ? {} : { date: d.date as string }), ...(num(d.done) > 0 ? { done: num(d.done) } : {}) };
  }
  const photos: HubData["photos"] = {};
  for (const [date, v] of Object.entries(obj(r.photos))) {
    if (!DATE_RE.test(date)) continue;
    const day: Partial<Record<PoseId, PhotoMeta>> = {};
    for (const pose of POSE_IDS) {
      const p = obj(obj(v)[pose]);
      if (str(p.id) && num(p.at) > 0) day[pose] = { id: str(p.id), at: num(p.at), w: num(p.w), h: num(p.h), bytes: num(p.bytes) };
    }
    if (Object.keys(day).length) photos[date] = day;
  }
  const goy: HubData["goy"] = {};
  for (const [date, v] of Object.entries(obj(r.goy))) if (DATE_RE.test(date) && str(v).trim()) goy[date] = str(v).trim();
  const ratings: HubData["ratings"] = {};
  for (const [date, v] of Object.entries(obj(r.ratings))) {
    const g = obj(v);
    const score = num(g.score, -1);
    if (!DATE_RE.test(date) || score < 0 || score > 10) continue;
    ratings[date] = { score: Math.round(score * 100) / 100, at: num(g.at), ...(str(g.why).trim() ? { why: str(g.why).trim() } : {}), ...(num(g.seen) > 0 ? { seen: num(g.seen) } : {}) } satisfies Rating;
  }
  const whoop: HubData["whoop"] = {};
  for (const [date, v] of Object.entries(obj(r.whoop))) {
    const w = normalizeWhoop(v);
    if (DATE_RE.test(date) && w) whoop[date] = w;
  }
  return { settings: normalizeSettings(r.settings), days, sessions, stares, grades, timer, todos, photos, goy, ratings, whoop, morning: isDateKey(r.morning) ? r.morning : "", vault: normalizeVault(r.vault) };
}

/** One day's WHOOP numbers, or null when there is nothing in it worth showing. */
export function normalizeWhoop(raw: unknown): Whoop | null {
  const w = obj(raw);
  const out: Whoop = { at: num(w.at) };
  for (const k of ["recovery", "sleep", "asleep", "hrv", "rhr", "strain"] as const) if (typeof w[k] === "number" && Number.isFinite(w[k]) && w[k] >= 0) out[k] = w[k];
  return Object.keys(out).length > 1 ? out : null;
}

/* ---------- lessons ---------- */

export type CalendarEvent = { start: number; end: number; title: string };

/** A lesson key is used as a database key, which can't hold . # $ [ ] or /. */
export const safeKey = (key: string) => key.replace(/[.#$[\]/]/g, "_");

/**
 * The day's lessons: from the calendar if one is linked, else the timetable, else one row per subject (so there's
 * always somewhere to say what you did).
 */
export function lessonsFor(date: string, settings: HubSettings, events: CalendarEvent[] | null): DayLesson[] {
  const hhmm = (ms: number) => {
    const d = new Date(ms);
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };
  let lessons: DayLesson[] = [];
  const hasPlan = Boolean(settings.calendarUrl) || Object.keys(settings.timetable).length > 0;
  if (settings.calendarUrl && events) {
    lessons = events
      .map((e) => ({ e, subject: subjectFromTitle(e.title) }))
      .filter((x): x is { e: CalendarEvent; subject: SubjectId } => x.subject !== null)
      .sort((a, b) => a.e.start - b.e.start)
      .map(({ e, subject }) => ({ key: `${subject}@${hhmm(e.start)}`, subject, start: hhmm(e.start), end: hhmm(e.end), title: e.title }));
  } else if (!settings.calendarUrl) {
    lessons = (settings.timetable[String(weekday(date))] ?? []).map((l) => ({ key: `${l.subject}@${l.start}`, subject: l.subject, start: l.start, end: l.end }));
  }
  // Two calendar events at the same time for the same subject are one lesson.
  const seen = new Set<string>();
  lessons = lessons.filter((l) => (seen.has(l.key) ? false : (seen.add(l.key), true)));
  if (!lessons.length && !hasPlan) lessons = SUBJECT_IDS.map((id) => ({ key: id, subject: id }));
  return lessons;
}

/* ---------- study time ---------- */

/** Minutes of a session that fall inside [from, to). */
function overlap(s: { start: number; end: number }, from: number, to: number): number {
  return Math.max(0, Math.min(s.end, to) - Math.max(s.start, from)) / 60000;
}

export type SubjectMinutes = Record<SubjectId, number>;
const zero = (): SubjectMinutes => ({ maths: 0, physics: 0, econ: 0 });

/** Study minutes on a day by subject, counting a running timer up to `now`. */
export function minutesOn(date: string, sessions: Record<string, Session>, timer: HubData["timer"], now: number): SubjectMinutes {
  const [from, to] = dayBounds(date);
  const out = zero();
  for (const s of Object.values(sessions)) out[s.subject] += overlap(s, from, to);
  if (timer) out[timer.subject] += overlap({ start: timer.start, end: now }, from, to);
  return out;
}

export const total = (m: SubjectMinutes) => m.maths + m.physics + m.econ;

/** Per-day minutes for the last n days ending today, oldest first. */
export function dailyMinutes(today: string, n: number, sessions: Record<string, Session>, timer: HubData["timer"], now: number) {
  return lastNDays(today, n).map((date) => ({ date, mins: minutesOn(date, sessions, timer, now) }));
}

/** All study minutes ever, by subject. */
export function allMinutes(sessions: Record<string, Session>, timer: HubData["timer"], now: number): SubjectMinutes {
  const out = zero();
  for (const s of Object.values(sessions)) out[s.subject] += (s.end - s.start) / 60000;
  if (timer) out[timer.subject] += Math.max(0, now - timer.start) / 60000;
  return out;
}

/** Days in a row with any study, ending today (or yesterday, if today hasn't started yet). */
export function studyStreak(today: string, sessions: Record<string, Session>, timer: HubData["timer"], now: number): number {
  const studied = (d: string) => total(minutesOn(d, sessions, timer, now)) >= 1;
  let day = studied(today) ? today : addDays(today, -1);
  let n = 0;
  while (studied(day) && n < 3650) {
    n++;
    day = addDays(day, -1);
  }
  return n;
}

/** Sessions that fall on a day, newest first. One that runs past midnight is on both days. */
export function sessionsOn(date: string, sessions: Record<string, Session>): (Session & { id: string })[] {
  const [from, to] = dayBounds(date);
  return Object.entries(sessions)
    .filter(([, s]) => s.start < to && s.end > from)
    .map(([id, s]) => ({ id, ...s }))
    .sort((a, b) => b.start - a.start);
}

export function staresOn(date: string, stares: Record<string, Stare>): number {
  const [from, to] = dayBounds(date);
  return Object.values(stares).filter((s) => s.start >= from && s.start < to).length;
}

/* ---------- grades ---------- */

export type GradeWithId = Grade & { id: string };

export function gradesFor(subject: SubjectId, grades: Record<string, Grade>): GradeWithId[] {
  return Object.entries(grades)
    .filter(([, g]) => g.subject === subject)
    .map(([id, g]) => ({ id, ...g }))
    .sort((a, b) => (a.date === b.date ? a.at - b.at : a.date.localeCompare(b.date)));
}

/** The latest grade before the shift date, and the latest on or after it. */
export function beforeAndNow(subject: SubjectId, grades: Record<string, Grade>, shiftDate: string): { before: GradeWithId | null; now: GradeWithId | null } {
  const all = gradesFor(subject, grades);
  const before = all.filter((g) => g.date < shiftDate).pop() ?? null;
  const now = all.filter((g) => g.date >= shiftDate).pop() ?? null;
  return { before, now };
}

/* ---------- what's still shaky ---------- */

/**
 * The newest thing Claude left open for a subject: the first "still open" point from the most recent day it wrote
 * notes on that subject (none once a later day's notes have nothing open).
 */
export function openPoint(days: Record<string, HubDay>, subject: SubjectId, today: string): string | null {
  const dates = Object.keys(days)
    .filter((d) => d <= today && days[d].claude?.subjects[subject])
    .sort();
  const last = dates.pop();
  return last ? (days[last].claude?.subjects[subject]?.open[0] ?? null) : null;
}

/* ---------- exams ---------- */

export type ExamWithId = Exam & { id: string };

/** Exams still to come (today counts), soonest first. */
export function upcomingExams(settings: HubSettings, today: string): ExamWithId[] {
  return Object.entries(settings.exams)
    .map(([id, e]) => ({ id, ...e }))
    .filter((e) => e.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date));
}

/* ---------- to-dos ---------- */

export type TodoWithId = Todo & { id: string };
export type TodoLists = { today: TodoWithId[]; tomorrow: TodoWithId[]; later: TodoWithId[] };

/**
 * The three lists. Today: everything for today or an earlier day that isn't done (unfinished things roll forward),
 * plus whatever was ticked today. Tomorrow: everything dated after today. For a while: the undated list. A ticked
 * item stays on its list, greyed, until the end of the day it was ticked.
 */
export function todoLists(todos: Record<string, Todo>, today: string): TodoLists {
  const [from, to] = dayBounds(today);
  const tickedToday = (t: Todo) => Boolean(t.done && t.done >= from && t.done < to);
  const out: TodoLists = { today: [], tomorrow: [], later: [] };
  for (const [id, t] of Object.entries(todos)) {
    if (t.done && !tickedToday(t)) continue;
    const item = { id, ...t };
    if (t.when === "later") out.later.push(item);
    else if ((t.date ?? today) <= today) out.today.push(item);
    else out.tomorrow.push(item);
  }
  const order = (a: TodoWithId, b: TodoWithId) => a.at - b.at;
  out.today.sort(order);
  out.tomorrow.sort(order);
  out.later.sort(order);
  return out;
}

/* ---------- ratings ---------- */

/** The mean of the ratings in the last n days ending today, or null when there are none. */
export function averageRating(ratings: Record<string, Rating>, today: string, n: number): number | null {
  const scores = lastNDays(today, n)
    .map((d) => ratings[d]?.score)
    .filter((s): s is number => typeof s === "number");
  return scores.length ? scores.reduce((t, s) => t + s, 0) / scores.length : null;
}

/** The newest rating that hasn't been shown on screen yet (today's or earlier), if any. */
export function unseenRating(ratings: Record<string, Rating>, today: string): { date: string; rating: Rating } | null {
  const date = Object.keys(ratings)
    .filter((d) => d <= today && !ratings[d].seen)
    .sort()
    .pop();
  return date ? { date, rating: ratings[date] } : null;
}

/* ---------- photos ---------- */

/** Days that have at least one photo, oldest first. */
export function photoDays(photos: HubData["photos"]): string[] {
  return Object.keys(photos)
    .filter((d) => Object.keys(photos[d] ?? {}).length > 0)
    .sort();
}

export function photoCount(photos: HubData["photos"], date: string): number {
  return Object.keys(photos[date] ?? {}).length;
}
