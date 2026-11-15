"use client";

import { useState } from "react";
import { useHub } from "@/lib/hub/store";
import { uid } from "@/lib/hub/model";
import { atTime, clock, mins as formatMins } from "@/lib/hub/time";
import { keyFromDate } from "@/lib/dates";
import { SUBJECT_IDS, SUBJECT_META } from "@/lib/hub/subjects";
import type { SubjectId } from "@/lib/hub/types";
import { cn } from "@/lib/cn";
import Sheet from "./Sheet";

/** Add study time by hand, or fix/delete a block. */
export default function SessionSheet({ id, defaultSubject, onClose }: { id: string | null; defaultSubject: SubjectId; onClose: () => void }) {
  const { data, today, now: nowMs, write } = useHub();
  const existing = id ? data.sessions[id] : undefined;
  const [subject, setSubject] = useState<SubjectId>(existing?.subject ?? defaultSubject);
  const [date, setDate] = useState(existing ? keyFromDate(new Date(existing.start)) : today);
  const [from, setFrom] = useState(existing ? clock(existing.start) : clock(nowMs - 60 * 60000));
  const [to, setTo] = useState(existing ? clock(existing.end) : clock(nowMs));

  let start = atTime(date, from);
  let end = atTime(date, to);
  if (end <= start) end += 86400000; // past midnight
  if (!from || !to) start = end = 0;
  const length = (end - start) / 60000;
  const valid = length >= 1 && length <= 16 * 60;

  const save = () => {
    if (!valid) return;
    write(`sessions/${id ?? uid()}`, { subject, start, end });
    onClose();
  };

  return (
    <Sheet
      label={existing ? "Study block" : "Add time"}
      accent={SUBJECT_META[subject].color}
      onClose={onClose}
      footer={
        <div className="flex gap-2">
          {existing && (
            <button
              type="button"
              className="btn-quiet h-12 px-5"
              onClick={() => {
                write(`sessions/${id}`, null);
                onClose();
              }}
            >
              Delete
            </button>
          )}
          <button type="button" className="btn flex-1" disabled={!valid} onClick={save}>
            {existing ? "Save" : `Add ${valid ? formatMins(length) : ""}`}
          </button>
        </div>
      }
    >
      <div className="mt-2 grid grid-cols-3 gap-1 rounded-2xl bg-surface p-1">
        {SUBJECT_IDS.map((s) => (
          <button key={s} type="button" aria-pressed={subject === s} onClick={() => setSubject(s)} className={cn("h-10 rounded-xl text-[14px] transition-colors", subject === s ? "bg-ink text-bg" : "text-ink-2")}>
            {SUBJECT_META[s].name}
          </button>
        ))}
      </div>

      <div className="mt-3 divide-y divide-line rounded-2xl bg-surface px-4">
        <label className="flex h-14 items-center justify-between gap-3">
          <span className="text-[15px]">Day</span>
          <input type="date" value={date} max={today} onChange={(e) => e.target.value && setDate(e.target.value)} className="bg-transparent text-right font-mono text-[15px] tabular-nums text-ink focus:outline-none" />
        </label>
        <label className="flex h-14 items-center justify-between gap-3">
          <span className="text-[15px]">From</span>
          <input type="time" value={from} onChange={(e) => setFrom(e.target.value)} className="bg-transparent text-right font-mono text-[15px] tabular-nums text-ink focus:outline-none" />
        </label>
        <label className="flex h-14 items-center justify-between gap-3">
          <span className="text-[15px]">To</span>
          <input type="time" value={to} onChange={(e) => setTo(e.target.value)} className="bg-transparent text-right font-mono text-[15px] tabular-nums text-ink focus:outline-none" />
        </label>
      </div>
    </Sheet>
  );
}
