"use client";

import { useState } from "react";
import { useHub } from "@/lib/hub/store";
import { useStore } from "@/lib/store";
import { useCalendarDay } from "@/lib/hub/calendar";
import { clockOf, lessonsFor, minutesOf, planFor, spanOf } from "@/lib/hub/model";
import { SUBJECT_META } from "@/lib/hub/subjects";
import { addDays, formatLong, parseKey, weekStartOf } from "@/lib/dates";
import { haptic, playTodo, playUntick } from "@/lib/sounds";
import { REPLAN_URL } from "@/lib/replan";
import type { PlanTask } from "@/lib/hub/types";
import { cn } from "@/lib/cn";
import { CheckIcon, ChevronIcon, PlusIcon, ReplanIcon } from "./Icons";
import PlanSheet, { PLAN_PAINT, type PlanTarget } from "./PlanSheet";

const LETTERS = ["M", "T", "W", "T", "F", "S", "S"];
/** A gap this long between two things is worth saying out loud. */
const GAP_MIN = 20;

/** The bar's height says how long the thing takes: a quarter of an hour is a square, two hours a tall bar. */
const barHeight = (dur: number) => Math.round(Math.min(118, Math.max(22, 22 + (dur - 15) * 0.7)));

type Item =
  | { kind: "task"; key: string; start: number; dur: number; paint: string; title: string; task: PlanTask }
  | { kind: "lesson"; key: string; start: number; dur: number; paint: string; title: string };

/**
 * The day as one line down the page. Everything planned sits on it at its time, as a bar whose height is how long
 * it takes; lessons from the calendar are on it too, in their subject's colour. Tap a bar to tick it off, tap its
 * name to change it. Today, a lit line marks the time now. The week runs along the top.
 */
