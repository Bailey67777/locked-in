export function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

export function keyFromDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function todayKey(): string {
  return keyFromDate(new Date());
}

export function parseKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(key: string, n: number): string {
  const d = parseKey(key);
  d.setDate(d.getDate() + n);
  return keyFromDate(d);
}

export function daysBetween(a: string, b: string): number {
  return Math.round((parseKey(b).getTime() - parseKey(a).getTime()) / 86400000);
}

export function formatLong(key: string): string {
  return parseKey(key).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

export function formatShort(key: string): string {
  return parseKey(key).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function formatDayMonth(key: string): string {
  const d = parseKey(key);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** Compact axis tick: "7 Sep" for the first tick or a new month, otherwise just "9". */
export function axisTick(key: string, prevKey: string | null): string {
  const d = parseKey(key);
  if (!prevKey || parseKey(prevKey).getMonth() !== d.getMonth()) return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
  return String(d.getDate());
}

export function monthLabel(year: number, month: number): string {
  return new Date(year, month, 1).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

/** Weeks of the month as date keys (Monday first). Null = outside the month. */
export function monthGrid(year: number, month: number): (string | null)[][] {
  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const offset = (first.getDay() + 6) % 7; // Monday = 0
  const cells: (string | null)[] = [];
  for (let i = 0; i < offset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(keyFromDate(new Date(year, month, d)));
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

/** Last n day keys ending at `end`, oldest first. */
export function lastNDays(end: string, n: number): string[] {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) out.push(addDays(end, -i));
  return out;
}

export function greetingFor(d: Date): string {
  const h = d.getHours();
  if (h < 5) return "Still up";
  if (h < 12) return "Morning";
  if (h < 17) return "Afternoon";
  return "Evening";
}

/** "90" → "1h 30m" */
export function formatMins(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}

/** "07:30" + 45 → "08:15" (clamped to the same day). */
export function addMinutes(time: string, mins: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = Math.max(0, Math.min(24 * 60 - 1, h * 60 + m + mins));
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
}

export function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

export function nowTime(d = new Date()): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Split a millisecond gap into days / hours / minutes / seconds. */
export function splitDuration(ms: number): { days: number; hours: number; minutes: number; seconds: number } {
  const total = Math.floor(Math.abs(ms) / 1000);
  return { days: Math.floor(total / 86400), hours: Math.floor((total % 86400) / 3600), minutes: Math.floor((total % 3600) / 60), seconds: total % 60 };
}

export function formatDateTime(local: string): string {
  const d = new Date(local);
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" }) + " · " + `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Monday of the week containing this date, as a key. */
export function weekStartOf(key: string): string {
  const d = parseKey(key);
  const offset = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - offset);
  return keyFromDate(d);
}

export function formatWeekLabel(weekStart: string): string {
  const d = parseKey(weekStart);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}
