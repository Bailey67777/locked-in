import type { DayRecord, Settings } from "./types";
import { addDays, lastNDays } from "./dates";
import { dayProgress, materializeDay } from "./model";

type Days = Record<string, DayRecord>;

/** A day counts towards a streak at this percentage or more. */
export const STREAK_PCT = 80;

/** The day's percentage, or null if nothing was ever recorded for it. */
export function pctOn(days: Days, settings: Settings, date: string, today: string): number | null {
  const stored = days[date];
  if (!stored) return null;
  return dayProgress(materializeDay(date, stored, settings, today)).pct;
}

/** Days in a row at 80%+, ending today (or yesterday while today is still in progress). */
export function streak(days: Days, settings: Settings, today: string): { current: number; best: number } {
  const hit = (d: string) => (pctOn(days, settings, d, today) ?? 0) >= STREAK_PCT;
  let current = 0;
  let cursor = hit(today) ? today : addDays(today, -1);
  while (hit(cursor) && current < 3650) {
    current++;
    cursor = addDays(cursor, -1);
  }
  let best = 0;
  let run = 0;
  let prev: string | null = null;
  for (const d of Object.keys(days).sort()) {
    if (d > today) break;
    if (hit(d)) run = prev && addDays(prev, 1) === d ? run + 1 : 1;
    else run = 0;
    prev = hit(d) ? d : null;
    best = Math.max(best, run);
  }
  return { current, best: Math.max(best, current) };
}

/** Average percentage over the last n days that have anything recorded, and how many that was. */
export function average(days: Days, settings: Settings, today: string, n: number): { pct: number | null; tracked: number } {
  const pcts = lastNDays(today, n)
    .map((d) => pctOn(days, settings, d, today))
    .filter((p): p is number => p !== null);
  return { pct: pcts.length ? Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length) : null, tracked: pcts.length };
}

/** Each day of the last n: its percentage, or null. Oldest first. */
export function lastDays(days: Days, settings: Settings, today: string, n: number): { date: string; pct: number | null }[] {
  return lastNDays(today, n).map((date) => ({ date, pct: pctOn(days, settings, date, today) }));
}

/** For each current habit: how often it got done over the last n days it was on the list. */
export function habitRates(days: Days, settings: Settings, today: string, n: number): { id: string; name: string; done: number; of: number }[] {
  const dates = lastNDays(today, n).filter((d) => days[d]);
  return settings.habits.map((h) => {
    let done = 0;
    let of = 0;
    for (const d of dates) {
      const hit = materializeDay(d, days[d], settings, today).habits.find((x) => x.id === h.id);
      if (!hit) continue;
      of++;
      if (hit.done) done++;
    }
    return { id: h.id, name: h.name, done, of };
  });
}
