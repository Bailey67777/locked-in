"use client";

import { useState } from "react";
import { useHub } from "@/lib/hub/store";
import { uid } from "@/lib/hub/model";
import { daysUntil } from "@/lib/hub/time";
import { addDays, formatShort } from "@/lib/dates";
import { SUBJECT_IDS, SUBJECT_META } from "@/lib/hub/subjects";
import type { SubjectId } from "@/lib/hub/types";
import { cn } from "@/lib/cn";
import Sheet from "./Sheet";
import SubjectMark from "./SubjectMark";
import { CloseIcon } from "./Icons";

/** Exams and tests to count down to: a name, a date and (if it's one subject's) the subject. */
export default function ExamsSheet({ onClose }: { onClose: () => void }) {
  const { data, today, write } = useHub();
  const exams = Object.entries(data.settings.exams)
    .map(([id, e]) => ({ id, ...e }))
    .sort((a, b) => a.date.localeCompare(b.date));
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [subject, setSubject] = useState<SubjectId | null>(null);
  const valid = title.trim() !== "" && date !== "";

  const add = () => {
    if (!valid) return;
    write(`settings/exams/${uid()}`, { title: title.trim(), date, ...(subject ? { subject } : {}) });
    setTitle("");
    setDate("");
    setSubject(null);
  };

  return (
    <Sheet label="Countdown" onClose={onClose}>
      <h2 className="mt-1 text-[28px] font-bold leading-tight tracking-[-0.035em]">Exams</h2>

      {exams.length > 0 && (
        <ul className="mt-4 divide-y divide-line border-y border-line">
          {exams.map((e) => {
            const left = daysUntil(e.date, today);
            return (
              <li key={e.id} className={cn("flex items-center gap-3.5 py-3", left < 0 && "opacity-45")}>
                {e.subject ? <SubjectMark subject={e.subject} /> : <span className="h-5 w-[3px] shrink-0 rounded-full bg-faint" />}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[16px] font-medium tracking-[-0.01em]">{e.title}</span>
                  <span className="block font-mono text-[12px] tabular-nums text-muted">{formatShort(e.date)}</span>
                </span>
                <span className="shrink-0 font-mono text-[13px] tabular-nums text-ink-2">{left < 0 ? "Done" : left === 0 ? "Today" : `${left}d`}</span>
                <button type="button" onClick={() => write(`settings/exams/${e.id}`, null)} className="tap -mr-2 flex h-8 w-8 items-center justify-center rounded-full text-faint hover:text-ink" aria-label={`Remove ${e.title}`}>
                  <CloseIcon width={14} height={14} />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-6 text-[13px] text-muted">Add one</div>
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Physics mock" className="field mt-2" />
      <div className="mt-2 grid grid-cols-4 gap-1 rounded-2xl bg-surface p-1">
        {[null, ...SUBJECT_IDS].map((s) => (
          <button key={s ?? "all"} type="button" aria-pressed={subject === s} onClick={() => setSubject(s)} className={cn("h-10 rounded-xl text-[13px] transition-colors", subject === s ? "bg-ink text-bg" : "text-ink-2")}>
            {s ? SUBJECT_META[s].name : "All"}
          </button>
        ))}
      </div>
      <label className="mt-2 flex h-12 items-center justify-between gap-3 rounded-xl border border-line bg-surface px-3.5">
        <span className="text-[15px] text-muted">Date</span>
        <input type="date" value={date} min={addDays(today, -1)} onChange={(e) => setDate(e.target.value)} className="bg-transparent text-right font-mono text-[15px] tabular-nums text-ink focus:outline-none" />
      </label>
      <button type="button" className="btn mt-3 w-full" disabled={!valid} onClick={add}>
        Add
      </button>
    </Sheet>
  );
}