export default function PlanView() {
  const { data, today, now, write } = useHub();
  const habits = useStore();
  const soundsOn = habits.data.settings.soundsOn;
  const [picked, setPicked] = useState<string | null>(null);
  const date = picked ?? today;
  const [open, setOpen] = useState<PlanTarget | null>(null);

  const settings = data.settings;
  const { events, error } = useCalendarDay(settings.calendarUrl, date);
  const lessons = lessonsFor(date, settings.calendarUrl && events === null && error ? { ...settings, calendarUrl: "" } : settings, events).filter((l) => l.start);
  // Something that is also a habit takes its tick from the Habits page, and gives it back: one tick, not two.
  const habitDay = habits.getDay(date);
  const tasks = planFor(date, data.plan).map((t) => {
    const habit = t.habit ? habitDay.habits.find((h) => h.id === t.habit) : undefined;
    return habit ? { ...t, done: habit.done ? 1 : 0 } : { ...t, habit: undefined };
  });

  const items: Item[] = [
    ...tasks.map((t): Item => ({ kind: "task", key: t.id, start: t.start, dur: t.dur, paint: PLAN_PAINT[t.color], title: t.title, task: t })),
    ...lessons.map((l): Item => {
      const start = minutesOf(l.start as string);
      const end = l.end ? minutesOf(l.end) : -1;
      return { kind: "lesson", key: `lesson-${l.key}`, start, dur: end > start ? end - start : 45, paint: SUBJECT_META[l.subject].color, title: l.title?.trim() || SUBJECT_META[l.subject].name };
    }),
  ].sort((a, b) => a.start - b.start);

  const isToday = date === today;
  const nowMin = now ? new Date(now).getHours() * 60 + new Date(now).getMinutes() : -1;
  // The lit line goes above the first thing that hasn't started yet.
  const nowBefore = isToday && nowMin >= 0 ? items.findIndex((i) => i.start > nowMin) : -2;
  const left = tasks.filter((t) => !t.done).length;

  const toggle = (t: PlanTask, at: number) => {
    if (t.habit) {
      if (date > today) return; // a habit can't be ticked for a day that hasn't come
      habits.updateDay(date, (d) => ({ ...d, habits: d.habits.map((h) => (h.id === t.habit ? { ...h, done: !h.done } : h)) }));
      haptic(t.done ? 6 : 10);
      if (soundsOn) (t.done ? playUntick : playTodo)();
      return;
    }
    const entry = data.plan.days[date]?.[t.id] ?? {};
    const next = { ...entry, done: t.done ? undefined : at };
    const rest = Object.fromEntries(Object.entries(next).filter(([, v]) => v !== undefined));
    write(`plan/days/${date}/${t.id}`, Object.keys(rest).length ? rest : null);
    haptic(t.done ? 6 : 10);
    if (soundsOn) (t.done ? playUntick : playTodo)();
  };

  /** A new thing starts at the next quarter-hour today, or at nine on another day. */
  const add = () => setOpen({ kind: "new", date, start: isToday && nowMin >= 0 ? Math.min(1425, Math.ceil((nowMin + 1) / 15) * 15) : 540 });

  const monday = weekStartOf(date);
  const NowLine = (
    <li className="flex items-center gap-3 py-2" aria-label={`Now, ${clockOf(Math.max(0, nowMin))}`}>
      <span className="w-[46px] shrink-0 text-right text-[13px] font-semibold tabular-nums text-[var(--accent)]">{clockOf(Math.max(0, nowMin))}</span>
      <span className="lit-bar h-[2px] flex-1 rounded-full bg-[var(--accent)]" />
    </li>
  );

  return (
    <div className="fade-up">
      <header className="mb-6">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-[36px] font-bold leading-none tracking-[-0.04em]">Plan</h1>
          <div className="flex shrink-0 items-center gap-2.5">
            <a href={settings.quickChat || REPLAN_URL} target="_blank" rel="noopener noreferrer" className="tap flex h-11 w-11 items-center justify-center rounded-full border-[1.5px] border-ink text-ink" aria-label="Replan with Claude">
              <ReplanIcon />
            </a>
            <button type="button" onClick={add} className="tap flex h-11 w-11 items-center justify-center rounded-full bg-ink text-bg" aria-label="Add to the plan">
              <PlusIcon width={20} height={20} />
            </button>
          </div>
        </div>
        <button type="button" onClick={() => setPicked(null)} className="mt-3 text-[14px] text-muted" aria-label={isToday ? "Today" : "Back to today"}>
          {formatLong(date)}
          {!isToday && <span className="ml-2 text-ink">Today</span>}
        </button>

        <div className="mt-4 flex items-stretch">
          <button type="button" onClick={() => setPicked(addDays(date, -7))} className="-ml-2 flex w-8 items-center justify-center text-muted" aria-label="The week before">
            <ChevronIcon dir="left" width={15} height={15} />
          </button>
          <div className="grid flex-1 grid-cols-7">
            {LETTERS.map((letter, i) => {
              const d = addDays(monday, i);
              const on = d === date;
              return (
                <button key={d} type="button" onClick={() => setPicked(d === today ? null : d)} aria-pressed={on} aria-label={formatLong(d)} className="flex flex-col items-center gap-1.5 py-1">
                  <span className={cn("text-[11.5px]", d === today ? "text-[var(--accent)]" : "text-faint")}>{letter}</span>
                  <span
                    className={cn("flex h-8 w-8 items-center justify-center rounded-[9px] text-[15px] tabular-nums transition-colors", on ? "lit-bar bg-[var(--accent)] font-semibold text-[var(--on-accent)]" : d === today ? "text-[var(--accent)]" : "text-ink-2")}
                  >
                    {parseKey(d).getDate()}
                  </span>
                </button>
              );
            })}
          </div>
          <button type="button" onClick={() => setPicked(addDays(date, 7))} className="-mr-2 flex w-8 items-center justify-center text-muted" aria-label="The week after">
            <ChevronIcon width={15} height={15} />
          </button>
        </div>
      </header>

      {items.length ? (
        <ol>
          {items.map((item, i) => {
            const end = item.start + item.dur;
            const next = items[i + 1];
            const gap = next ? next.start - end : 0;
            const done = item.kind === "task" && item.task.done > 0;
            const current = isToday && nowMin >= item.start && nowMin < end && !done;
            const over = isToday && nowMin >= end;
            const h = barHeight(item.dur);
            return (
              <div key={item.key} className="contents">
                {nowBefore === i && NowLine}
                <li className="flex gap-3">
                  <span className={cn("w-[46px] shrink-0 pt-[2px] text-right text-[13px] tabular-nums", current ? "font-semibold text-ink" : "text-muted")}>{clockOf(item.start)}</span>
                  <span className="flex w-[22px] shrink-0 flex-col items-center">
                    {item.kind === "task" ? (
                      <button
                        type="button"
                        onClick={() => toggle(item.task, Date.now())}
                        aria-pressed={done}
                        aria-label={`${item.title}, ${done ? "done" : "not done"}`}
                        data-done={done || current || undefined}
                        className="tick tap flex w-[22px] shrink-0 items-start justify-center rounded-full border-[1.75px] pt-[3px] transition-colors duration-200"
                        style={{
                          height: h,
                          borderColor: done || current ? item.paint : `color-mix(in srgb, ${item.paint} 55%, var(--muted))`,
                          background: done ? item.paint : `color-mix(in srgb, ${item.paint} ${current ? 30 : 12}%, transparent)`,
                          color: "var(--on-accent)",
                          ["--glow" as string]: `color-mix(in srgb, ${item.paint} 70%, transparent)`,
                        }}
                      >
                        {done && <CheckIcon width={12} height={12} />}
                      </button>
                    ) : (
                      <span className="tick w-[22px] shrink-0 rounded-full" style={{ height: h, background: item.paint, opacity: over ? 0.45 : 1 }} aria-hidden="true" />
                    )}
                    <span className={cn("w-px flex-1", next ? "min-h-[14px] bg-line" : "")} />
                  </span>
                  {item.kind === "task" ? (
                    <button type="button" onClick={() => setOpen({ kind: "task", date, task: item.task })} className="min-w-0 flex-1 pb-4 text-left">
                      <span className={cn("block truncate text-[17px] tracking-[-0.015em] transition-colors", current ? "font-semibold" : "font-medium", done ? "text-muted" : "text-ink")}>{item.title}</span>
                      <span className="mt-0.5 block text-[12.5px] tabular-nums text-muted">
                        {item.dur > 1 ? `${spanOf(item.dur)}, until ${clockOf(end)}` : "A moment"}
                        {item.task.repeats ? " (repeats)" : ""}
                      </span>
                    </button>
                  ) : (
                    <span className="min-w-0 flex-1 pb-4">
                      <span className={cn("block truncate text-[17px] font-medium tracking-[-0.015em]", over ? "text-muted" : "text-ink")}>{item.title}</span>
                      <span className="mt-0.5 block text-[12.5px] tabular-nums text-muted">Lesson, until {clockOf(end)}</span>
                    </span>
                  )}
                </li>
                {gap >= GAP_MIN && (
                  <li className="flex gap-3" aria-hidden="true">
                    <span className="w-[46px] shrink-0" />
                    <span className="flex w-[22px] shrink-0 justify-center">
                      <span className="h-8 w-px" style={{ backgroundImage: "linear-gradient(var(--line) 50%, transparent 50%)", backgroundSize: "1px 7px" }} />
                    </span>
                    <span className="flex items-center text-[12.5px] text-faint">{spanOf(gap)} free</span>
                  </li>
                )}
              </div>
            );
          })}
          {nowBefore === -1 && NowLine}
        </ol>
      ) : (
        <div className="border-y border-line py-10 text-center">
          <p className="text-[15px] text-muted">Nothing planned for this day.</p>
          <button type="button" onClick={add} className="btn mt-5">
            Add the first thing
          </button>
        </div>
      )}

      {tasks.length > 0 && <p className="mt-6 text-center text-[12.5px] tabular-nums text-faint">{left ? `${left} of ${tasks.length} still to do` : "All done"}</p>}

      {open && <PlanSheet target={open} onClose={() => setOpen(null)} />}
    </div>
  );
}
