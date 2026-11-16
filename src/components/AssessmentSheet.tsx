"use client";

import { useState } from "react";
import { useHub } from "@/lib/hub/store";
import { uid } from "@/lib/hub/model";
import { GRADES, SUBJECT_IDS, SUBJECT_META } from "@/lib/hub/subjects";
import type { SubjectId } from "@/lib/hub/types";
import { cn } from "@/lib/cn";
import Sheet from "./Sheet";

export type AssessmentTarget = { kind: "new" } | { kind: "exam"; id: string } | { kind: "result"; id: string };

/**
 * One assessment: what it is, which subject, when, and (once it's back) what it got: a grade, a mark, or both.
 * Without a result it counts down under Upcoming; with one it moves to Results. The same sheet adds, edits and deletes.
 */
export default function AssessmentSheet({ target, onClose }: { target: AssessmentTarget; onClose: () => void }) {
  const { data, write } = useHub();
  const exam = target.kind === "exam" ? data.settings.exams[target.id] : undefined;
  const result = target.kind === "result" ? data.grades[target.id] : undefined;
  const [title, setTitle] = useState(exam?.title ?? result?.label ?? "");
  const [subject, setSubject] = useState<SubjectId | null>(exam?.subject ?? result?.subject ?? null);
  const [date, setDate] = useState(exam?.date ?? result?.date ?? "");
  const [grade, setGrade] = useState(result?.grade ?? "");
  const [score, setScore] = useState(result?.score ?? "");
  const valid = title.trim() !== "" && date !== "" && subject !== null;
  const marked = Boolean(grade || score.trim());

  const save = () => {
    if (!valid || !subject) return;
    if (marked) {
      write(`grades/${target.kind === "result" ? target.id : uid()}`, { subject, grade, label: title.trim(), date, at: result?.at ?? Date.now(), ...(score.trim() ? { score: score.trim() } : {}) });
      if (target.kind === "exam") write(`settings/exams/${target.id}`, null);
    } else {
      write(`settings/exams/${target.kind === "exam" ? target.id : uid()}`, { title: title.trim(), date, subject });
      if (target.kind === "result") write(`grades/${target.id}`, null);
    }
    onClose();
  };

  const remove = () => {
    if (target.kind === "exam") write(`settings/exams/${target.id}`, null);
    if (target.kind === "result") write(`grades/${target.id}`, null);
    onClose();
  };

  return (
    <Sheet label={target.kind === "new" ? "New" : "Assessment"} accent={subject ? SUBJECT_META[subject].color : undefined} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Name" maxLength={120} enterKeyHint="done" className="field mt-3" aria-label="Name" />
        <div className="mt-2 grid grid-cols-3 gap-1 rounded-2xl bg-surface p-1">
          {SUBJECT_IDS.map((s) => (
            <button key={s} type="button" aria-pressed={subject === s} onClick={() => setSubject(s)} className={cn("h-10 rounded-xl text-[13.5px] transition-colors", subject === s ? "bg-ink text-bg" : "text-ink-2")}>
              {SUBJECT_META[s].name}
            </button>
          ))}
        </div>
        <label className="mt-2 flex h-12 items-center justify-between gap-3 rounded-xl border border-line bg-surface px-3.5">
          <span className="text-[15px] text-muted">Date</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="bg-transparent text-right font-mono text-[15px] tabular-nums text-ink focus:outline-none" />
        </label>

        <div className="mt-6 text-[13px] text-muted">Result</div>
        <div className="mt-2 grid grid-cols-7 gap-1 rounded-2xl bg-surface p-1">
          {GRADES.map((g) => (
            <button key={g} type="button" aria-pressed={grade === g} onClick={() => setGrade(grade === g ? "" : g)} className={cn("h-11 rounded-xl text-[15px] font-semibold transition-colors", grade === g ? "bg-ink text-bg" : "text-ink-2")}>
              {g}
            </button>
          ))}
        </div>
        <input value={score} onChange={(e) => setScore(e.target.value)} placeholder="18/25" maxLength={20} enterKeyHint="done" className="field mt-2 font-mono text-[14px]" aria-label="Mark" />

        <button type="submit" className="btn mt-4 w-full" disabled={!valid}>
          Save
        </button>
        {target.kind !== "new" && (
          <button type="button" onClick={remove} className="mx-auto mt-1 block h-11 px-4 text-[13.5px] text-muted">
            Delete
          </button>
        )}
      </form>
    </Sheet>
  );
}
