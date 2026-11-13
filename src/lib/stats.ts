import type { DayRecord, Settings } from "./types";
import { addDays } from "./dates";
import { dayProgress, materializeDay } from "./model";
import { START_DATE } from "./defaults";

type Days = Record<string, DayRecord>;

export const startOf = (settings: Settings) => settings.startDate ?? START_DATE;

/** Days that count: from the start date up to yesterday, plus today once it's submitted. */
function counted(days: Days, start: string, today: string, from: string): string[] {
  const out: string[] = [];
  for (let d = from < start ? start : from; d < today; d = addDays(d, 1)) out.push(d);
  if (today >= start && days[today]?.submitted) out.push(today);
  return out;
}

/**
 * A day's percentage. Before the start date there is nothing (null). From the start, a past day nobody opened the
 * app on counts as 0%: if it wasn't ticked, it didn't happen.
 */
export function pctOn(days: Days, settings: Settings, date: string, today: string): number | null {
  if (date < startOf(settings) || date > today) return null;
  const stored = days[date];
  if (!stored) return date < today ? 0 : null;
  return dayProgress(materializeDay(date, stored, settings, today)).pct;
}

/** The must-do (the top habit) wasn't ticked on this day. Today only counts once it's submitted. */
export function topMissed(days: Days, settings: Settings, date: string, today: string): boolean {
  const top = settings.habits[0];
  if (!top || date < startOf(settings) || date > today) return false;
  if (date === today && !days[today]?.submitted) return false;
  const stored = days[date];
  if (!stored) return true;
  const hit = materializeDay(date, stored, settings, today).habits.find((h) => h.id === top.id);
  return hit ? !hit.done : false;
}

/** Average percentage over the counted days in the last n, or null if none count yet. */
export function average(days: Days, settings: Settings, today: string, n: number): number | null {
  const dates = counted(days, startOf(settings), today, addDays(today, -(n - 1)));
  if (!dates.length) return null;
  return Math.round(dates.reduce((sum, d) => sum + (pctOn(days, settings, d, today) ?? 0), 0) / dates.length);
}

/**
 * Thirty bars. For the first month they run from the start date forwards (days still to come stay empty);
 * after that, the last thirty days.
 */
export function chartDays(days: Days, settings: Settings, today: string): { date: string; pct: number | null; future: boolean }[] {
  const start = startOf(settings);
  const first = addDays(today, -29) > start ? addDays(today, -29) : start;
  return Array.from({ length: 30 }, (_, i) => {
    const date = addDays(first, i);
    return { date, pct: pctOn(days, settings, date, today), future: date > today };
  });
}

/** For each habit: done / counted days over the last n. */
export function habitRates(days: Days, settings: Settings, today: string, n: number): { id: string; name: string; done: number; of: number }[] {
  const dates = counted(days, startOf(settings), today, addDays(today, -(n - 1)));
  return settings.habits.map((h) => {
    let done = 0;
    for (const d of dates) {
      const stored = days[d];
      if (stored && materializeDay(d, stored, settings, today).habits.find((x) => x.id === h.id)?.done) done++;
    }
    return { id: h.id, name: h.name, done, of: dates.length };
  });
}
