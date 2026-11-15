"use client";

import { useState } from "react";
import { useHub } from "@/lib/hub/store";
import { useTimer } from "@/lib/hub/timer";
import { useCalendarDay } from "@/lib/hub/calendar";
import { beforeAndNow, lessonsFor, minutesOn, safeKey, sessionsOn, total, upcomingExams } from "@/lib/hub/model";
import { clock, dayTitle, daysUntil, mins, stopwatch } from "@/lib/hub/time";
import { addDays, formatShort, weekStartOf } from "@/lib/dates";
import { SUBJECT_IDS, SUBJECT_META } from "@/lib/hub/subjects";
import type { DayLesson, SubjectId } from "@/lib/hub/types";
import { cn } from "@/lib/cn";
import { ArrowIcon, CheckIcon, ChevronIcon, MicIcon } from "./Icons";
import SubjectMark from "./SubjectMark";
import LessonSheet from "./LessonSheet";
import StudySheet from "./StudySheet";
import SessionSheet from "./SessionSheet";
import GradeSheet from "./GradeSheet";
import ExamsSheet from "./ExamsSheet";
import StareOverlay from "./StareOverlay";

const FEEL = { 1: "Shaky", 2: "Okay", 3: "Solid" } as const;
const WEEK = ["M", "T", "W", "T", "F", "S", "S"];

