"use client";

import { useEffect, useRef, useState } from "react";
import { useHub } from "@/lib/hub/store";
import { useTimer } from "@/lib/hub/timer";
import { useCalendarDay } from "@/lib/hub/calendar";
import { lessonsFor, minutesOn, openPoint, total, upcomingExams } from "@/lib/hub/model";
import { clock, daysUntil, mins, stopwatch } from "@/lib/hub/time";
import { addDays, weekStartOf } from "@/lib/dates";
import { SUBJECT_IDS, SUBJECT_META } from "@/lib/hub/subjects";
import { haptic, unlockAudio } from "@/lib/hub/chimes";
import type { SubjectId } from "@/lib/hub/types";
import { cn } from "@/lib/cn";
import { CheckIcon, MicIcon, MoreIcon, WallIcon } from "./Icons";
import LessonSheet from "./LessonSheet";
import AcademicsSheet from "./AcademicsSheet";
import StareOverlay from "./StareOverlay";

/** How long "Hold to stop" has to be held. */
const HOLD_MS = 900;
const WEEK = ["M", "T", "W", "T", "F", "S", "S"];

/** "13 days", "Tomorrow", "Today". */
const countdown = (days: number) => (days <= 0 ? "Today" : days === 1 ? "Tomorrow" : `${days} days`);

/**
 * Stopping takes a deliberate press: hold, and the button fills; let go early and nothing happens. Starting is one
 * tap because it happens often; stopping is rarer and shouldn't happen by accident with the phone in a pocket.
 */
function HoldToStop({ onDone }: { onDone: () => void }) {
  const [holding, setHolding] = useState(false);
  const timer = useRef<number | null>(null);
  // If the button goes away mid-hold (another subject was tapped, another tab opened), the hold is off.
  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = null;
    },
    [],
  );
  const begin = () => {
    if (timer.current) return;
    setHolding(true);
    haptic(8);
    timer.current = window.setTimeout(() => {
      timer.current = null;
      setHolding(false);
      onDone();
    }, HOLD_MS);
  };
  const cancel = () => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = null;
    setHolding(false);
  };
  return (
    <button
      type="button"
      onPointerDown={begin}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      onPointerCancel={cancel}
      onContextMenu={(e) => e.preventDefault()}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && !e.repeat && begin()}
      onKeyUp={cancel}
      className="relative h-12 shrink-0 touch-none select-none overflow-hidden whitespace-nowrap rounded-full border-[1.5px] border-current px-6 text-[15px] font-medium tracking-[-0.01em]"
      style={{ WebkitTouchCallout: "none" }}
    >
      <span className="absolute inset-y-0 left-0 bg-current opacity-25" style={{ width: holding ? "100%" : "0%", transition: holding ? `width ${HOLD_MS}ms linear` : "width 160ms ease-out" }} aria-hidden="true" />
      <span className="relative">Hold to stop</span>
    </button>
  );
}

/**
 * School in three slabs, one per subject, sharing the screen from the title down to the bar, the way the habits do.
 * A slab is its subject's button: tap it and it takes over the screen in the subject's colour with the clock
 * running, while the other two fold down to a strip. The round button on a slab is where you say what you did in
 * that lesson. Along the bottom is today's total and the week split into its seven days.
 */
