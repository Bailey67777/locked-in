"use client";

import { useState } from "react";
import { useHub } from "@/lib/hub/store";
import { useCalendarDay } from "@/lib/hub/calendar";
import { lessonsFor, upcomingExams } from "@/lib/hub/model";
import { daysUntil } from "@/lib/hub/time";
import { SUBJECT_IDS, SUBJECT_META } from "@/lib/hub/subjects";
import type { SubjectId } from "@/lib/hub/types";
import { cn } from "@/lib/cn";
import { MoreIcon, WallIcon } from "./Icons";
import GradeSheet from "./GradeSheet";
import ExamsSheet from "./ExamsSheet";
import StareOverlay from "./StareOverlay";

/**
 * School in three slabs, one per subject, sharing the screen from the title down to the bar, the way the habits do.
 * A slab says two things: when that subject's lessons are today, and how long until its next exam, as one large
 * number. While one of its lessons is on, the slab fills with the subject's colour. Nothing is timed and nothing
 * is typed here; a tap opens the subject's grades, which stay out of sight.
 */
export default function AcademicsView() {
  const { data, today, now } = useHub();
  const settings = data.settings;
  const { events, error: calendarDown } = useCalendarDay(settings.calendarUrl, today);
  // If the calendar can't be reached and today isn't remembered, the timetable stands in.
  const lessons = lessonsFor(today, settings.calendarUrl && events === null && calendarDown ? { ...settings, calendarUrl: "" } : settings, events);
  const exams = upcomingExams(settings, today);
  const clockNow = now ? `${String(new Date(now).getHours()).padStart(2, "0")}:${String(new Date(now).getMinutes()).padStart(2, "0")}` : "";

  const [grades, setGrades] = useState<SubjectId | null>(null);
  const [stare, setStare] = useState(false);
  const [showExams, setShowExams] = useState(false);

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
          const mine = lessons.filter((l) => l.subject === s && l.start);
          // A lesson of this subject is happening right now.
          const live = Boolean(clockNow) && mine.some((l) => (l.start as string) <= clockNow && clockNow < (l.end ?? (l.start as string)));
          // This subject's exams (or, if it has none, the ones that belong to no subject), nearest first, grouped by
          // day: three on the same day share one line.
          const own = exams.filter((e) => e.subject === s);
          const sat = own.length ? own : exams.filter((e) => !e.subject);
          const dates = [...new Set(sat.map((e) => e.date))].slice(0, 3);
          const [next, ...later] = dates.map((date) => ({ date, days: daysUntil(date, today), names: sat.filter((e) => e.date === date).map((e) => e.title) }));
          const soft = live ? "opacity-70" : "text-muted";
          return (
            <section
              key={s}
              className="relative flex min-h-[150px] flex-col overflow-hidden px-5 transition-colors duration-300"
              style={{ flex: "1 1 0", background: live ? meta.color : undefined, color: live ? meta.on : undefined }}
              aria-label={meta.name}
            >
              {/* Hairlines drawn inside the page margin, as on Habits; a slab filled with colour needs none. */}
              {!live && <span className="pointer-events-none absolute inset-x-5 top-0 h-px bg-line" aria-hidden="true" />}
              {!live && i === SUBJECT_IDS.length - 1 && <span className="pointer-events-none absolute inset-x-5 bottom-0 h-px bg-line" aria-hidden="true" />}

              <button type="button" onClick={() => setGrades(s)} className={cn("absolute inset-0 transition-colors", !live && "active:bg-surface")} aria-label={`${meta.name} grades`} />

              <div className="pointer-events-none relative flex min-h-0 flex-1 flex-col py-5">
                <div className="flex items-start gap-3.5">
                  {!live && <span className="mt-[3px] h-[26px] w-[3px] shrink-0 rounded-full" style={{ background: meta.color }} aria-hidden="true" />}
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate text-[30px] font-bold leading-none tracking-[-0.04em]">{meta.name}</h2>
                    {mine.length > 0 && <div className={cn("mt-2.5 truncate font-mono text-[12px] tabular-nums", soft)}>{mine.map((l) => (live && l.end ? `${l.start}–${l.end}` : l.start)).join(" · ")}</div>}
                  </div>
                </div>

                {/* The next exam: the days left, large, with what it is beside them; any after it underneath. */}
                {next && (
                  <div className={cn("mt-auto flex items-end justify-between gap-5 pt-3", !live && "pl-[17.5px]")}>
                    <div className="flex shrink-0 items-baseline gap-2">
                      <span className="text-[64px] font-bold leading-[0.82] tracking-[-0.055em] tabular-nums">{next.days <= 0 ? "Today" : next.days}</span>
                      {next.days > 0 && <span className={cn("font-mono text-[12px]", soft)}>{next.days === 1 ? "day" : "days"}</span>}
                    </div>
                    <div className="min-w-0 text-right">
                      <div className="line-clamp-2 text-[15px] font-medium leading-snug tracking-[-0.01em]">{next.names.join(" · ")}</div>
                      {later.map((c) => (
                        <div key={c.date} className={cn("mt-1 truncate text-[13px]", soft)}>
                          <span className="font-semibold">{c.days <= 0 ? "Today" : c.days === 1 ? "1 day" : `${c.days} days`}</span> {c.names.join(" · ")}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </section>
          );
        })}
      </div>

      {grades && <GradeSheet subject={grades} onClose={() => setGrades(null)} />}
      {stare && <StareOverlay onClose={() => setStare(false)} />}
      {showExams && <ExamsSheet onClose={() => setShowExams(false)} />}
    </div>
  );
}
