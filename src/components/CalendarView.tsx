"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useStore } from "@/lib/store";
import { formatLong, monthGrid, monthLabel, parseKey } from "@/lib/dates";
import { dayHasEntry, dayProgress, hasRatings } from "@/lib/model";
import { cn } from "@/lib/cn";
import { ChevronIcon, CloseIcon } from "./Icons";
import DayEditor from "./DayEditor";

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

export default function CalendarView() {
  const { today, data, getDay } = useStore();
  const t = parseKey(today);
  const [year, setYear] = useState(t.getFullYear());
  const [month, setMonth] = useState(t.getMonth());
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    if (!selected) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setSelected(null);
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [selected]);

  const shift = (n: number) => {
    const d = new Date(year, month + n, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
  };

  const weeks = monthGrid(year, month);
  const isCurrentMonth = year === t.getFullYear() && month === t.getMonth();

  return (
    <div className="rise flex flex-col gap-4">
      <section className="card p-4 md:p-5">
        <div className="mb-3 flex items-center justify-between">
          <button type="button" className="btn-icon" onClick={() => shift(-1)} aria-label="Previous month">
            <ChevronIcon dir="left" />
          </button>
          <div className="text-center">
            <h1 className="text-xl font-extrabold text-ink">{monthLabel(year, month)}</h1>
            {!isCurrentMonth && (
              <button
                type="button"
                className="text-xs font-bold text-ocean-600"
                onClick={() => {
                  setYear(t.getFullYear());
                  setMonth(t.getMonth());
                }}
              >
                back to today
              </button>
            )}
          </div>
          <button type="button" className="btn-icon" onClick={() => shift(1)} aria-label="Next month">
            <ChevronIcon dir="right" />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center">
          {WEEKDAYS.map((w) => (
            <div key={w} className="py-1 text-[11px] font-extrabold uppercase tracking-wider text-ink-muted">
              {w}
            </div>
          ))}
          {weeks.flat().map((key, i) => {
            if (!key) return <div key={`e${i}`} />;
            const stored = data.days[key];
            const isFuture = key > today;
            const isToday = key === today;
            const entry = dayHasEntry(stored);
            const pct = entry ? dayProgress(getDay(key)).pct : 0;
            const shade = !entry ? "" : pct >= 100 ? "bg-teal-500 text-white" : pct >= 60 ? "bg-ocean-400 text-white" : pct >= 25 ? "bg-ocean-200 text-ocean-900" : "bg-ocean-100 text-ocean-900";
            return (
              <button
                key={key}
                type="button"
                onClick={() => setSelected(key)}
                className={cn(
                  "tap relative flex aspect-square flex-col items-center justify-center rounded-2xl text-sm font-bold transition-colors",
                  shade || (isFuture ? "text-ink-muted/70 hover:bg-sand-100" : "bg-sand-50 text-ink hover:bg-sand-100"),
                  isToday && "ring-2 ring-sunset-500 ring-offset-2 ring-offset-white",
                )}
                aria-label={formatLong(key)}
              >
                <span className="tabular-nums">{parseKey(key).getDate()}</span>
                {(hasRatings(stored) || (stored && stored.journal.trim())) && (
                  <span className={cn("absolute bottom-1.5 h-1.5 w-1.5 rounded-full", pct >= 60 ? "bg-white/90" : "bg-sunset-500")} />
                )}
              </button>
            );
          })}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-bold text-ink-muted">
          <span className="flex items-center gap-1.5"><i className="h-3 w-3 rounded bg-ocean-100" /> started</span>
          <span className="flex items-center gap-1.5"><i className="h-3 w-3 rounded bg-ocean-400" /> most done</span>
          <span className="flex items-center gap-1.5"><i className="h-3 w-3 rounded bg-teal-500" /> all done</span>
          <span className="flex items-center gap-1.5"><i className="h-1.5 w-1.5 rounded-full bg-sunset-500" /> rated / journaled</span>
        </div>
      </section>

      <p className="px-2 text-center text-sm font-semibold text-ink-muted">Tap any day to view or edit it. Past days keep the habit list they had at the time.</p>

      {selected &&
        createPortal(
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-ocean-900/40 backdrop-blur-sm md:items-center md:p-6" onClick={() => setSelected(null)}>
          <div
            className="flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl bg-sand-50 shadow-lift md:max-h-[88vh] md:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={formatLong(selected)}
          >
            <div className="flex items-center justify-between border-b border-sand-200 bg-white/80 px-4 py-3 backdrop-blur">
              <div>
                <div className="label">{selected === today ? "Today" : selected > today ? "Upcoming" : "Looking back"}</div>
                <div className="text-lg font-extrabold text-ink">{formatLong(selected)}</div>
              </div>
              <button type="button" className="btn-icon" onClick={() => setSelected(null)} aria-label="Close">
                <CloseIcon />
              </button>
            </div>
            <div className="overflow-y-auto p-4 pb-safe">
              <DayEditor date={selected} compact />
              <div className="h-4" />
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
