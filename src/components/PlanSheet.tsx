"use client";

import { useState } from "react";
import { useHub } from "@/lib/hub/store";
import { useStore } from "@/lib/store";
import { PLAN_COLORS, clockOf, minutesOf, spanOf, uid } from "@/lib/hub/model";
import { weekday } from "@/lib/hub/time";
import type { PlanColor, PlanEntry, PlanTask } from "@/lib/hub/types";
import { cn } from "@/lib/cn";
import Sheet from "./Sheet";

export type PlanTarget = { kind: "new"; date: string; start: number } | { kind: "task"; date: string; task: PlanTask };

/** How each colour is drawn: the look's own accent, the three subject colours, and two more. */
export const PLAN_PAINT: Record<PlanColor, string> = {
  accent: "var(--accent)",
  red: "var(--maths)",
  blue: "var(--physics)",
  yellow: "var(--econ)",
  green: "#35c389",
  violet: "#a487ff",
};

const LENGTHS = [5, 10, 15, 30, 45, 60, 90, 120];
type Repeat = "once" | "daily" | "weekdays" | "weekly";
const REPEATS: { id: Repeat; name: string }[] = [
  { id: "once", name: "Once" },
  { id: "daily", name: "Every day" },
  { id: "weekdays", name: "Weekdays" },
  { id: "weekly", name: "Weekly" },
];
const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6];
const WEEKDAYS = [1, 2, 3, 4, 5];
const same = (a: number[], b: number[]) => a.length === b.length && a.every((d, i) => d === b[i]);

/**
 * One thing on the plan: its name, when it starts, how long it takes, whether it repeats, and its colour. For
 * something that repeats, a change can be kept for every time or for this day alone, and it can be skipped for a
 * day without being deleted.
 */
