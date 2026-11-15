/**
 * A small iCal (.ics) reader: enough for a school timetable feed (Google, Outlook, iCloud, school portals).
 * Handles folded lines, time zones (IANA and the common Windows names), all-day events (skipped: lessons have
 * times), weekly/daily repeats with INTERVAL, UNTIL, COUNT and BYDAY, cancelled dates (EXDATE), moved single
 * lessons (RECURRENCE-ID) and cancelled events.
 */

export type IcsEvent = { start: number; end: number; title: string };

type Stamp = { y: number; mo: number; d: number; h: number; mi: number; s: number; utc: boolean; tz: string | null; allDay: boolean };

const WINDOWS_TZ: Record<string, string> = {
  "GMT Standard Time": "Europe/London",
  "Greenwich Standard Time": "Europe/London",
  "W. Europe Standard Time": "Europe/Berlin",
  "Romance Standard Time": "Europe/Paris",
  "Eastern Standard Time": "America/New_York",
  "Pacific Standard Time": "America/Los_Angeles",
  UTC: "UTC",
};
const DEFAULT_TZ = "Europe/London";

function validTz(tz: string | null): string {
  if (!tz) return DEFAULT_TZ;
  const mapped = WINDOWS_TZ[tz] ?? tz.replace(/^\/+/, "");
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: mapped });
    return mapped;
  } catch {
    return DEFAULT_TZ;
  }
}

const formatters = new Map<string, Intl.DateTimeFormat>();

function tzOffset(ms: number, tz: string): number {
  let f = formatters.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
    formatters.set(tz, f);
  }
  const parts = f.formatToParts(new Date(ms));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  return Date.UTC(get("year"), get("month") - 1, get("day"), get("hour") % 24, get("minute"), get("second")) - ms;
}

/** Wall-clock time in a zone → milliseconds. */
function zoned(y: number, mo: number, d: number, h: number, mi: number, s: number, tz: string): number {
  const guess = Date.UTC(y, mo - 1, d, h, mi, s);
  const off1 = tzOffset(guess, tz);
  let t = guess - off1;
  const off2 = tzOffset(t, tz);
  if (off2 !== off1) t = guess - off2;
  return t;
}

function parseStamp(value: string, params: Record<string, string>): Stamp | null {
  const m = value.trim().match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/);
  if (!m) return null;
  const allDay = !m[4] || params.VALUE === "DATE";
  return { y: +m[1], mo: +m[2], d: +m[3], h: +(m[4] ?? 0), mi: +(m[5] ?? 0), s: +(m[6] ?? 0), utc: Boolean(m[7]), tz: params.TZID ?? null, allDay };
}

function toMs(st: Stamp, fallbackTz: string): number {
  if (st.utc) return Date.UTC(st.y, st.mo - 1, st.d, st.h, st.mi, st.s);
  return zoned(st.y, st.mo, st.d, st.h, st.mi, st.s, st.tz ? validTz(st.tz) : fallbackTz);
}

function parseDuration(v: string): number {
  const m = v.match(/^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/);
  if (!m) return 0;
  const ms = ((+(m[2] ?? 0) * 7 + +(m[3] ?? 0)) * 86400 + +(m[4] ?? 0) * 3600 + +(m[5] ?? 0) * 60 + +(m[6] ?? 0)) * 1000;
  return m[1] === "-" ? -ms : ms;
}

function unescape(v: string): string {
  return v.replace(/\\n/gi, " ").replace(/\\([,;\\])/g, "$1").trim();
}

type Prop = { name: string; params: Record<string, string>; value: string };

function parseLine(line: string): Prop | null {
  // NAME;PARAM=a;PARAM2="b:c":VALUE — the first colon outside quotes ends the name/params.
  let inQuote = false;
  let i = 0;
  for (; i < line.length; i++) {
    const c = line[i];
    if (c === '"') inQuote = !inQuote;
    else if (c === ":" && !inQuote) break;
  }
  if (i >= line.length) return null;
  const [name, ...rawParams] = line.slice(0, i).split(";");
  const params: Record<string, string> = {};
  for (const p of rawParams) {
    const eq = p.indexOf("=");
    if (eq > 0) params[p.slice(0, eq).toUpperCase()] = p.slice(eq + 1).replace(/^"|"$/g, "");
  }
  return { name: name.toUpperCase(), params, value: line.slice(i + 1) };
}

type Raw = { uid: string; start: Stamp | null; end: Stamp | null; duration: number; title: string; rrule: string; exdates: Stamp[]; recurrenceId: Stamp | null; cancelled: boolean };

const BYDAY: Record<string, number> = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };

