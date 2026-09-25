"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { Q_SUBJECTS, Q_SUBJECT_LABEL, SUBJECT_COLOR } from "@/lib/model";
import type { QSubject } from "@/lib/types";
import { addDays, formatShort } from "@/lib/dates";
import { cn } from "@/lib/cn";
import Journal from "./Journal";

const TONE: Record<QSubject, string> = { maths: SUBJECT_COLOR.maths, physics: SUBJECT_COLOR.physics, econ: SUBJECT_COLOR.econ };

/**
 * The three questions Claude set for this day (cached on the device, so they work offline) with answer boxes.
 * Answers save locally straight away and sync when there's a connection.
 */
export default function TodayQuestions({ date }: { date: string }) {
  const { data, getDay, updateDay, today } = useStore();
  const day = getDay(date);
  const questions = data.study.questions[date];
  const feedback = data.study.feedback[date];
  const yesterday = addDays(date, -1);
  const yFeedback = data.study.feedback[yesterday];
  const yQuestions = data.study.questions[yesterday];
  const yAnswers = data.days[yesterday]?.answers;
  const [open, setOpen] = useState<Partial<Record<QSubject, boolean>>>({});

  const saveAnswer = (subject: QSubject, text: string) =>
    updateDay(date, (d) => {
      const answers = { ...(d.answers ?? {}) };
      if (text.trim()) answers[subject] = text;
      else delete answers[subject];
      return { ...d, answers: Object.keys(answers).length ? answers : undefined };
    });

  return (
    <section className="card p-4 md:p-5">
      <div className="mb-3">
        <h2 className="text-lg font-extrabold text-ink">{date === today ? "Today's questions" : "Questions"}</h2>
        <p className="text-sm font-semibold text-ink-muted">One each, aimed at what you&apos;ve been shaky on. Claude sets them each night and marks them the next.</p>
      </div>

      {!questions ? (
        <p className="rounded-2xl bg-sand-50 px-4 py-4 text-center text-sm font-semibold text-ink-muted">No questions yet — Claude sets these each night.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {Q_SUBJECTS.map((subject) => {
            const q = questions[subject];
            if (!q) return null;
            const answer = day.answers?.[subject] ?? "";
            const fb = feedback?.[subject];
            const answered = answer.trim().length > 0;
            const expanded = open[subject] ?? !answered;
            return (
              <li key={subject} className="rounded-2xl bg-sand-50 p-3" style={{ borderLeft: `5px solid ${TONE[subject]}` }}>
                <button type="button" className="flex w-full items-start gap-2 text-left" onClick={() => setOpen((o) => ({ ...o, [subject]: !expanded }))} aria-expanded={expanded}>
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] font-extrabold uppercase tracking-wider" style={{ color: TONE[subject] }}>
                      {Q_SUBJECT_LABEL[subject]}
                      {q.topic ? ` · ${q.topic}` : ""}
                    </div>
                    {!expanded && <div className="truncate text-sm font-bold text-ink">{answered ? "Answered ✓" : q.question}</div>}
                  </div>
                  <span className="shrink-0 text-xs font-extrabold text-ink-muted">{expanded ? "hide" : "show"}</span>
                </button>
                {expanded && (
                  <div className="mt-2">
                    <p className="whitespace-pre-wrap text-[15px] font-bold leading-snug text-ink">{q.question}</p>
                    {q.why && <p className="mt-1 text-xs font-semibold text-ink-muted">Why this: {q.why}</p>}
                    <div className="mt-2">
                      <Journal key={`ans-${subject}-${date}`} value={answer} rows={3} onSave={(t) => saveAnswer(subject, t)} placeholder="Your answer, working and all." />
                    </div>
                    {fb && <FeedbackCard fb={fb} />}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {date === today && (
        <details className="mt-3 rounded-2xl bg-sand-50 px-3 py-2">
          <summary className="cursor-pointer text-sm font-extrabold text-ink">
            Yesterday&apos;s feedback{yFeedback ? "" : " · none yet"}
          </summary>
          {!yFeedback ? (
            <p className="mt-2 text-xs font-semibold text-ink-muted">Claude hasn&apos;t marked {formatShort(yesterday)} yet. Marks appear here the morning after you submit.</p>
          ) : (
            <ul className="mt-2 flex flex-col gap-2">
              {Q_SUBJECTS.map((subject) => {
                const fb = yFeedback[subject];
                if (!fb) return null;
                const q = yQuestions?.[subject];
                return (
                  <li key={subject} className="rounded-xl bg-white p-3" style={{ borderLeft: `4px solid ${TONE[subject]}` }}>
                    <div className="text-[11px] font-extrabold uppercase tracking-wider" style={{ color: TONE[subject] }}>
                      {Q_SUBJECT_LABEL[subject]}
                      {q?.topic ? ` · ${q.topic}` : ""}
                    </div>
                    {q && <p className="mt-1 text-sm font-bold text-ink">{q.question}</p>}
                    {yAnswers?.[subject] && <p className="mt-1 whitespace-pre-wrap text-xs font-semibold text-ink-soft">You: {yAnswers[subject]}</p>}
                    <FeedbackCard fb={fb} />
                  </li>
                );
              })}
            </ul>
          )}
        </details>
      )}
    </section>
  );
}

function FeedbackCard({ fb }: { fb: { mark: string; comment: string; correctAnswer?: string } }) {
  return (
    <div className={cn("mt-2 rounded-xl bg-teal-100/60 px-3 py-2")}>
      <div className="text-sm font-extrabold text-teal-700">Claude&apos;s mark: {fb.mark || "–"}</div>
      {fb.comment && <p className="mt-0.5 whitespace-pre-wrap text-sm font-semibold text-ink">{fb.comment}</p>}
      {fb.correctAnswer && <p className="mt-1 whitespace-pre-wrap text-xs font-semibold text-ink-soft">Model answer: {fb.correctAnswer}</p>}
    </div>
  );
}
