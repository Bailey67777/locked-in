"use client";

import { useState } from "react";
import { useHub } from "@/lib/hub/store";
import { useCalendarDay } from "@/lib/hub/calendar";
import { beforeAndNow, lessonsFor, openPoint, upcomingExams } from "@/lib/hub/model";
import { daysUntil } from "@/lib/hub/time";
import { SUBJECT_IDS, SUBJECT_META } from "@/lib/hub/subjects";
import type { SubjectId } from "@/lib/hub/types";
import { cn } from "@/lib/cn";
import { ArrowIcon, CheckIcon, MicIcon, MoreIcon, WallIcon } from "./Icons";
import LessonSheet from "./LessonSheet";
import GradeSheet from "./GradeSheet";
import ExamsSheet from "./ExamsSheet";
import StareOverlay from "./StareOverlay";

/** "13 days", "Tomorrow", "Today". */
const countdown = (days: number) => (days <= 0 ? "Today" : days === 1 ? "Tomorrow" : `${days} days`);

/**
 * School in three slabs, one per subject, sharing the screen from the title down to the bar, the way the habits do.
 * Each says where that subject stands: today's lessons, the exams coming with the days left first, the point Claude
 * last left open, and the grade, large. Nothing here is timed. Tap a slab for its grades; the round button on it is
 * where you say what you did in that lesson.
 */
export default function AcademicsView() {
  const { data, today } = useHub();
  const settings = data.settings;
  const { events, error: calendarDown } = useCalendarDay(settings.calendarUrl, today);
  // If the calendar can't be reached and today isn't remembered, the timetable stands in.
  const lessons = lessonsFor(today, settings.calendarUrl && events === null && calendarDown ? { ...settings, calendarUrl: "" } : settings, events);
  const day = data.days[today];
  const exams = upcomingExams(settings, today);

  const [talking, setTalking] = useState<SubjectId | null>(null);
  const [grades, setGrades] = useState<SubjectId | null>(null);
  const [stare, setStare] = useState(false);
  const [showExams, setShowExams] = useState(false);

  const talkingLesson = talking ? lessons.find((l) => l.subject === talking && l.start) : undefined;

  return (
    <div className="fade-up flex flex-1 flex-col" style={{ minHeight: 60 + SUBJECT_IDS.length * 150 }}>
      {/* The title row sits a little below the middle of its slice, like Habits. */}
      <header className="flex min-h-[50px] flex-col" style={{ flex: "1 1 0" }}>
        <div style={{ flex: "3 1 0" }} />
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-[36px] font-bold leading-none tracking-[-0.04em]">Academics</h1>
          <div className="flex shrink-0 items-center gap-2.5">
            <button type="button" onClick={() => setStare(true)} className="tap flex h-11 w-11 items-center justify-center rounded-full border-[1.5px] border-ink text-ink" aria-label="Stare at Wall">
              <WallIcon />
            </button>
            <button type="button" onClick={() => setShowExams(true)} className="tap flex h-11 w-11 items-center justify-center rounded-full border-[1.5px] border-ink text-ink" aria-label="Exams">
              <MoreIcon />
            </button>
          </div>
        </div>
        <div style={{ flex: "1 1 0" }} />
      </header>

      <div className="-mx-5 flex flex-col" style={{ flex: "11 1 0" }}>
        {SUBJECT_IDS.map((s, i) => {
          const meta = SUBJECT_META[s];
          const log = day?.logs[s];
          const said = Boolean(log?.text.trim() || log?.conf);
          const times = lessons.filter((l) => l.subject === s && l.start).map((l) => l.start as string);
          // This subject's exams (or, if it has none, the ones that belong to no subject), nearest first, grouped by
          // day: three on the same day share one line.
          const own = exams.filter((e) => e.subject === s);
          const mine = own.length ? own : exams.filter((e) => !e.subject);
          const dates = [...new Set(mine.map((e) => e.date))].slice(0, 3);
          const coming = dates.map((date) => ({ date, days: daysUntil(date, today), names: mine.filter((e) => e.date === date).map((e) => e.title) }));
          // What Claude last left unresolved in this subject: the thing to go and fix.
          const shaky = openPoint(data.days, s, today);
          const { before, now: current } = beforeAndNow(s, data.grades, settings.shiftDate);
          const target = settings.targets[s];
          return (
            <section key={s} className="relative flex min-h-[150px] flex-col overflow-hidden px-5" style={{ flex: "1 1 0" }} aria-label={meta.name}>
              {/* Hairlines drawn inside the page margin, as on Habits. */}
              <span className="pointer-events-none absolute inset-x-5 top-0 h-px bg-line" aria-hidden="true" />
              {i === SUBJECT_IDS.length - 1 && <span className="pointer-events-none absolute inset-x-5 bottom-0 h-px bg-line" aria-hidden="true" />}

              {/* The whole slab opens this subject's grades. */}
              <button type="button" onClick={() => setGrades(s)} className="absolute inset-0 transition-colors active:bg-surface" aria-label={`${meta.name} grades`} />

              <div className="pointer-events-none relative flex min-h-0 flex-1 flex-col py-5">
                <div className="flex items-start gap-3.5">
                  <span className="mt-[3px] h-[26px] w-[3px] shrink-0 rounded-full" style={{ background: meta.color }} aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate text-[30px] font-bold leading-none tracking-[-0.04em]">{meta.name}</h2>
                    <div className="mt-2.5 space-y-1.5">
                      {times.length > 0 && <div className="truncate font-mono text-[12px] tabular-nums text-muted">{times.join(" · ")}</div>}
                      {coming.map((c) => (
                        <div key={c.date} className="line-clamp-2 text-[13px] leading-snug">
                          <span className="font-semibold">{countdown(c.days)}</span>
                          <span className="text-muted"> {c.names.join(" · ")}</span>
                        </div>
                      ))}
                      {shaky && <div className="truncate text-[13px] text-ink-2">{shaky}</div>}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setTalking(s)}
                    className={cn("tap pointer-events-auto flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-[1.5px] border-ink", said && "bg-ink text-bg")}
                    aria-label={said ? `What you did in ${meta.name}` : `Say what you did in ${meta.name}`}
                  >
                    {said ? <CheckIcon width={18} height={18} /> : <MicIcon />}
                  </button>
                </div>

                {/* The grade: where it was, where it is, and where it's meant to end up. */}
                <div className="mt-auto flex items-baseline justify-between gap-4 pl-[17.5px] pt-3">
                  <div className="flex items-baseline gap-3 text-[52px] font-bold leading-none tracking-[-0.05em]">
                    {before && current && <span className="text-faint">{before.grade}</span>}
                    {before && current && <ArrowIcon width={22} height={22} className="self-center text-faint" />}
                    {current || before ? <span>{(current ?? before)?.grade}</span> : <span className="text-faint">–</span>}
                  </div>
                  {target && <span className="font-mono text-[12px] tabular-nums text-muted">target {target}</span>}
                </div>
              </div>
            </section>
          );
        })}
      </div>

      {talking && <LessonSheet date={today} lesson={{ key: talking, subject: talking, start: talkingLesson?.start, end: talkingLesson?.end }} onClose={() => setTalking(null)} />}
      {grades && <GradeSheet subject={grades} onClose={() => setGrades(null)} />}
      {stare && <StareOverlay onClose={() => setStare(false)} />}
      {showExams && <ExamsSheet onClose={() => setShowExams(false)} />}
    </div>
  );
}
