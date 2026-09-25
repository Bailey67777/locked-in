import type { DayRecord, Settings } from "./types";
import { addDays, lastNDays, parseKey } from "./dates";
import { habitsComplete, hasJournal, materializeDay } from "./model";

type Days = Record<string, DayRecord>;

function doneOn(days: Days, date: string, habitId: string): boolean {
  const h = days[date]?.habits.find((x) => x.id === habitId);
  return Boolean(h?.done);
}

/** Consecutive days (ending today, or yesterday if today isn't ticked yet) on which this habit was done. */
export function habitStreak(days: Days, habitId: string, today: string): { current: number; best: number } {
  let current = 0;
  let cursor = doneOn(days, today, habitId) ? today : addDays(today, -1);
  while (doneOn(days, cursor, habitId)) {
    current++;
    cursor = addDays(cursor, -1);
    if (current > 3650) break;
  }
  let best = 0;
  let run = 0;
  let prev: string | null = null;
  for (const key of Object.keys(days).sort()) {
    const done = doneOn(days, key, habitId);
    if (done) run = prev && addDays(prev, 1) === key ? run + 1 : 1;
    else run = 0;
    prev = done ? key : null;
    best = Math.max(best, run);
  }
  return { current, best: Math.max(best, current) };
}

/** Whole-day streak: every habit ticked. */
export function dayStreak(days: Days, settings: Settings, today: string): { current: number; best: number } {
  const complete = (d: string) => Boolean(days[d]) && habitsComplete(materializeDay(d, days[d], settings, today));
  let current = 0;
  let cursor = complete(today) ? today : addDays(today, -1);
  while (complete(cursor)) {
    current++;
    cursor = addDays(cursor, -1);
    if (current > 3650) break;
  }
  let best = 0;
  let run = 0;
  let prev: string | null = null;
  for (const key of Object.keys(days).sort()) {
    const c = complete(key);
    if (c) run = prev && addDays(prev, 1) === key ? run + 1 : 1;
    else run = 0;
    prev = c ? key : null;
    best = Math.max(best, run);
  }
  return { current, best: Math.max(best, current) };
}

export type HabitStat = {
  id: string;
  name: string;
  done: number;
  tracked: number;
  pct: number;
  current: number;
  best: number;
};

/** Per-habit completion over the last n days (only counting days that have an entry) plus streaks. */
export function habitStats(days: Days, settings: Settings, today: string, n = 30): HabitStat[] {
  const window = lastNDays(today, n);
  return settings.habits.map((h) => {
    let done = 0;
    let tracked = 0;
    for (const d of window) {
      const day = days[d];
      if (!day) continue;
      const hit = day.habits.find((x) => x.id === h.id);
      if (!hit) continue;
      tracked++;
      if (hit.done) done++;
    }
    const s = habitStreak(days, h.id, today);
    return { id: h.id, name: h.name, done, tracked, pct: tracked ? Math.round((done / tracked) * 100) : 0, current: s.current, best: s.best };
  });
}

export type WeekSummary = {
  habitPct: number | null;
  avgDay: number | null;
  avgHealth: number | null;
  avgHappy: number | null;
  /** Average phone screen time in minutes, over days where it was entered. */
  avgScreen: number | null;
  daysTracked: number;
  fullDays: number;
};

function summarize(days: Days, settings: Settings, today: string, dates: string[]): WeekSummary {
  let done = 0;
  let total = 0;
  const rd: number[] = [];
  const rh: number[] = [];
  const rp: number[] = [];
  const screen: number[] = [];
  let tracked = 0;
  let full = 0;
  for (const d of dates) {
    const stored = days[d];
    if (!stored) continue;
    tracked++;
    const day = materializeDay(d, stored, settings, today);
    total += day.habits.length;
    done += day.habits.filter((h) => h.done).length;
    if (habitsComplete(day)) full++;
    if (day.ratings.day) rd.push(day.ratings.day);
    if (day.ratings.health) rh.push(day.ratings.health);
    if (day.ratings.happy) rp.push(day.ratings.happy);
    if (typeof day.screenMinutes === "number") screen.push(day.screenMinutes);
  }
  const avg = (a: number[]) => (a.length ? Math.round((a.reduce((x, y) => x + y, 0) / a.length) * 10) / 10 : null);
  return { habitPct: total ? Math.round((done / total) * 100) : null, avgDay: avg(rd), avgHealth: avg(rh), avgHappy: avg(rp), avgScreen: screen.length ? Math.round(screen.reduce((x, y) => x + y, 0) / screen.length) : null, daysTracked: tracked, fullDays: full };
}

export function thisWeekVsLast(days: Days, settings: Settings, today: string): { thisWeek: WeekSummary; lastWeek: WeekSummary } {
  const thisWeek = lastNDays(today, 7);
  const lastWeek = lastNDays(addDays(today, -7), 7);
  return { thisWeek: summarize(days, settings, today, thisWeek), lastWeek: summarize(days, settings, today, lastWeek) };
}