export default function AcademicsView() {
  const { data, today, now } = useHub();
  const { timer, start, stop } = useTimer();
  const settings = data.settings;
  const { events, error: calendarDown } = useCalendarDay(settings.calendarUrl, today);
  // If the calendar can't be reached and today isn't remembered, the timetable stands in.
  const lessons = lessonsFor(today, settings.calendarUrl && events === null && calendarDown ? { ...settings, calendarUrl: "" } : settings, events);
  const day = data.days[today];
  const studied = minutesOn(today, data.sessions, timer, now);
  const sum = total(studied);
  const exams = upcomingExams(settings, today);

  const [talking, setTalking] = useState<SubjectId | null>(null);
  const [stare, setStare] = useState(false);
  const [more, setMore] = useState(false);

  const begin = (s: SubjectId) => {
    unlockAudio();
    start(s);
  };

  // The week, Monday to Sunday: each day's study as a bar, measured against the longest day (an hour at least).
  const monday = weekStartOf(today);
  const week = WEEK.map((letter, i) => {
    const date = addDays(monday, i);
    return { date, letter, mins: date > today ? null : minutesOn(date, data.sessions, timer, now) };
  });
  const longest = Math.max(60, ...week.map((d) => (d.mins ? total(d.mins) : 0)));

  const talkingLesson = talking ? lessons.find((l) => l.subject === talking && l.start) : undefined;

  return (
    <div className="fade-up flex flex-1 flex-col" style={{ minHeight: 100 + SUBJECT_IDS.length * 128 }}>
      {/* The title row sits a little below the middle of its slice, like Habits. */}
      <header className="flex min-h-[50px] flex-col" style={{ flex: "1 1 0" }}>
        <div style={{ flex: "3 1 0" }} />
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-[36px] font-bold leading-none tracking-[-0.04em]">Academics</h1>
          <div className="flex shrink-0 items-center gap-2.5">
            <button type="button" onClick={() => setStare(true)} className="tap flex h-11 w-11 items-center justify-center rounded-full border-[1.5px] border-ink text-ink" aria-label="Stare at Wall">
              <WallIcon />
            </button>
            <button type="button" onClick={() => setMore(true)} className="tap flex h-11 w-11 items-center justify-center rounded-full border-[1.5px] border-ink text-ink" aria-label="Blocks, grades and exams">
              <MoreIcon />
            </button>
          </div>
        </div>
        <div style={{ flex: "1 1 0" }} />
      </header>

      <div className="-mx-5 flex flex-col" style={{ flex: "10 1 0" }}>
        {SUBJECT_IDS.map((s, i) => {
          const meta = SUBJECT_META[s];
          const live = timer?.subject === s;
          const folded = Boolean(timer) && !live;
          const log = day?.logs[s];
          const said = Boolean(log?.text.trim() || log?.conf);
          const times = lessons.filter((l) => l.subject === s && l.start).map((l) => l.start as string);
          // This subject's exams (or, if it has none, the ones that belong to no subject), nearest first, grouped by
          // day: three on the same day share one line.
          const own = exams.filter((e) => e.subject === s);
          const mine = own.length ? own : exams.filter((e) => !e.subject);
          const dates = [...new Set(mine.map((e) => e.date))].slice(0, 2);
          const coming = dates.map((date) => ({ date, days: daysUntil(date, today), names: mine.filter((e) => e.date === date).map((e) => e.title) }));
          const elapsed = live && timer ? Math.max(0, now - timer.start) / 1000 : 0;
          // What Claude last left unresolved in this subject: the thing to go and fix.
          const shaky = openPoint(data.days, s, today);
          return (
            <section
              key={s}
              className="relative flex min-h-0 flex-col overflow-hidden px-5 transition-[flex-grow,flex-basis,min-height] duration-[420ms] ease-[cubic-bezier(0.2,0.8,0.2,1)]"
              style={{
                flexGrow: live ? 9 : folded ? 0 : 1,
                flexShrink: 1,
                flexBasis: folded ? 58 : 0,
                minHeight: folded ? 58 : 116,
                background: live ? meta.color : undefined,
                color: live ? meta.on : undefined,
              }}
              aria-label={meta.name}
            >
              {/* Hairlines drawn inside the page margin, as on Habits; a slab filled with colour needs none. */}
              {!live && <span className="pointer-events-none absolute inset-x-5 top-0 h-px bg-line" aria-hidden="true" />}
              {!live && i === SUBJECT_IDS.length - 1 && <span className="pointer-events-none absolute inset-x-5 bottom-0 h-px bg-line" aria-hidden="true" />}

              {/* At rest (or folded) the whole slab is the button that starts this subject. */}
              {!live && <button type="button" onClick={() => begin(s)} className="absolute inset-0 transition-colors active:bg-surface" aria-label={timer ? `Switch to ${meta.name}` : `Study ${meta.name}`} />}

              {folded ? (
                <div className="pointer-events-none relative flex h-[58px] items-center gap-3.5">
                  <span className="h-5 w-[3px] shrink-0 rounded-full" style={{ background: meta.color }} aria-hidden="true" />
                  <span className="flex-1 text-[17px] font-medium tracking-[-0.015em]">{meta.name}</span>
                  <span className={cn("font-mono text-[13px] tabular-nums", studied[s] >= 1 ? "text-ink" : "text-muted")}>{mins(studied[s])}</span>
                </div>
              ) : (
                <div className="pointer-events-none relative flex min-h-0 flex-1 flex-col py-5">
                  <div className="flex items-start gap-3.5">
                    {!live && <span className="mt-[3px] h-[26px] w-[3px] shrink-0 rounded-full" style={{ background: meta.color }} aria-hidden="true" />}
                    <div className="min-w-0 flex-1">
                      <h2 className="truncate text-[30px] font-bold leading-none tracking-[-0.04em]">{meta.name}</h2>
                      <div className="mt-2.5 space-y-1.5">
                        {times.length > 0 && <div className={cn("truncate font-mono text-[12px] tabular-nums", live ? "opacity-70" : "text-muted")}>{times.join(" · ")}</div>}
                        {coming.map((c) => (
                          <div key={c.date} className="line-clamp-2 text-[13px] leading-snug">
                            <span className="font-semibold">{countdown(c.days)}</span>
                            <span className={live ? "opacity-70" : "text-muted"}> {c.names.join(" · ")}</span>
                          </div>
                        ))}
                        {shaky && <div className={cn("truncate text-[13px]", live ? "opacity-80" : "text-ink-2")}>{shaky}</div>}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setTalking(s)}
                      className={cn("tap pointer-events-auto flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-[1.5px]", live ? "border-current" : "border-ink", said && (live ? "bg-current" : "bg-ink text-bg"))}
                      aria-label={said ? `What you did in ${meta.name}` : `Say what you did in ${meta.name}`}
                    >
                      {said ? <CheckIcon width={18} height={18} style={live ? { color: meta.color } : undefined} /> : <MicIcon />}
                    </button>
                  </div>

                  {live ? (
                    <>
                      <div className="flex min-h-0 flex-1 items-center">
                        {/* Smaller once the hours appear, so the whole time always fits the width. */}
                        <div className={cn("font-bold leading-none tracking-[-0.06em] tabular-nums", elapsed >= 3600 ? "text-[clamp(56px,19vw,96px)]" : "text-[clamp(72px,27vw,132px)]")}>{stopwatch(elapsed)}</div>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <span className="min-w-0 font-mono text-[12px] leading-relaxed tabular-nums opacity-70">
                          <span className="block truncate">since {timer ? clock(timer.start) : ""}</span>
                          <span className="block truncate">today {mins(studied[s])}</span>
                        </span>
                        <span className="pointer-events-auto">
                          <HoldToStop onDone={stop} />
                        </span>
                      </div>
                    </>
                  ) : (
                    <div className={cn("mt-auto pl-[17.5px] text-[52px] font-bold leading-none tracking-[-0.05em] tabular-nums", studied[s] >= 1 ? "text-ink" : "text-faint")}>{mins(studied[s])}</div>
                  )}
                </div>
              )}

            </section>
          );
        })}
      </div>

      <div className="flex min-h-[50px] flex-col justify-center" style={{ flex: "1 1 0" }}>
        <div className="flex items-baseline justify-between tabular-nums">
          <span className="font-mono text-[13px] text-muted">today</span>
          <span className="text-[22px] font-bold leading-none tracking-[-0.03em] text-ink">{mins(sum)}</span>
        </div>
        <div className="mt-2 flex gap-1.5" role="img" aria-label="Time studied each day this week">
          {week.map((d) => {
            const t = d.mins ? total(d.mins) : 0;
            return (
              <div key={d.date} className="flex-1">
                <div className="flex h-[4px] w-full overflow-hidden rounded-full bg-track">
                  {d.mins && t >= 1 && (
                    <div className="flex h-full" style={{ width: `${Math.max(8, (t / longest) * 100)}%` }}>
                      {SUBJECT_IDS.map((s) => (d.mins && d.mins[s] > 0 ? <span key={s} style={{ flexGrow: d.mins[s], background: SUBJECT_META[s].color }} /> : null))}
                    </div>
                  )}
                </div>
                <div className={cn("mt-1 text-center font-mono text-[9.5px] leading-none", d.date === today ? "text-ink" : "text-faint")}>{d.letter}</div>
              </div>
            );
          })}
        </div>
      </div>

      {talking && <LessonSheet date={today} lesson={{ key: talking, subject: talking, start: talkingLesson?.start, end: talkingLesson?.end }} onClose={() => setTalking(null)} />}
      {stare && <StareOverlay onClose={() => setStare(false)} />}
      {more && <AcademicsSheet onClose={() => setMore(false)} />}
    </div>
  );
}