export function eventsBetween(ics: string, from: number, to: number): IcsEvent[] {
  const lines = ics.replace(/\r\n?/g, "\n").replace(/\n[ \t]/g, "").split("\n");
  let calTz = DEFAULT_TZ;
  const raws: Raw[] = [];
  let cur: Raw | null = null;
  for (const line of lines) {
    const p = parseLine(line);
    if (!p) continue;
    if (p.name === "X-WR-TIMEZONE") calTz = validTz(p.value.trim());
    if (p.name === "BEGIN" && p.value.trim() === "VEVENT") cur = { uid: "", start: null, end: null, duration: 0, title: "", rrule: "", exdates: [], recurrenceId: null, cancelled: false };
    else if (p.name === "END" && p.value.trim() === "VEVENT") {
      if (cur) raws.push(cur);
      cur = null;
    } else if (cur) {
      if (p.name === "UID") cur.uid = p.value.trim();
      else if (p.name === "DTSTART") cur.start = parseStamp(p.value, p.params);
      else if (p.name === "DTEND") cur.end = parseStamp(p.value, p.params);
      else if (p.name === "DURATION") cur.duration = parseDuration(p.value.trim());
      else if (p.name === "SUMMARY") cur.title = unescape(p.value);
      else if (p.name === "RRULE") cur.rrule = p.value.trim();
      else if (p.name === "EXDATE") for (const v of p.value.split(",")) {
        const st = parseStamp(v, p.params);
        if (st) cur.exdates.push(st);
      }
      else if (p.name === "RECURRENCE-ID") cur.recurrenceId = parseStamp(p.value, p.params);
      else if (p.name === "STATUS" && p.value.trim().toUpperCase() === "CANCELLED") cur.cancelled = true;
    }
  }

  // Single moved or cancelled lessons replace that occurrence of their series.
  const overrides = new Map<string, Set<number>>();
  for (const r of raws) {
    if (!r.recurrenceId) continue;
    const set = overrides.get(r.uid) ?? new Set<number>();
    set.add(toMs(r.recurrenceId, calTz));
    overrides.set(r.uid, set);
  }

  const out: IcsEvent[] = [];
  const push = (start: number, end: number, title: string) => {
    if (end > from && start < to) out.push({ start, end, title });
  };

  for (const r of raws) {
    if (!r.start || r.start.allDay) continue;
    const baseStart = toMs(r.start, calTz);
    const length = r.end ? toMs(r.end, calTz) - baseStart : r.duration || 3600_000;
    if (r.cancelled) continue;
    if (!r.rrule || r.recurrenceId) {
      push(baseStart, baseStart + length, r.title);
      continue;
    }
    const rule = Object.fromEntries(r.rrule.split(";").map((kv) => kv.split("=") as [string, string]));
    const freq = (rule.FREQ ?? "").toUpperCase();
    if (freq !== "WEEKLY" && freq !== "DAILY") {
      push(baseStart, baseStart + length, r.title);
      continue;
    }
    const interval = Math.max(1, Number(rule.INTERVAL) || 1);
    const count = Number(rule.COUNT) || Infinity;
    const untilSt = rule.UNTIL ? parseStamp(rule.UNTIL, {}) : null;
    const until = untilSt ? (untilSt.allDay ? toMs({ ...untilSt, h: 23, mi: 59, s: 59 }, calTz) : toMs(untilSt, calTz)) : Infinity;
    const days = freq === "WEEKLY" ? (rule.BYDAY ? rule.BYDAY.split(",").map((d) => BYDAY[d.slice(-2).toUpperCase()]).filter((d) => d !== undefined) : [new Date(Date.UTC(r.start.y, r.start.mo - 1, r.start.d)).getUTCDay()]) : null;
    const tz = r.start.utc ? "UTC" : r.start.tz ? validTz(r.start.tz) : calTz;
    const ex = new Set(r.exdates.map((e) => toMs(e, calTz)));
    const moved = overrides.get(r.uid);
    const startDay = Date.UTC(r.start.y, r.start.mo - 1, r.start.d);
    // Week index counts from the Monday of the first week, as iCal does by default (WKST=MO).
    const startMonday = startDay - ((new Date(startDay).getUTCDay() + 6) % 7) * 86400000;
    let n = 0;
    // Without a COUNT, jump straight to a couple of days before the window instead of walking from the first lesson.
    const first = count === Infinity && from - 2 * 86400000 > startDay ? startDay + Math.floor((from - 2 * 86400000 - startDay) / 86400000) * 86400000 : startDay;
    for (let day = first; n < count; day += 86400000) {
      const dt = new Date(day);
      const occ = zoned(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate(), r.start.h, r.start.mi, r.start.s, tz);
      if (occ > until || occ >= to) break;
      let hit: boolean;
      if (days) {
        const week = Math.floor((day - startMonday) / (7 * 86400000));
        hit = week % interval === 0 && days.includes(dt.getUTCDay());
      } else hit = Math.round((day - startDay) / 86400000) % interval === 0;
      if (!hit) continue;
      n++;
      if (ex.has(occ) || moved?.has(occ)) continue;
      push(occ, occ + length, r.title);
    }
  }
  return out.sort((a, b) => a.start - b.start);
}
