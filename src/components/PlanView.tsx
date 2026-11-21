"use client";

import { useState } from "react";
import { useHub } from "@/lib/hub/store";
import { useStore } from "@/lib/store";
import { useCalendarDay } from "@/lib/hub/calendar";
import { clockOf, lessonsFor, minutesOf, planFor } from "@/lib/hub/model";
import { autoIcon } from "@/lib/hub/planIcons";
import { SUBJECT_META } from "@/lib/hub/subjects";
import { addDays, formatLong, parseKey, weekStartOf } from "@/lib/dates";
import { haptic, playTodo, playUntick } from "@/lib/sounds";
import { REPLAN_URL } from "@/lib/replan";
import type { PlanTask } from "@/lib/hub/types";
import { cn } from "@/lib/cn";
import { CheckIcon, ChevronIcon, PlusIcon, ReplanIcon } from "./Icons";
import PlanSheet, { PLAN_PAINT, type PlanTarget } from "./PlanSheet";

const LETTERS = ["M", "T", "W", "T", "F", "S", "S"];
/** The bubble's height says how long the thing takes: up to a quarter of an hour is a square, two hours a tall one. */
const bubbleHeight = (dur: number) => Math.round(Math.min(132, Math.max(44, 44 + (dur - 15) * 0.6)));
/** Free time shows as space, a little for half an hour and more for an afternoon, never as words. */
const gapSpace = (minutes: number) => Math.round(Math.min(44, Math.max(0, minutes) / 5));
const LESSON_ICON: Record<string, string> = { maths: "📐", physics: "⚛️", econ: "📈" };

type Item =
  | { kind: "task"; key: string; start: number; dur: number; paint: string; icon: string; title: string; task: PlanTask }
  | { kind: "lesson"; key: string; start: number; dur: number; paint: string; icon: string; title: string };

/**
 * The day as one line down the page. Everything planned sits on it in order, as a bubble with its picture, as tall
 * as the thing is long, with its time above its name; lessons from the calendar are on it too. The bubble is the
 * tick: tap it and it fills with colour. The name opens it. Free time is simply space. Today, a lit line marks the time now.
 * The week runs along the top.
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
    ...tasks.map((t): Item => ({ kind: "task", key: t.id, start: t.start, dur: t.dur, paint: PLAN_PAINT[t.color], icon: t.icon || autoIcon(t.title), title: t.title, task: t })),
    ...lessons.map((l): Item => {
      const start = minutesOf(l.start as string);
      const end = l.end ? minutesOf(l.end) : -1;
      return { kind: "lesson", key: `lesson-${l.key}`, start, dur: end > start ? end - start : 45, paint: SUBJECT_META[l.subject].color, icon: LESSON_ICON[l.subject] ?? "🎓", title: l.title?.trim() || SUBJECT_META[l.subject].name };
    }),
  ].sort((a, b) => a.start - b.start);

  // What repeats can be dropped for one day ("no plan today") and brought back.
  const repeating = tasks.filter((t) => t.repeats);
  const skipped = Object.entries(data.plan.days[date] ?? {})
    .filter(([id, e]) => e.skip && data.plan.rules[id])
    .map(([id]) => id);

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
    <li className="flex items-center gap-3.5 py-2.5" aria-label={`Now, ${clockOf(Math.max(0, nowMin))}`}>
      <span className="w-11 shrink-0 text-center text-[13px] font-semibold tabular-nums text-[var(--accent)]">{clockOf(Math.max(0, nowMin))}</span>
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
            const done = item.kind === "task" && item.task.done > 0;
            const current = isToday && nowMin >= item.start && nowMin < end && !done;
            const over = isToday && nowMin >= end;
            const faded = over && item.kind === "lesson";
            const height = bubbleHeight(item.dur);
            const glow = `color-mix(in srgb, ${item.paint} 55%, transparent)`;
            return (
              <div key={item.key} className="contents">
                {nowBefore === i && NowLine}
                <li className="flex gap-3.5">
                  <span className="flex w-11 shrink-0 flex-col items-center">
                    {item.kind === "task" ? (
                      // The bubble is the tick: tap it and it fills with colour.
                      <button
                        type="button"
                        onClick={() => toggle(item.task, Date.now())}
                        aria-pressed={done}
                        aria-label={`${item.title}, ${done ? "done" : "not done"}`}
                        className="tap flex w-11 shrink-0 items-center justify-center rounded-full text-[21px] leading-none transition-[background-color,box-shadow] duration-300"
                        style={{
                          height,
                          background: done ? item.paint : `color-mix(in srgb, ${item.paint} ${current ? 30 : 17}%, var(--surface))`,
                          color: "var(--on-accent)",
                          boxShadow: done ? `0 0 16px ${glow}` : current ? `0 0 0 1.5px ${item.paint}, 0 0 18px ${glow}` : undefined,
                        }}
                      >
                        {done ? <CheckIcon width={19} height={19} strokeWidth={2.2} /> : <span aria-hidden="true">{item.icon}</span>}
                      </button>
                    ) : (
                      <span className="flex w-11 shrink-0 items-center justify-center rounded-full text-[21px] leading-none" style={{ height, background: `color-mix(in srgb, ${item.paint} 17%, var(--surface))`, opacity: faded ? 0.45 : 1 }} aria-hidden="true">
                        {item.icon}
                      </span>
                    )}
                    {next && <span className="w-px flex-1 bg-line" style={{ minHeight: 12 + gapSpace(next.start - end) }} />}
                  </span>
                  {item.kind === "task" ? (
                    <button type="button" onClick={() => setOpen({ kind: "task", date, task: item.task })} className="min-w-0 flex-1 self-start pt-[3px] text-left" aria-label={`Change ${item.title}`}>
                      <span className={cn("block text-[12.5px] tabular-nums", current ? "font-semibold text-[var(--accent)]" : "text-muted")}>
                        {clockOf(item.start)}
                        {item.dur > 5 ? ` to ${clockOf(end)}` : ""}
                      </span>
                      <span className={cn("block truncate text-[17px] tracking-[-0.015em] transition-colors", current ? "font-semibold" : "font-medium", done ? "text-muted line-through decoration-1" : "text-ink")}>{item.title}</span>
                    </button>
                  ) : (
                    <span className="min-w-0 flex-1 self-start pt-[3px]">
                      <span className="block text-[12.5px] tabular-nums text-muted">
                        {clockOf(item.start)} to {clockOf(end)}
                      </span>
                      <span className={cn("block truncate text-[17px] font-medium tracking-[-0.015em]", faded ? "text-muted" : "text-ink")}>{item.title}</span>
                    </span>
                  )}
                </li>
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
      {(repeating.length > 0 || skipped.length > 0) && (
        <div className="mt-2 flex justify-center gap-2 text-[13px] text-muted">
          {repeating.length > 0 && (
            <button type="button" onClick={() => repeating.forEach((t) => write(`plan/days/${date}/${t.id}`, { skip: true }))} className="h-10 px-3">
              No plan this day
            </button>
          )}
          {skipped.length > 0 && (
            <button type="button" onClick={() => skipped.forEach((id) => write(`plan/days/${date}/${id}`, null))} className="h-10 px-3 text-ink">
              Bring the plan back
            </button>
          )}
        </div>
      )}

      {open && <PlanSheet target={open} onClose={() => setOpen(null)} />}
    </div>
  );
}
