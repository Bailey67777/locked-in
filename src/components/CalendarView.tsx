"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useStore } from "@/lib/store";
import { formatLong, monthGrid, monthLabel, parseKey } from "@/lib/dates";
import { dayProgress } from "@/lib/model";
import { pctOn, startOf, topMissed } from "@/lib/stats";
import { haptic, playSound, playUntick } from "@/lib/sounds";
import { cn } from "@/lib/cn";
import { ChevronIcon, CloseIcon, MicIcon } from "./Icons";
import HabitList from "./HabitList";
import VoiceEntries, { useVoiceEntries } from "./VoiceEntries";

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

/** How dark a day's square is: nothing to count stays clear, 0% is a hint of grey, 100% is solid. */
const shade = (pct: number | null) => (pct === null ? 0 : pct === 0 ? 0.07 : 0.14 + (pct / 100) * 0.86);

/** A slash corner to corner, like crossing a day out on a paper calendar. */
function Slash({ light }: { light: boolean }) {
  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 40 40" preserveAspectRatio="none" aria-hidden="true">
      <line x1="7" y1="33" x2="33" y2="7" stroke={light ? "var(--bg)" : "var(--ink)"} strokeWidth="1.6" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function DaySheet({ date, onClose }: { date: string; onClose: () => void }) {
  const { today, data, getDay, updateDay } = useStore();
  const settings = data.settings;
  const day = getDay(date);
  const counts = date >= startOf(settings);
  const progress = dayProgress(day);
  const entries = useVoiceEntries(date);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const toggle = (id: string) => {
    if (day.submitted) return;
    const turningOn = !day.habits.find((h) => h.id === id)?.done;
    updateDay(date, (d) => ({ ...d, habits: d.habits.map((h) => (h.id === id ? { ...h, done: !h.done } : h)) }));
    haptic(turningOn ? 10 : 6);
    if (!settings.soundsOn) return;
    if (turningOn) playSound(settings.habits.find((h) => h.id === id)?.sound);
    else playUntick();
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40"
      onClick={(e) => {
        e.stopPropagation();
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="sheet-up flex max-h-[88dvh] w-full max-w-[520px] flex-col rounded-t-[22px] bg-bg px-5 pt-5" role="dialog" aria-modal="true" aria-label={formatLong(date)}>
        <div className="flex items-start justify-between">
          <div>
            <div className="label">{date === today ? "Today" : day.submitted ? "Submitted" : counts ? "Looking back" : "Before the start"}</div>
            <div className="mt-1.5 text-[22px] font-semibold tracking-[-0.03em]">{formatLong(date)}</div>
          </div>
          <button type="button" className="tap -mr-2 flex h-9 w-9 items-center justify-center rounded-full text-ink-2" onClick={onClose} aria-label="Close">
            <CloseIcon />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto pb-safe">
          {counts && (
            <>
              <div className="mt-3 flex items-baseline justify-between font-mono text-[12px] tabular-nums">
                <span className="text-muted">
                  {progress.done}/{progress.total}
                </span>
                <span>{progress.pct}%</span>
              </div>
              <div className="mt-2 h-[3px] w-full overflow-hidden rounded-full bg-track">
                <div className="h-full rounded-full bg-ink transition-[width] duration-500" style={{ width: `${progress.pct}%` }} />
              </div>
              <div className={cn("mt-4", day.submitted && "opacity-60")}>
                <HabitList habits={day.habits} locked={Boolean(day.submitted)} onToggle={toggle} />
              </div>
            </>
          )}
          {entries.length > 0 && (
            <div className="mt-6">
              <div className="label mb-1 flex items-center gap-1.5">
                <MicIcon width={12} height={12} /> Journal
              </div>
              <VoiceEntries date={date} entries={entries} />
            </div>
          )}
          <div className="h-6" />
        </div>
      </div>
    </div>,
    document.body,
  );
}

export default function CalendarView() {
  const { today, data } = useStore();
  const settings = data.settings;
  const start = startOf(settings);
  const t = parseKey(today);
  const [year, setYear] = useState(t.getFullYear());
  const [month, setMonth] = useState(t.getMonth());
  const [open, setOpen] = useState<string | null>(null);

  const shift = (n: number) => {
    const d = new Date(year, month + n, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
  };

  const isCurrentMonth = year === t.getFullYear() && month === t.getMonth();
  const top = settings.habits[0];

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
            const before = key < start;
            const hasVoice = Boolean(data.days[key]?.voice && Object.keys(data.days[key].voice!).length);
            const pct = pctOn(data.days, settings, key, today);
            const a = shade(pct);
            const missed = topMissed(data.days, settings, key, today);
            const canOpen = !future && (!before || hasVoice);
            return (
              <button
                key={key}
                type="button"
                disabled={!canOpen}
                onClick={() => setOpen(key)}
                className={cn("tap relative flex aspect-square items-center justify-center overflow-hidden rounded-[10px] text-[13px] tabular-nums disabled:active:scale-100", key === today && "ring-[1.5px] ring-ink ring-offset-2 ring-offset-bg")}
                aria-label={`${formatLong(key)}${pct !== null ? `, ${pct}%` : ""}${missed && top ? `, ${top.name} missed` : ""}`}
              >
                <span className="absolute inset-0 bg-ink" style={{ opacity: a }} aria-hidden="true" />
                {missed && <Slash light={a > 0.55} />}
                <span className={cn("relative", a > 0.55 ? "text-bg" : future || before ? "text-faint" : "text-ink-2")}>{parseKey(key).getDate()}</span>
                {hasVoice && <span className={cn("absolute bottom-[5px] h-[3px] w-[3px] rounded-full", a > 0.55 ? "bg-bg" : "bg-ink")} aria-hidden="true" />}
              </button>
            );
          })}
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 font-mono text-[10.5px] text-muted">
        <span className="flex items-center gap-1.5">
          <span className="relative h-3 w-3 overflow-hidden rounded-[3px] border border-faint">
            <svg className="absolute inset-0 h-full w-full" viewBox="0 0 12 12" aria-hidden="true">
              <line x1="2" y1="10" x2="10" y2="2" stroke="var(--ink)" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
          </span>
          {top ? `${top.name} missed` : "top habit missed"}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="mr-0.5">0%</span>
          {[0.07, 0.35, 0.6, 0.82, 1].map((o) => (
            <span key={o} className="relative h-3 w-3 overflow-hidden rounded-[3px]">
              <span className="absolute inset-0 bg-ink" style={{ opacity: o }} />
            </span>
          ))}
          <span className="ml-0.5">100%</span>
        </span>
      </div>
      <p className="mt-3 font-mono text-[10.5px] text-muted">Counting from {formatLong(start)}. A dot means there&apos;s a journal entry.</p>

      {open && <DaySheet date={open} onClose={() => setOpen(null)} />}
    </div>
  );
}
