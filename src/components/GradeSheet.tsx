"use client";

import { Fragment, useState } from "react";
import { useHub } from "@/lib/hub/store";
import { gradesFor, uid } from "@/lib/hub/model";
import { addDays, formatDayMonth } from "@/lib/dates";
import { GRADES, SUBJECT_META } from "@/lib/hub/subjects";
import type { SubjectId } from "@/lib/hub/types";
import { cn } from "@/lib/cn";
import Sheet from "./Sheet";
import { CloseIcon } from "./Icons";

function GradePicker({ value, onPick }: { value: string | undefined; onPick: (g: string) => void }) {
  return (
    <div className="grid grid-cols-7 gap-1 rounded-2xl bg-surface p-1">
      {GRADES.map((g) => (
        <button key={g} type="button" aria-pressed={value === g} onClick={() => onPick(g)} className={cn("h-11 rounded-xl text-[15px] font-semibold transition-colors", value === g ? "bg-ink text-bg" : "text-ink-2")}>
          {g}
        </button>
      ))}
    </div>
  );
}

/** A subject's grades: add one (mock, test, predicted…), see them all, set a target. */
export default function GradeSheet({ subject, onClose }: { subject: SubjectId; onClose: () => void }) {
  const { data, today, write } = useHub();
  const settings = data.settings;
  const shift = settings.shiftDate;
  const all = gradesFor(subject, data.grades).reverse();
  const [grade, setGrade] = useState<string | undefined>();
  const [label, setLabel] = useState("");
  const [score, setScore] = useState("");
  const [date, setDate] = useState(today);
  const target = settings.targets[subject];

  const add = () => {
    if (!grade) return;
    write(`grades/${uid()}`, { subject, grade, label: label.trim(), date, at: Date.now(), ...(score.trim() ? { score: score.trim() } : {}) });
    setGrade(undefined);
    setLabel("");
    setScore("");
  };

  return (
    <Sheet label={SUBJECT_META[subject].board} accent={SUBJECT_META[subject].color} onClose={onClose}>
      <h2 className="mt-1 text-[28px] font-bold leading-tight tracking-[-0.035em]">{SUBJECT_META[subject].name}</h2>

      <div className="mt-5 text-[13px] text-muted">New grade</div>
      <div className="mt-2">
        <GradePicker value={grade} onPick={(g) => setGrade(grade === g ? undefined : g)} />
      </div>
      <div className="mt-2 grid grid-cols-[1fr_96px] gap-2">
        <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Mock, test, predicted…" className="field" />
        <input value={score} onChange={(e) => setScore(e.target.value)} placeholder="14/20" className="field font-mono text-[14px]" />
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <div className="flex gap-1 rounded-xl bg-surface p-1">
          {[
            { label: "Today", value: today },
            { label: `Before ${formatDayMonth(shift)}`, value: addDays(shift, -1) },
          ].map((o) => (
            <button key={o.label} type="button" aria-pressed={date === o.value} onClick={() => setDate(o.value)} className={cn("h-9 rounded-lg px-3 text-[13px] transition-colors", date === o.value ? "bg-ink text-bg" : "text-ink-2")}>
              {o.label}
            </button>
          ))}
        </div>
        <input type="date" value={date} max={today} onChange={(e) => e.target.value && setDate(e.target.value)} className="w-[118px] bg-transparent text-right font-mono text-[13px] tabular-nums text-muted focus:outline-none" aria-label="Date" />
      </div>
      <button type="button" className="btn mt-3 w-full" disabled={!grade} onClick={add}>
        Add {grade ?? "grade"}
      </button>

      {all.length > 0 && (
        <>
          <div className="mt-8 text-[13px] text-muted">All grades</div>
          <ul className="mt-2 border-y border-line">
            {all.map((g, i) => {
              const crossing = i > 0 && all[i - 1].date >= shift && g.date < shift;
              return (
                <Fragment key={g.id}>
                  {crossing && (
                    <li className="label flex items-center gap-3 py-2">
                      <span className="h-px flex-1 bg-line" />
                      {formatDayMonth(shift)}
                      <span className="h-px flex-1 bg-line" />
                    </li>
                  )}
                  <li className="flex items-center gap-3 border-t border-line py-3 first:border-t-0">
                    <span className="w-14 shrink-0 font-mono text-[12px] tabular-nums text-muted">{formatDayMonth(g.date)}</span>
                    <span className="min-w-0 flex-1 truncate text-[15px]">
                      {g.label || "Grade"}
                      {g.score && <span className="ml-2 font-mono text-[12.5px] text-muted">{g.score}</span>}
                    </span>
                    <span className="text-[18px] font-bold tracking-[-0.02em]">{g.grade}</span>
                    <button type="button" onClick={() => write(`grades/${g.id}`, null)} className="tap -mr-2 flex h-8 w-8 items-center justify-center rounded-full text-faint hover:text-ink" aria-label={`Delete ${g.grade} from ${formatDayMonth(g.date)}`}>
                      <CloseIcon width={14} height={14} />
                    </button>
                  </li>
                </Fragment>
              );
            })}
          </ul>
        </>
      )}

      <div className="mt-8 text-[13px] text-muted">Target</div>
      <div className="mt-2">
        <GradePicker value={target} onPick={(g) => write(`settings/targets/${subject}`, target === g ? null : g)} />
      </div>
    </Sheet>
  );
}
