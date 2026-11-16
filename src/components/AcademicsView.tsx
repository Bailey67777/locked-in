"use client";

import { useRef, useState } from "react";
import { useHub } from "@/lib/hub/store";
import { useCalendarDay } from "@/lib/hub/calendar";
import { lessonsFor } from "@/lib/hub/model";
import { daysUntil } from "@/lib/hub/time";
import { formatDayMonth, formatShort } from "@/lib/dates";
import { SUBJECT_IDS, SUBJECT_META, gradeRank } from "@/lib/hub/subjects";
import type { SubjectId } from "@/lib/hub/types";
import { cn } from "@/lib/cn";
import { ChevronIcon, PlusIcon, WallIcon } from "./Icons";
import AssessmentSheet, { type AssessmentTarget } from "./AssessmentSheet";
import StareOverlay from "./StareOverlay";

type Sort = "date" | "subject" | "grade";
const SORTS: { id: Sort; name: string }[] = [
  { id: "date", name: "Date" },
  { id: "subject", name: "Subject" },
  { id: "grade", name: "Grade" },
];
const SORT_KEY = "locked-in:results-sort:v1";

/** "18/25" or "72%" as a fraction, so marks can be put in order; -1 when it isn't one. */
function fraction(score: string | undefined): number {
  const of = score?.match(/^\s*(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)\s*$/);
  if (of && Number(of[2]) > 0) return Number(of[1]) / Number(of[2]);
  const pct = score?.match(/^\s*(\d+(?:\.\d+)?)\s*%\s*$/);
  return pct ? Number(pct[1]) / 100 : -1;
}

/** One line of either list: the subject's colour, the name, when, and on the right what's left or what it got. */
function Row({ subject, title, date, onClick, children }: { subject: SubjectId | undefined; title: string; date: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <li>
      <button type="button" onClick={onClick} className="tap flex w-full items-center gap-3.5 py-[13px] text-left">
        <span className="h-9 w-[3px] shrink-0 rounded-full" style={{ background: subject ? SUBJECT_META[subject].color : "var(--faint)" }} aria-hidden="true" />
        <span className="min-w-0 flex-1">
          <span className="line-clamp-2 text-[17px] font-medium leading-snug tracking-[-0.015em]">{title}</span>
          <span className="mt-0.5 block truncate font-mono text-[12px] tabular-nums text-muted">
            {subject ? `${SUBJECT_META[subject].name} · ` : ""}
            {formatShort(date)}
          </span>
        </span>
        <span className="shrink-0 text-right">{children}</span>
      </button>
    </li>
  );
}

/** A result: smaller than what's still to come, with a dot of the subject's colour in place of the bar. */
function ResultRow({ subject, title, date, onClick, children }: { subject: SubjectId | undefined; title: string; date: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <li>
      <button type="button" onClick={onClick} className="tap flex w-full items-center gap-3 py-2.5 text-left">
        <span className="h-[7px] w-[7px] shrink-0 rounded-full" style={{ background: subject ? SUBJECT_META[subject].color : "var(--faint)" }} aria-hidden="true" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] tracking-[-0.01em]">{title}</span>
          <span className="block truncate font-mono text-[11.5px] tabular-nums text-muted">
            {subject ? `${SUBJECT_META[subject].name} · ` : ""}
            {formatDayMonth(date)}
          </span>
        </span>
        <span className="shrink-0 text-right">{children}</span>
      </button>
    </li>
  );
}

/**
 * School as two lists in the same hand as the to-dos. Upcoming: every assessment still to come, nearest first, with
 * the days left. Results: every one that's been sat, kept shut behind one line until it's opened, each with its grade
 * (against the best that subject's tests give) or mark, in the order you choose (date, subject or grade); one whose
 * date has passed waits there until its result is put in. Under the title, today's lessons as
 * a row of times, each with its subject's colour. Nothing is timed.
 */