/** School in one page: the day's lessons to talk through, the study timer, Stare at Wall, time studied, grades. */
export default function AcademicsView() {
  const { data, today, now } = useHub();
  const { timer, stop } = useTimer();
  const settings = data.settings;
  const [back, setBack] = useState(0);
  const date = addDays(today, -back);
  const { events, error: calendarDown } = useCalendarDay(settings.calendarUrl, date);
  // The calendar can't be reached and this day isn't remembered: fall back to the timetable (or the bare subjects)
  // rather than leaving nowhere to say what happened.
  const planned = lessonsFor(date, settings.calendarUrl && events === null && calendarDown ? { ...settings, calendarUrl: "" } : settings, events);
  const waiting = Boolean(settings.calendarUrl) && events === null && !calendarDown;
  const day = data.days[date];
  // Anything already said that day stays on the page, even if the timetable or calendar has changed since.
  const strays: DayLesson[] = Object.entries(day?.logs ?? {})
    .filter(([key, log]) => (log.text.trim() || log.conf) && !planned.some((l) => safeKey(l.key) === key))
    .map(([key, log]) => ({ key, subject: log.subject, ...(/@\d{2}:\d{2}$/.test(key) ? { start: key.slice(-5) } : {}) }));
  const lessons = [...planned, ...strays].sort((a, b) => (a.start ?? "99").localeCompare(b.start ?? "99"));
  const showTimes = lessons.some((l) => l.start);

  const [lesson, setLesson] = useState<DayLesson | null>(null);
  const [picking, setPicking] = useState(false);
  const [stare, setStare] = useState(false);
  const [session, setSession] = useState<string | null>(null);
  const [grade, setGrade] = useState<SubjectId | null>(null);
  const [exams, setExams] = useState(false);

  // The study figures follow the day being looked at, so an earlier day's blocks can be seen and fixed.
  const studied = minutesOn(date, data.sessions, timer, now);
  const sum = total(studied);
  const blocks = sessionsOn(date, data.sessions);
  const monday = weekStartOf(today);
  const week = WEEK.map((_, i) => {
    const d = addDays(monday, i);
    return { date: d, mins: minutesOn(d, data.sessions, timer, now) };
  });
  const weekTotal = week.reduce((t, d) => t + total(d.mins), 0);
  const weekMax = Math.max(60, ...week.map((d) => total(d.mins)));
  const next = upcomingExams(settings, today)[0];
  const left = next ? daysUntil(next.date, today) : 0;

  return (
    <div className="fade-up">
      <header className="mb-7">
        <h1 className="text-[36px] font-bold leading-none tracking-[-0.04em]">Academics</h1>
      </header>

      <button type="button" onClick={() => setExams(true)} className="tap mb-8 flex w-full items-center gap-3.5 rounded-2xl bg-surface px-4 py-3.5 text-left">
        {next ? (
          <>
            {next.subject && <SubjectMark subject={next.subject} height={30} />}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[16px] font-medium tracking-[-0.01em]">{next.title}</span>
              <span className="mt-0.5 block font-mono text-[12px] tabular-nums text-muted">{formatShort(next.date)}</span>
            </span>
            <span className="shrink-0 whitespace-nowrap">
              <span className="text-[26px] font-bold leading-none tracking-[-0.04em] tabular-nums">{left === 0 ? "Today" : left}</span>
              {left > 0 && <span className="ml-1.5 text-[13px] text-muted">{left === 1 ? "day" : "days"}</span>}
            </span>
          </>
        ) : (
          <>
            <span className="flex-1 text-[15px] text-muted">Next exam</span>
            <span className="text-[14px] font-medium">Add</span>
          </>
        )}
      </button>

      <section>
        <div className="flex h-8 items-center justify-between">
          <span className="text-[13px] text-muted">{dayTitle(date, today)}</span>
          <span className="-mr-2 flex items-center">
            <button type="button" onClick={() => setBack((n) => n + 1)} className="flex h-8 w-8 items-center justify-center text-muted" aria-label="The day before">
              <ChevronIcon dir="left" width={16} height={16} />
            </button>
            <button type="button" onClick={() => setBack((n) => Math.max(0, n - 1))} disabled={back === 0} className="flex h-8 w-8 items-center justify-center text-muted disabled:opacity-25" aria-label="The day after">
              <ChevronIcon width={16} height={16} />
            </button>
          </span>
        </div>
        {lessons.length ? (
          <ul className="mt-1 divide-y divide-line border-y border-line">
            {lessons.map((l) => {
              const log = day?.logs[safeKey(l.key)];
              const said = log?.text.trim() ?? "";
              return (
                <li key={l.key}>
                  <button type="button" onClick={() => setLesson(l)} className="tap flex w-full items-center gap-3.5 py-[15px] text-left">
                    <SubjectMark subject={l.subject} height={said ? 36 : 22} />
                    {showTimes && <span className="w-[42px] shrink-0 font-mono text-[13px] tabular-nums text-muted">{l.start ?? ""}</span>}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[17px] font-medium tracking-[-0.015em]">{SUBJECT_META[l.subject].name}</span>
                      {said && <span className="mt-0.5 block truncate text-[13px] text-muted">{said}</span>}
                    </span>
                    {said || log?.conf ? (
                      <span className="flex shrink-0 items-center font-mono text-[12px] text-ink-2">{log?.conf ? FEEL[log.conf] : <CheckIcon width={15} height={15} />}</span>
                    ) : (
                      <MicIcon width={18} height={18} className="shrink-0 text-faint" />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-1 border-y border-line py-6 text-center text-[14px] text-muted">{waiting ? "…" : "No lessons"}</p>
        )}
      </section>

      <section className="mt-7">
        {timer ? (
          <div className="flex items-center gap-2 rounded-[22px] bg-surface py-2 pl-5 pr-2">
            <button type="button" onClick={() => setPicking(true)} className="tap flex min-w-0 flex-1 items-center gap-3.5 py-1.5 text-left" aria-label="Switch subject">
              <SubjectMark subject={timer.subject} height={38} />
              <span className="min-w-0">
                <span className="block text-[13px] text-muted">{SUBJECT_META[timer.subject].name}</span>
                <span className="block font-mono text-[28px] font-medium leading-tight tracking-[-0.03em] tabular-nums">{stopwatch(Math.max(0, now - timer.start) / 1000)}</span>
              </span>
            </button>
            <button type="button" onClick={stop} className="btn h-12 shrink-0 px-7">
              Stop
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => setPicking(true)} className="btn h-14 w-full text-[16px]">
            Study
          </button>
        )}
        <button type="button" onClick={() => setStare(true)} className="tap mt-2.5 flex h-14 w-full items-center justify-between rounded-full border-[1.5px] border-ink px-6">
          <span className="text-[16px] font-medium tracking-[-0.01em]">Stare at Wall</span>
          <span className="font-mono text-[13px] tabular-nums text-muted">{settings.stareMin}m</span>
        </button>
      </section>

      <section className="mt-10">
        <div className="flex items-baseline justify-between">
          <span className="text-[13px] text-muted">{back === 0 ? "Studied today" : `Studied · ${dayTitle(date, today)}`}</span>
          <button type="button" onClick={() => setSession("new")} className="-my-2 py-2 text-[13px] text-muted">
            Add time
          </button>
        </div>
        <div className="mt-2 text-[44px] font-bold leading-none tracking-[-0.045em] tabular-nums">{mins(sum)}</div>
        <div className="mt-4 flex h-[4px] w-full overflow-hidden rounded-full bg-track" aria-hidden="true">
          {sum >= 1 && SUBJECT_IDS.map((s) => (studied[s] > 0 ? <div key={s} className="h-full transition-[width] duration-500" style={{ width: `${(studied[s] / sum) * 100}%`, background: SUBJECT_META[s].color }} /> : null))}
        </div>
        <ul className="mt-3 divide-y divide-line border-y border-line">
          {SUBJECT_IDS.map((s) => (
            <li key={s} className="flex items-center gap-3.5 py-3">
              <SubjectMark subject={s} height={18} />
              <span className="flex-1 text-[16px]">{SUBJECT_META[s].name}</span>
              <span className={cn("font-mono text-[13px] tabular-nums", studied[s] >= 1 ? "text-ink" : "text-muted")}>{mins(studied[s])}</span>
            </li>
          ))}
        </ul>
        {blocks.length > 0 && (
          <ul className="mt-2">
            {blocks.map((b) => (
              <li key={b.id}>
                <button type="button" onClick={() => setSession(b.id)} className="tap flex w-full items-center gap-3 py-2 text-left font-mono text-[12px] tabular-nums text-muted">
                  <span>
                    {clock(b.start)}–{clock(b.end)}
                  </span>
                  <span className="flex-1 font-sans text-[13px]">{SUBJECT_META[b.subject].name}</span>
                  <span>{mins((b.end - b.start) / 60000)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-9">
        <div className="flex items-baseline justify-between">
          <span className="text-[13px] text-muted">This week</span>
          <span className="font-mono text-[12px] tabular-nums text-muted">{mins(weekTotal)}</span>
        </div>
        <div className="mt-3 flex h-24 items-end gap-2" role="img" aria-label="Time studied each day this week">
          {week.map((d) => {
            const t = total(d.mins);
            return (
              <div key={d.date} className="flex h-full flex-1 flex-col justify-end" title={`${formatShort(d.date)}: ${mins(t)}`}>
                {t >= 1 ? (
                  <div className="flex w-full flex-col-reverse overflow-hidden rounded-[4px]" style={{ height: `${Math.max(5, (t / weekMax) * 100)}%` }}>
                    {SUBJECT_IDS.map((s) => (d.mins[s] > 0 ? <div key={s} style={{ flexGrow: d.mins[s], background: SUBJECT_META[s].color }} /> : null))}
                  </div>
                ) : (
                  <div className="mx-auto h-[3px] w-[3px] rounded-full bg-faint" />
                )}
              </div>
            );
          })}
        </div>
        <div className="mt-2 flex gap-2">
          {week.map((d, i) => (
            <span key={d.date} className={cn("flex-1 text-center font-mono text-[10.5px]", d.date === today ? "text-ink" : "text-muted")}>
              {WEEK[i]}
            </span>
          ))}
        </div>
      </section>

      <section className="mt-9">
        <div className="text-[13px] text-muted">Grades</div>
        <ul className="mt-2 divide-y divide-line border-y border-line">
          {SUBJECT_IDS.map((s) => {
            const { before, now: current } = beforeAndNow(s, data.grades, settings.shiftDate);
            return (
              <li key={s}>
                <button type="button" onClick={() => setGrade(s)} className="tap flex w-full items-center gap-3.5 py-3.5 text-left">
                  <SubjectMark subject={s} />
                  <span className="flex-1 text-[17px] font-medium tracking-[-0.015em]">{SUBJECT_META[s].name}</span>
                  <span className="flex items-center gap-2 text-[17px] font-semibold tabular-nums">
                    {before && <span className="text-muted">{before.grade}</span>}
                    {before && <ArrowIcon width={14} height={14} className="text-faint" />}
                    {current ? <span>{current.grade}</span> : <span className="font-normal text-faint">–</span>}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      {lesson && <LessonSheet date={date} lesson={lesson} onClose={() => setLesson(null)} />}
      {picking && <StudySheet onClose={() => setPicking(false)} />}
      {stare && <StareOverlay onClose={() => setStare(false)} />}
      {session && <SessionSheet id={session === "new" ? null : session} day={date} defaultSubject={timer?.subject ?? "maths"} onClose={() => setSession(null)} />}
      {grade && <GradeSheet subject={grade} onClose={() => setGrade(null)} />}
      {exams && <ExamsSheet onClose={() => setExams(false)} />}
    </div>
  );
}
