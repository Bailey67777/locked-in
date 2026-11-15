import { addDays, daysBetween, pad, parseKey } from "../dates";

/** Midnight to midnight of a day, in this device's time, as milliseconds. */
export function dayBounds(key: string): [number, number] {
  const start = parseKey(key);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return [start.getTime(), end.getTime()];
}

/** "Today", "Yesterday", "Tomorrow", or "Fri 13 Nov". */
export function dayTitle(key: string, today: string): string {
  const diff = daysBetween(key, today);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (diff === -1) return "Tomorrow";
  return parseKey(key).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

/** 0 = Sunday … 6 = Saturday. */
export function weekday(key: string): number {
  return parseKey(key).getDay();
}

export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** "08:30" from a timestamp, in this device's time. */
export function clock(ms: number): string {
  const d = new Date(ms);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Timestamp for "HH:MM" on a given day. */
export function atTime(key: string, hhmm: string): number {
  const d = parseKey(key);
  const [h, m] = hhmm.split(":").map(Number);
  d.setHours(h || 0, m || 0, 0, 0);
  return d.getTime();
}

/** 95 → "1h 35m", 40 → "40m", 0 → "0m". */
export function mins(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (!h) return `${r}m`;
  if (!r) return `${h}h`;
  return `${h}h ${r}m`;
}

/** Hours with one decimal, without a trailing ".0": 90 → "1.5", 120 → "2". */
export function hours(minutes: number): string {
  const h = Math.round((minutes / 60) * 10) / 10;
  return Number.isInteger(h) ? String(h) : h.toFixed(1);
}

/** Stopwatch: 3725s → "1:02:05", 65s → "1:05". */
export function stopwatch(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

/** How long ago a day was, in the biggest unit that fits: "Today", "3 days ago", "5 weeks ago", "8 months ago". */
export function ago(key: string, today: string): string {
  const d = daysBetween(key, today);
  if (d <= 0) return "Today";
  if (d === 1) return "Yesterday";
  if (d < 14) return `${d} days ago`;
  if (d < 61) return `${Math.round(d / 7)} weeks ago`;
  const months = Math.round(d / 30.44);
  if (months < 24) return `${months} months ago`;
  const years = Math.floor(months / 12);
  const rest = months - years * 12;
  return rest ? `${years}y ${rest}m ago` : `${years} years ago`;
}

/** Whole days from today until a day (0 = today, negative = past). */
export function daysUntil(key: string, today: string): number {
  return daysBetween(today, key);
}

export { addDays };
