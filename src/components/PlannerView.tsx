"use client";

import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import type { PlanItem } from "@/lib/types";
import { addDays, addMinutes, formatMins, nowTime, timeToMinutes } from "@/lib/dates";
import { uid } from "@/lib/model";
import { HABIT_COLORS } from "@/lib/defaults";
import { haptic, playSound } from "@/lib/sounds";
import { cn } from "@/lib/cn";
import { CheckIcon, PlusIcon, TrashIcon } from "./Icons";
import DateSwitcher from "./DateSwitcher";

const DURATIONS = [15, 30, 45, 60, 90, 120, 180, 240];
const QUICK_EMOJI = ["📚", "🏀", "🏋️", "🍳", "🚶", "🎸", "🧘", "🛏️", "🚿", "🚌", "🤝", "🎮"];

const sortPlan = (items: PlanItem[]) => [...items].sort((a, b) => a.start.localeCompare(b.start));

/** A rough plan for the day as a timeline of blocks. Tick them off as you go, or at night. */
export default function PlannerView() {
  const { today, data, getDay, updateDay } = useStore();
  const [date, setDate] = useState(today);
  const day = getDay(date);
  const plan = day.plan ?? [];
  const [editing, setEditing] = useState<string | null>(null);
  const [now, setNow] = useState("");

  const [title, setTitle] = useState("");
  const [start, setStart] = useState("16:00");
  const [mins, setMins] = useState(60);
  const [color, setColor] = useState(HABIT_COLORS[0].hex);
  const [emoji, setEmoji] = useState("");

  useEffect(() => {
    const tick = () => setNow(nowTime());
    const first = window.setTimeout(tick, 0);
    const id = window.setInterval(tick, 30_000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(id);
    };
  }, []);

  const setPlan = (fn: (items: PlanItem[]) => PlanItem[]) => updateDay(date, (d) => ({ ...d, plan: sortPlan(fn(d.plan ?? [])) }));

  const add = () => {
    const t = title.trim();
    if (!t) return;
    setPlan((items) => [...items, { id: uid(), title: t, start, mins, color, emoji: emoji || undefined, done: false }]);
    setTitle("");
    setEmoji("");
    setStart(addMinutes(start, mins)); // the next block naturally starts where this one ends
  };

  const toggle = (id: string) => {
    const item = plan.find((p) => p.id === id);
    if (item && !item.done) {
      haptic(10);
      if (data.settings.soundsOn) playSound(data.settings.todoSound);
    }
    setPlan((items) => items.map((p) => (p.id === id ? { ...p, done: !p.done } : p)));
  };

  const yesterday = getDay(addDays(date, -1)).plan ?? [];
  const timedHabits = data.settings.habits.filter((h) => h.time);
  const planned = plan.reduce((a, p) => a + p.mins, 0);
  const nowMins = now ? timeToMinutes(now) : -1;

  return (
    <div className="rise flex flex-col gap-4">
      <h1 className="px-1 text-2xl font-extrabold text-ink">Plan</h1>
      <DateSwitcher date={date} today={today} onChange={(d) => { setDate(d); setEditing(null); }} />

      <section className="card p-4 md:p-5">
        <div className="mb-3">
          <h2 className="text-lg font-extrabold text-ink">The rough shape of the day</h2>
          {plan.length > 0 && (
            <p className="text-sm font-semibold text-ink-muted">
              {plan.filter((p) => p.done).length} of {plan.length} done · {formatMins(planned)} planned. Tap a block to edit it.
            </p>
          )}
        </div>

        {plan.length === 0 ? (
          <div className="rounded-2xl bg-sand-50 px-4 py-5 text-center">
            <p className="text-sm font-semibold text-ink-muted">Nothing planned. Add a few blocks below: it only needs to be rough.</p>
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              {yesterday.length > 0 && (
                <button type="button" className="btn-ghost bg-white shadow-soft" onClick={() => setPlan(() => yesterday.map((p) => ({ ...p, id: uid(), done: false })))}>
                  Copy the day before
                </button>
              )}
              {timedHabits.length > 0 && (
                <button
                  type="button"
                  className="btn-ghost bg-white shadow-soft"
                  onClick={() => setPlan(() => timedHabits.map((h) => ({ id: uid(), title: h.name, start: h.time as string, mins: 15, color: h.color, emoji: h.emoji, done: false })))}
                >
                  Start from my timed habits
                </button>
              )}
            </div>
          </div>
        ) : (
          <ol className="flex flex-col">
            {plan.map((p, i) => {
              const end = addMinutes(p.start, p.mins);
              const next = plan[i + 1];
              const gap = next ? timeToMinutes(next.start) - timeToMinutes(end) : 0;
              const isNow = date === today && nowMins >= timeToMinutes(p.start) && nowMins < timeToMinutes(end);
              const c = p.color ?? HABIT_COLORS[0].hex;
              return (
                <li key={p.id}>
                  <div className="flex gap-3">
                    <div className="w-12 shrink-0 pt-2 text-right text-xs font-extrabold tabular-nums text-ink-muted">
                      {p.start}
                      <div className="font-bold text-ink-muted/60">{end}</div>
                    </div>
                    <div className="flex w-10 shrink-0 flex-col items-center">
                      <span
                        className={cn("flex w-10 items-center justify-center rounded-full text-lg shadow-soft", isNow && "ring-4 ring-sunset-200")}
                        style={{ backgroundColor: p.done ? `${c}55` : c, minHeight: Math.max(44, Math.min(200, p.mins * 0.9)) }}
                      >
                        {p.emoji ?? ""}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1 pb-1 pt-1.5">
                      <div className="flex items-start gap-2">
                        <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setEditing(editing === p.id ? null : p.id)}>
                          <div className={cn("text-[15px] font-bold leading-snug", p.done ? "text-ink-muted" : "text-ink")}>{p.title}</div>
                          <div className="text-xs font-bold text-ink-muted">
                            {formatMins(p.mins)}
                            {isNow && <span className="ml-2 rounded-full bg-sunset-100 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-sunset-700">now</span>}
                          </div>
                        </button>
                        <button
                          type="button"
                          onClick={() => toggle(p.id)}
                          aria-pressed={p.done}
                          aria-label={p.done ? "Mark not done" : "Mark done"}
                          className="tap flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2"
                          style={{ borderColor: c, backgroundColor: p.done ? c : "#fff", color: p.done ? "#fff" : "transparent" }}
                        >
                          <CheckIcon />
                        </button>
                      </div>
                      {editing === p.id && (
                        <div className="pop-in mt-2 flex flex-col gap-2 rounded-2xl bg-sand-50 p-3">
                          <input className="field py-2" value={p.title} onChange={(e) => setPlan((items) => items.map((x) => (x.id === p.id ? { ...x, title: e.target.value } : x)))} aria-label="Block title" />
                          <div className="flex flex-wrap items-center gap-2">
                            <input type="time" className="rounded-lg border border-sand-200 bg-white px-2 py-1.5 text-sm font-bold" value={p.start} onChange={(e) => e.target.value && setPlan((items) => items.map((x) => (x.id === p.id ? { ...x, start: e.target.value } : x)))} aria-label="Start time" />
                            <select className="rounded-lg border border-sand-200 bg-white px-2 py-1.5 text-sm font-bold" value={p.mins} onChange={(e) => setPlan((items) => items.map((x) => (x.id === p.id ? { ...x, mins: Number(e.target.value) } : x)))} aria-label="Length">
                              {[...new Set([...DURATIONS, p.mins])].sort((a, b) => a - b).map((d) => (
                                <option key={d} value={d}>
                                  {formatMins(d)}
                                </option>
                              ))}
                            </select>
                            <button type="button" className="btn-icon ml-auto h-9 w-9 text-sunset-600" onClick={() => setPlan((items) => items.filter((x) => x.id !== p.id))} aria-label="Delete block">
                              <TrashIcon />
                            </button>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {HABIT_COLORS.map((hc) => (
                              <button key={hc.hex} type="button" title={hc.name} onClick={() => setPlan((items) => items.map((x) => (x.id === p.id ? { ...x, color: hc.hex } : x)))} className={cn("h-6 w-6 rounded-full border-2", c === hc.hex ? "border-ink" : "border-white")} style={{ backgroundColor: hc.hex }} />
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  {next && (
                    <div className="flex gap-3">
                      <div className="w-12 shrink-0" />
                      <div className="flex w-10 shrink-0 justify-center">
                        <span className="my-1 w-0.5 rounded bg-sand-200" style={{ minHeight: gap >= 15 ? 28 : 10 }} />
                      </div>
                      <div className="flex items-center text-[11px] font-bold text-ink-muted/80">{gap >= 15 ? `${formatMins(gap)} free` : gap < 0 ? "overlaps" : ""}</div>
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </section>

      <section className="card p-4 md:p-5">
        <h2 className="mb-3 text-lg font-extrabold text-ink">Add a block</h2>
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            add();
          }}
        >
          <input className="field" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Physics past paper, basketball, dinner" autoComplete="off" />
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-1.5 text-xs font-bold text-ink-muted">
              Start
              <input type="time" className="rounded-lg border border-sand-200 bg-white px-2 py-2 text-sm font-bold text-ink" value={start} onChange={(e) => e.target.value && setStart(e.target.value)} />
            </label>
            <label className="flex items-center gap-1.5 text-xs font-bold text-ink-muted">
              For
              <select className="rounded-lg border border-sand-200 bg-white px-2 py-2 text-sm font-bold text-ink" value={mins} onChange={(e) => setMins(Number(e.target.value))}>
                {DURATIONS.map((d) => (
                  <option key={d} value={d}>
                    {formatMins(d)}
                  </option>
                ))}
              </select>
            </label>
            <span className="text-xs font-bold text-ink-muted">ends {addMinutes(start, mins)}</span>
          </div>
          <div className="flex flex-wrap items-center gap-1">
            {HABIT_COLORS.map((hc) => (
              <button key={hc.hex} type="button" title={hc.name} onClick={() => setColor(hc.hex)} className={cn("tap h-7 w-7 rounded-full border-2 transition-transform", color === hc.hex ? "scale-110 border-ink" : "border-white")} style={{ backgroundColor: hc.hex }} />
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-1">
            {QUICK_EMOJI.map((e) => (
              <button key={e} type="button" onClick={() => setEmoji(emoji === e ? "" : e)} className={cn("tap flex h-9 w-9 items-center justify-center rounded-lg text-lg", emoji === e ? "bg-ocean-100" : "hover:bg-sand-100")}>
                {e}
              </button>
            ))}
          </div>
          <button type="submit" className="btn-primary" disabled={!title.trim()}>
            <PlusIcon /> Add to plan
          </button>
        </form>
      </section>
    </div>
  );
}