export default function AcademicsView() {
  const { data, today, now } = useHub();
  const settings = data.settings;
  const { events, error: calendarDown } = useCalendarDay(settings.calendarUrl, today);
  // If the calendar can't be reached and today isn't remembered, the timetable stands in.
  const lessons = lessonsFor(today, settings.calendarUrl && events === null && calendarDown ? { ...settings, calendarUrl: "" } : settings, events).filter((l) => l.start);
  const clockNow = now ? `${String(new Date(now).getHours()).padStart(2, "0")}:${String(new Date(now).getMinutes()).padStart(2, "0")}` : "";

  const [open, setOpen] = useState<AssessmentTarget | null>(null);
  const [stare, setStare] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const resultsRef = useRef<HTMLElement>(null);
  const toggleResults = () => {
    setShowResults((v) => !v);
    // Opened from the bottom of the page, the results would land below the bar: bring them up.
    if (!showResults) window.setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
  };
  const [sort, setSort] = useState<Sort>(() => {
    try {
      const saved = localStorage.getItem(SORT_KEY);
      return SORTS.some((s) => s.id === saved) ? (saved as Sort) : "date";
    } catch {
      return "date";
    }
  });
  const pick = (s: Sort) => {
    setSort(s);
    try {
      localStorage.setItem(SORT_KEY, s);
    } catch {
      /* it just won't be remembered */
    }
  };

  const exams = Object.entries(settings.exams).map(([id, e]) => ({ id, ...e }));
  const upcoming = exams.filter((e) => e.date >= today).sort((a, b) => a.date.localeCompare(b.date));
  // Sat, but no result yet: these head the results until one is put in.
  const waiting = exams.filter((e) => e.date < today).sort((a, b) => b.date.localeCompare(a.date));
  const newest = (a: { date: string; at: number }, b: { date: string; at: number }) => b.date.localeCompare(a.date) || b.at - a.at;
  const results = Object.entries(data.grades)
    .map(([id, g]) => ({ id, ...g }))
    .sort((a, b) => {
      if (sort === "subject") return SUBJECT_IDS.indexOf(a.subject) - SUBJECT_IDS.indexOf(b.subject) || newest(a, b);
      if (sort === "grade") return gradeRank(b.grade || undefined) - gradeRank(a.grade || undefined) || fraction(b.score) - fraction(a.score) || newest(a, b);
      return newest(a, b);
    });

  return (
    <div className="fade-up">
      <header className="mb-7">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-[36px] font-bold leading-none tracking-[-0.04em]">Academics</h1>
          <div className="flex shrink-0 items-center gap-2.5">
            <button type="button" onClick={() => setStare(true)} className="tap flex h-11 w-11 items-center justify-center rounded-full border-[1.5px] border-ink text-ink" aria-label="Stare at Wall">
              <WallIcon />
            </button>
            <button type="button" onClick={() => setOpen({ kind: "new" })} className="tap flex h-11 w-11 items-center justify-center rounded-full bg-ink text-bg" aria-label="Add an assessment">
              <PlusIcon width={20} height={20} />
            </button>
          </div>
        </div>
        {lessons.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 font-mono text-[12px] tabular-nums" aria-label="Today's lessons">
            {lessons.map((l) => {
              const start = l.start as string;
              const over = Boolean(clockNow) && (l.end ?? start) <= clockNow;
              const on = Boolean(clockNow) && !over && start <= clockNow;
              return (
                <span key={l.key} className={cn("flex items-center gap-1.5", over ? "text-faint" : on ? "font-semibold text-ink" : "text-muted")} title={SUBJECT_META[l.subject].name}>
                  <span className="h-[7px] w-[7px] rounded-full" style={{ background: SUBJECT_META[l.subject].color, opacity: over ? 0.35 : 1 }} aria-hidden="true" />
                  {start}
                </span>
              );
            })}
          </div>
        )}
      </header>

      <section>
        <div className="mb-2 flex items-baseline justify-between">
          <span className="text-[13px] text-muted">Upcoming</span>
          {upcoming.length > 0 && <span className="font-mono text-[12px] tabular-nums text-muted">{upcoming.length}</span>}
        </div>
        {upcoming.length ? (
          <ul className="divide-y divide-line border-y border-line">
            {upcoming.map((e) => {
              const left = daysUntil(e.date, today);
              return (
                <Row key={e.id} subject={e.subject} title={e.title} date={e.date} onClick={() => setOpen({ kind: "exam", id: e.id })}>
                  <span className={cn("text-[14px] tabular-nums", left <= 3 ? "font-semibold text-ink" : "text-muted")}>{left <= 0 ? "Today" : left === 1 ? "Tomorrow" : `${left} days`}</span>
                </Row>
              );
            })}
          </ul>
        ) : (
          <p className="border-y border-line py-[13px] text-center text-[15px] text-faint">–</p>
        )}
      </section>

      {/* What's been sat is kept shut until asked for: a line that opens, in a smaller hand than what's still to come. */}
      <section className="mt-9" ref={resultsRef}>
        <button type="button" onClick={toggleResults} aria-expanded={showResults} className="tap flex w-full items-center justify-between border-y border-line py-4 text-left">
          <span className="text-[17px] font-medium tracking-[-0.015em]">Results</span>
          <span className="flex items-center gap-2.5">
            {waiting.length > 0 ? <span className="text-[13px] text-ink">{waiting.length} to add</span> : <span className="font-mono text-[12px] tabular-nums text-muted">{results.length || "–"}</span>}
            <ChevronIcon dir={showResults ? "up" : "down"} width={16} height={16} className="text-muted" />
          </span>
        </button>
        {showResults && (
          <div className="fade-in rounded-b-2xl bg-surface px-4 pb-1">
            <div className="flex justify-end gap-3.5 pt-3 text-[13px]" role="group" aria-label="Order results by">
              {SORTS.map((o) => (
                <button key={o.id} type="button" aria-pressed={sort === o.id} onClick={() => pick(o.id)} className={sort === o.id ? "text-ink" : "text-faint"}>
                  {o.name}
                </button>
              ))}
            </div>
            {waiting.length || results.length ? (
              <ul className="mt-1 divide-y divide-line">
                {waiting.map((e) => (
                  <ResultRow key={e.id} subject={e.subject} title={e.title} date={e.date} onClick={() => setOpen({ kind: "exam", id: e.id })}>
                    <span className="text-[13px] text-muted">Add result</span>
                  </ResultRow>
                ))}
                {results.map((g) => (
                  <ResultRow key={g.id} subject={g.subject} title={g.label || "Assessment"} date={g.date} onClick={() => setOpen({ kind: "result", id: g.id })}>
                    <span className="flex items-baseline gap-2.5">
                      {g.score && <span className={cn("font-mono text-[12.5px] tabular-nums", g.grade ? "text-muted" : "text-ink")}>{g.score}</span>}
                      {g.grade && (
                        <span className="text-[15px] font-semibold tracking-[-0.01em]">
                          {g.grade}
                          <span className="font-normal text-muted"> / {SUBJECT_META[g.subject].top}</span>
                        </span>
                      )}
                    </span>
                  </ResultRow>
                ))}
              </ul>
            ) : (
              <p className="py-4 text-center text-[15px] text-faint">–</p>
            )}
          </div>
        )}
      </section>

      {open && <AssessmentSheet target={open} onClose={() => setOpen(null)} />}
      {stare && <StareOverlay onClose={() => setStare(false)} />}
    </div>
  );
}
