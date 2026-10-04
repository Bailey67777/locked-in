"use client";

import { useState } from "react";
import type { Subject } from "@/lib/types";
import { useStore } from "@/lib/store";
import { SUBJECTS, SUBJECT_COLOR, studyMinutes } from "@/lib/model";
import { formatMins } from "@/lib/dates";
import { cn } from "@/lib/cn";
import DebouncedInput from "./DebouncedInput";

const SHORT: Record<Subject, string> = { maths: "Maths", further: "Further", physics: "Physics", econ: "Econ" };
const STEPS = [15, 30, 60];

/** Time per A-level today, plus a line on what was done. The nightly Claude task reads this to estimate grades. */
export default function StudyLogCard({ date }: { date: string }) {
  const { getDay, updateDay } = useStore();
  const day = getDay(date);
  const [open, setOpen] = useState<Subject | null>(null);
  const total = studyMinutes(day);

  const set = (s: Subject, change: { mins?: number; note?: string }) =>
    updateDay(date, (d) => {
      const prev = d.studyLog?.[s] ?? { mins: 0 };
      const next = { ...prev, ...change, mins: Math.max(0, Math.min(16 * 60, change.mins ?? prev.mins)) };
      const log = { ...(d.studyLog ?? {}) };
      if (!next.mins && !next.note?.trim()) delete log[s];
      else log[s] = next.note?.trim() ? next : { mins: next.mins };
      return { ...d, studyLog: Object.keys(log).length ? log : undefined };
    });

  const entry = open ? day.studyLog?.[open] : undefined;

  return (
    <section className="card p-4">
      <div className="mb-2.5 flex items-baseline justify-between gap-2">
        <h2 className="card-title">Study</h2>
        <span className="card-sub tabular-nums">{total ? `${formatMins(total)} today` : "log time + what you did"}</span>
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        {SUBJECTS.map((s) => {
          const mins = day.studyLog?.[s]?.mins ?? 0;
          const hasNote = Boolean(day.studyLog?.[s]?.note?.trim());
          return (
            <button
              key={s}
              type="button"
              onClick={() => setOpen(open === s ? null : s)}
              aria-expanded={open === s}
              className={cn("tap relative rounded-xl border px-1 py-2 text-center transition-colors", open === s ? "border-transparent bg-ink text-white" : "border-black/[0.06] bg-sand-50 hover:bg-sand-100")}
            >
              <span className="absolute left-2 top-2 h-1.5 w-1.5 rounded-full" style={{ background: SUBJECT_COLOR[s] }} />
              <div className={cn("text-[11px] font-bold", open === s ? "text-white/70" : "text-ink-muted")}>{SHORT[s]}</div>
              <div className="text-[14px] font-extrabold tabular-nums">{mins ? formatMins(mins) : "–"}</div>
              {hasNote && <span className={cn("absolute right-2 top-2 h-1.5 w-1.5 rounded-full", open === s ? "bg-white/70" : "bg-ink-muted/50")} title="Has a note" />}
            </button>
          );
        })}
      </div>

      {open && (
        <div className="pop-in mt-2.5 rounded-xl bg-sand-50 p-2.5">
          <div className="flex flex-wrap items-center gap-1.5">
            {STEPS.map((m) => (
              <button key={m} type="button" className="tap rounded-lg bg-white px-2.5 py-1.5 text-[12.5px] font-bold text-ink shadow-soft" onClick={() => set(open, { mins: (entry?.mins ?? 0) + m })}>
                +{formatMins(m)}
              </button>
            ))}
            <button type="button" className="tap rounded-lg px-2.5 py-1.5 text-[12.5px] font-bold text-ink-muted hover:bg-white" onClick={() => set(open, { mins: (entry?.mins ?? 0) - 15 })} disabled={!entry?.mins}>
              −15m
            </button>
            {entry?.mins ? (
              <button type="button" className="ml-auto text-[12px] font-bold text-ink-muted" onClick={() => set(open, { mins: 0 })}>
                reset
              </button>
            ) : null}
          </div>
          <DebouncedInput
            key={`${date}-${open}`}
            value={entry?.note ?? ""}
            onSave={(note) => set(open, { note })}
            placeholder="What did you do? Marks count: e.g. “Paper 1 2019, 58/80”"
            ariaLabel="What you studied"
            maxLength={400}
            className="field mt-2 py-2 text-[13.5px]"
          />
          <p className="mt-1.5 text-[11px] font-semibold text-ink-muted">Claude reads this each night: scores and topics here are what your grade estimate is based on.</p>
        </div>
      )}
    </section>
  );
}
