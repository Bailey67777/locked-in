"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useStore } from "@/lib/store";
import { formatLong, monthGrid, monthLabel, parseKey } from "@/lib/dates";
import { dayProgress } from "@/lib/model";
import { pctOn } from "@/lib/stats";
import { haptic, playTick, playUntick } from "@/lib/sounds";
import { cn } from "@/lib/cn";
import { ChevronIcon, CloseIcon } from "./Icons";
import HabitList from "./HabitList";

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

/** How dark a day's square is: nothing recorded stays clear, a recorded 0% is a hint of grey, 100% is solid. */
const shade = (pct: number | null) => (pct === null ? 0 : pct === 0 ? 0.06 : 0.14 + (pct / 100) * 0.86);

export default function CalendarView() {
  const { today, data, getDay, updateDay } = useStore();
  const t = parseKey(today);
  const [year, setYear] = useState(t.getFullYear());
  const [month, setMonth] = useState(t.getMonth());
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(null);
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const shift = (n: number) => {
    const d = new Date(year, month + n, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
  };

  const isCurrentMonth = year === t.getFullYear() && month === t.getMonth();
  const day = open ? getDay(open) : null;
  const progress = day ? dayProgress(day) : null;

  const toggle = (id: string) => {
    if (!open || !day || day.submitted) return;
    const turningOn = !day.habits.find((h) => h.id === id)?.done;
    updateDay(open, (d) => ({ ...d, habits: d.habits.map((h) => (h.id === id ? { ...h, done: !h.done } : h)) }));
    haptic(turningOn ? 10 : 6);
    if (data.settings.soundsOn) (turningOn ? playTick : playUntick)();
  };

  return (
    <div className="fade-up">
      <header className="mb-7 flex items-end justify-between">
        <div>
          <div className="label">Calendar</div>
          <h1 className="mt-2 text-[34px] font-semibold leading-none tracking-[-0.035em]">{monthLabel(year, month)}</h1>
        </div>
        <div className="flex items-center gap-1">
          {!isCurrentMonth && (
            <button
              type="button"
              className="btn-quiet h-9 px-3 text-[13px]"
              onClick={() => {
                setYear(t.getFullYear());
                setMonth(t.getMonth());
              }}
            >
              Today
            </button>
          )}
          <button type="button" className="tap flex h-9 w-9 items-center justify-center rounded-full text-ink-2 hover:bg-surface" onClick={() => shift(-1)} aria-label="Previous month">
            <ChevronIcon dir="left" />
          </button>
          <button type="button" className="tap flex h-9 w-9 items-center justify-center rounded-full text-ink-2 hover:bg-surface" onClick={() => shift(1)} aria-label="Next month">
            <ChevronIcon dir="right" />
          </button>
        </div>
      </header>

      <div className="grid grid-cols-7 gap-1.5">
        {WEEKDAYS.map((w, i) => (
          <div key={i} className="pb-1 text-center font-mono text-[10.5px] text-muted">
            {w}
          </div>
        ))}
        {monthGrid(year, month)
          .flat()
          .map((key, i) => {
            if (!key) return <div key={`e${i}`} />;
            const future = key > today;
            const pct = future ? null : pctOn(data.days, data.settings, key, today);
            const a = shade(pct);
            return (
              <button
                key={key}
                type="button"
                disabled={future}
                onClick={() => setOpen(key)}
                className={cn("tap relative flex aspect-square items-center justify-center overflow-hidden rounded-[10px] text-[13px] tabular-nums", key === today && "ring-[1.5px] ring-ink ring-offset-2 ring-offset-bg")}
                aria-label={`${formatLong(key)}${pct !== null ? `, ${pct}%` : ""}`}
              >
                <span className="absolute inset-0 bg-ink" style={{ opacity: a }} aria-hidden="true" />
                <span className={cn("relative", a > 0.55 ? "text-bg" : future ? "text-faint" : "text-ink-2")}>{parseKey(key).getDate()}</span>
              </button>
            );
          })}
      </div>

      <div className="mt-6 flex items-center justify-end gap-1.5 font-mono text-[10.5px] text-muted">
        <span className="mr-1">0%</span>
        {[0.06, 0.35, 0.6, 0.82, 1].map((o) => (
          <span key={o} className="relative h-3 w-3 overflow-hidden rounded-[3px]">
            <span className="absolute inset-0 bg-ink" style={{ opacity: o }} />
          </span>
        ))}
        <span className="ml-1">100%</span>
      </div>

      {open &&
        day &&
        progress &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={(e) => e.target === e.currentTarget && setOpen(null)}>
            <div className="sheet-up w-full max-w-[520px] rounded-t-[22px] bg-bg px-5 pb-safe pt-5" role="dialog" aria-modal="true" aria-label={formatLong(open)}>
              <div className="flex items-start justify-between">
                <div>
                  <div className="label">{open === today ? "Today" : day.submitted ? "Submitted" : "Looking back"}</div>
                  <div className="mt-1.5 text-[22px] font-semibold tracking-[-0.03em]">{formatLong(open)}</div>
                </div>
                <button type="button" className="tap -mr-2 flex h-9 w-9 items-center justify-center rounded-full text-ink-2" onClick={() => setOpen(null)} aria-label="Close">
                  <CloseIcon />
                </button>
              </div>
              <div className="mt-3 flex items-baseline justify-between font-mono text-[12px] tabular-nums">
                <span className="text-muted">
                  {progress.done}/{progress.total}
                </span>
                <span>{progress.pct}%</span>
              </div>
              <div className="mt-2 h-[3px] w-full overflow-hidden rounded-full bg-track">
                <div className="h-full rounded-full bg-ink transition-[width] duration-500" style={{ width: `${progress.pct}%` }} />
              </div>
              <div className={cn("mt-4 max-h-[58dvh] overflow-y-auto pb-6", day.submitted && "opacity-60")}>
                <HabitList habits={day.habits} settings={data.settings} locked={Boolean(day.submitted)} onToggle={toggle} />
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