export default function PlanSheet({ target, onClose }: { target: PlanTarget; onClose: () => void }) {
  const { data, write } = useHub();
  const { date } = target;
  const task = target.kind === "task" ? target.task : null;
  const rule = task?.repeats ? data.plan.rules[task.id] : undefined;
  const [title, setTitle] = useState(task?.title ?? "");
  const [start, setStart] = useState(clockOf(task ? task.start : target.kind === "new" ? target.start : 540));
  const [dur, setDur] = useState(task?.dur ?? 30);
  const [color, setColor] = useState<PlanColor>(task?.color ?? "accent");
  const habitList = useStore().data.settings.habits;
  const [habit, setHabit] = useState(rule?.habit ?? "");
  const [repeat, setRepeat] = useState<Repeat>(rule ? (same(rule.days, EVERY_DAY) ? "daily" : same(rule.days, WEEKDAYS) ? "weekdays" : "weekly") : "once");
  const at = minutesOf(start);
  const valid = title.trim() !== "" && at >= 0 && dur >= 1;

  const daysFor = (r: Repeat) => (r === "daily" ? EVERY_DAY : r === "weekdays" ? WEEKDAYS : rule && repeat === "weekly" && r === "weekly" ? rule.days : [weekday(date)]);
  const paint = color === "accent" ? {} : { color };

  /** Keep it: as a one-off, or as something that repeats from this day on (or, for a rule, every time). */
  const save = () => {
    if (!valid) return;
    const done = task?.done ? { done: task.done } : {};
    if (repeat === "once") {
      // A repeating thing made a one-off: the rule goes, this day keeps it.
      if (rule && task) {
        for (const [d, day] of Object.entries(data.plan.days)) if (day[task.id]) write(`plan/days/${d}/${task.id}`, null);
        write(`plan/rules/${task.id}`, null);
      }
      write(`plan/days/${date}/${rule || !task ? uid() : task.id}`, { title: title.trim(), start: at, dur, ...paint, ...done });
    } else {
      const id = rule && task ? task.id : uid();
      if (task && !rule) write(`plan/days/${date}/${task.id}`, null);
      write(`plan/rules/${id}`, { title: title.trim(), start: at, dur, days: daysFor(repeat), from: rule?.from ?? date, ...paint, ...(habit ? { habit } : {}) });
      // What was different about this one day goes back to the rule, apart from having been done.
      if (rule && task) write(`plan/days/${date}/${id}`, task.done ? { done: task.done } : null);
      else if (task?.done) write(`plan/days/${date}/${id}`, { done: task.done });
    }
    onClose();
  };

  /** A repeating thing, changed for this day alone. */
  const saveToday = () => {
    if (!valid || !rule || !task) return;
    const entry: PlanEntry = { ...(task.done ? { done: task.done } : {}) };
    if (title.trim() !== rule.title) entry.title = title.trim();
    if (at !== rule.start) entry.start = at;
    if (dur !== rule.dur) entry.dur = dur;
    if (color !== (rule.color ?? "accent") && color !== "accent") entry.color = color;
    write(`plan/days/${date}/${task.id}`, Object.keys(entry).length ? entry : null);
    onClose();
  };

  const remove = () => {
    if (!task) return;
    if (rule) {
      for (const [d, day] of Object.entries(data.plan.days)) if (day[task.id]) write(`plan/days/${d}/${task.id}`, null);
      write(`plan/rules/${task.id}`, null);
    } else write(`plan/days/${date}/${task.id}`, null);
    onClose();
  };
  const skip = () => {
    if (!task || !rule) return;
    write(`plan/days/${date}/${task.id}`, { skip: true });
    onClose();
  };

  return (
    <Sheet label={task ? "Plan" : "New"} accent={PLAN_PAINT[color]} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What" maxLength={80} enterKeyHint="done" className="field mt-3" aria-label="What" />
        <label className="mt-2 flex h-12 items-center justify-between gap-3 rounded-xl border border-line bg-surface px-3.5">
          <span className="text-[15px] text-muted">Starts</span>
          <input type="time" step={300} value={start} onChange={(e) => setStart(e.target.value)} className="bg-transparent text-right text-[16px] tabular-nums text-ink focus:outline-none" />
        </label>

        <div className="mt-5 flex items-baseline justify-between">
          <span className="text-[13px] text-muted">Takes</span>
          <span className="text-[13px] tabular-nums text-ink-2">{spanOf(dur)}</span>
        </div>
        <div className="mt-2 grid grid-cols-4 gap-1 rounded-2xl bg-surface p-1">
          {LENGTHS.map((m) => (
            <button key={m} type="button" aria-pressed={dur === m} onClick={() => setDur(m)} className={cn("h-10 rounded-xl text-[14px] tabular-nums transition-colors", dur === m ? "bg-ink text-bg" : "text-ink-2")}>
              {spanOf(m)}
            </button>
          ))}
        </div>
        <label className="mt-2 flex h-11 items-center justify-between gap-3 rounded-xl border border-line bg-surface px-3.5">
          <span className="text-[14px] text-muted">Or in minutes</span>
          <input type="number" inputMode="numeric" min={1} max={1439} value={dur} onChange={(e) => setDur(Math.min(1439, Math.max(1, Math.round(Number(e.target.value) || 1))))} className="w-20 bg-transparent text-right text-[15px] tabular-nums text-ink focus:outline-none" aria-label="Minutes" />
        </label>

        <div className="mt-5 text-[13px] text-muted">Repeats</div>
        <div className="mt-2 grid grid-cols-4 gap-1 rounded-2xl bg-surface p-1">
          {REPEATS.map((r) => (
            <button key={r.id} type="button" aria-pressed={repeat === r.id} onClick={() => setRepeat(r.id)} className={cn("h-10 rounded-xl text-[13px] transition-colors", repeat === r.id ? "bg-ink text-bg" : "text-ink-2")}>
              {r.name}
            </button>
          ))}
        </div>

        {repeat !== "once" && habitList.length > 0 && (
          <label className="mt-2 flex h-12 items-center justify-between gap-3 rounded-xl border border-line bg-surface px-3.5">
            <span className="shrink-0 text-[15px] text-muted">Ticks the habit</span>
            <select value={habit} onChange={(e) => setHabit(e.target.value)} className="min-w-0 max-w-[60%] truncate bg-transparent text-right text-[15px] text-ink focus:outline-none" aria-label="The habit this ticks">
              <option value="">None</option>
              {habitList.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
            </select>
          </label>
        )}

        <div className="mt-5 flex items-center gap-3" role="group" aria-label="Colour">
          {PLAN_COLORS.map((c) => (
            <button key={c} type="button" aria-pressed={color === c} aria-label={c} onClick={() => setColor(c)} className="flex h-9 w-9 items-center justify-center rounded-full" style={{ boxShadow: color === c ? `0 0 0 2px var(--bg), 0 0 0 4px ${PLAN_PAINT[c]}` : undefined }}>
              <span className="h-6 w-6 rounded-full" style={{ background: PLAN_PAINT[c] }} />
            </button>
          ))}
        </div>

        <button type="submit" className="btn mt-6 w-full" disabled={!valid}>
          {rule && repeat !== "once" ? "Save for every time" : "Save"}
        </button>
        {rule && repeat !== "once" && (
          <button type="button" onClick={saveToday} disabled={!valid} className="mt-2 h-12 w-full rounded-full border border-line text-[15px] font-medium disabled:opacity-40">
            Save for this day only
          </button>
        )}
        {task && (
          <div className="mt-1 flex justify-center gap-2 text-[13.5px] text-muted">
            {rule && (
              <button type="button" onClick={skip} className="h-11 px-3">
                Skip this day
              </button>
            )}
            <button type="button" onClick={remove} className="h-11 px-3">
              {rule ? "Delete every time" : "Delete"}
            </button>
          </div>
        )}
      </form>
    </Sheet>
  );
}