export type Insight = { emoji: string; text: string };

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** Plain-English observations from the data. Only says things it has enough evidence for. */
export function insights(days: Days, settings: Settings, today: string): Insight[] {
  const out: Insight[] = [];
  const keys = Object.keys(days).filter((k) => k <= today).sort();
  if (keys.length === 0) return out;

  // 1. Which habit lines up with your best days?
  const rated = keys.filter((k) => days[k].ratings.day > 0);
  if (rated.length >= 6) {
    let bestGap = 0;
    let bestHabit: { name: string; withAvg: number; withoutAvg: number } | null = null;
    for (const h of settings.habits) {
      const withH: number[] = [];
      const withoutH: number[] = [];
      for (const k of rated) {
        const hit = days[k].habits.find((x) => x.id === h.id);
        if (!hit) continue;
        (hit.done ? withH : withoutH).push(days[k].ratings.day);
      }
      if (withH.length >= 3 && withoutH.length >= 3) {
        const a = withH.reduce((x, y) => x + y, 0) / withH.length;
        const b = withoutH.reduce((x, y) => x + y, 0) / withoutH.length;
        if (a - b > bestGap) {
          bestGap = a - b;
          bestHabit = { name: h.name, withAvg: a, withoutAvg: b };
        }
      }
    }
    if (bestHabit && bestGap >= 0.8) {
      out.push({
        emoji: "🔗",
        text: `Days you did "${bestHabit.name}" you rated the day ${bestHabit.withAvg.toFixed(1)} on average, versus ${bestHabit.withoutAvg.toFixed(1)} when you skipped it.`,
      });
    }
  }

  // 2. Best weekday for habits
  if (keys.length >= 10) {
    const byDow: { done: number; total: number }[] = Array.from({ length: 7 }, () => ({ done: 0, total: 0 }));
    for (const k of keys) {
      const dow = parseKey(k).getDay();
      for (const h of days[k].habits) {
        byDow[dow].total++;
        if (h.done) byDow[dow].done++;
      }
    }
    const scored = byDow.map((d, i) => ({ i, pct: d.total ? d.done / d.total : -1, total: d.total })).filter((d) => d.total >= 6);
    if (scored.length >= 3) {
      const best = scored.reduce((a, b) => (b.pct > a.pct ? b : a));
      const worst = scored.reduce((a, b) => (b.pct < a.pct ? b : a));
      if (best.pct - worst.pct >= 0.15) {
        out.push({ emoji: "📅", text: `${WEEKDAYS[best.i]}s are your strongest day (${Math.round(best.pct * 100)}% of habits). ${WEEKDAYS[worst.i]}s are the weak spot (${Math.round(worst.pct * 100)}%).` });
      }
    }
  }

  // 3. Most-missed habit in the last 14 days
  const recent = lastNDays(today, 14).filter((k) => days[k]);
  if (recent.length >= 5) {
    let worst: { name: string; missed: number; tracked: number } | null = null;
    for (const h of settings.habits) {
      let missed = 0;
      let tracked = 0;
      for (const k of recent) {
        const hit = days[k].habits.find((x) => x.id === h.id);
        if (!hit) continue;
        tracked++;
        if (!hit.done) missed++;
      }
      if (tracked >= 5 && (!worst || missed / tracked > worst.missed / worst.tracked)) worst = { name: h.name, missed, tracked };
    }
    if (worst && worst.missed >= 3) {
      out.push({ emoji: "🎯", text: `"${worst.name}" is the one slipping: missed ${worst.missed} of the last ${worst.tracked} tracked days. Make it the first thing you protect tomorrow.` });
    }
  }

  // 4. Sleep-ish: evening habit vs next-day health rating
  const evening = settings.habits.find((h) => /evening|bed|sleep|lights|wind/i.test(h.name));
  if (evening) {
    const withE: number[] = [];
    const withoutE: number[] = [];
    for (const k of keys) {
      const next = addDays(k, 1);
      const nh = days[next]?.ratings.health;
      if (!nh) continue;
      const hit = days[k].habits.find((x) => x.id === evening.id);
      if (!hit) continue;
      (hit.done ? withE : withoutE).push(nh);
    }
    if (withE.length >= 3 && withoutE.length >= 3) {
      const a = withE.reduce((x, y) => x + y, 0) / withE.length;
      const b = withoutE.reduce((x, y) => x + y, 0) / withoutE.length;
      if (a - b >= 0.8) out.push({ emoji: "😴", text: `After a night you did "${evening.name}", the next day's health rating averaged ${a.toFixed(1)} vs ${b.toFixed(1)}.` });
    }
  }

  // 5. Journal consistency
  const journaled = keys.filter((k) => hasJournal(days[k])).length;
  if (keys.length >= 7) {
    const pct = Math.round((journaled / keys.length) * 100);
    out.push({ emoji: "📓", text: pct >= 70 ? `You've journaled on ${pct}% of tracked days. That's the evidence pile growing.` : `Journal written on ${pct}% of tracked days. One honest line counts.` });
  }

  // 6. Momentum
  const { thisWeek, lastWeek } = thisWeekVsLast(days, settings, today);
  if (thisWeek.habitPct !== null && lastWeek.habitPct !== null && thisWeek.daysTracked >= 3 && lastWeek.daysTracked >= 3) {
    const diff = thisWeek.habitPct - lastWeek.habitPct;
    if (Math.abs(diff) >= 8) {
      out.push({ emoji: diff > 0 ? "📈" : "📉", text: diff > 0 ? `Habits are up ${diff} points on last week (${lastWeek.habitPct}% → ${thisWeek.habitPct}%). Keep the anchors.` : `Habits are down ${-diff} points on last week (${lastWeek.habitPct}% → ${thisWeek.habitPct}%). Drop the optional stuff, keep sleep and the block.` });
    }
  }

  return out;
}

/** How submitted days have landed over the last n days. */
export function tierCounts(days: Days, today: string, n = 30): Record<"t80" | "t50" | "t25" | "t0", number> {
  const out = { t80: 0, t50: 0, t25: 0, t0: 0 };
  for (const d of lastNDays(today, n)) {
    const sub = days[d]?.submitted;
    if (sub) out[sub.tier]++;
  }
  return out;
}
