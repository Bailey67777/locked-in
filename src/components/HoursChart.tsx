"use client";

import { useMemo, useState } from "react";
import type { DayRecord, Subject } from "@/lib/types";
import { SUBJECTS, SUBJECT_COLOR, SUBJECT_LABEL } from "@/lib/model";
import { addDays, formatWeekLabel, weekStartOf } from "@/lib/dates";
import { cn } from "@/lib/cn";

type Props = { hours: Record<string, Partial<Record<Subject, number>>>; days: Record<string, DayRecord>; today: string };

const BAR_MAX = 120;
const fmt = (h: number) => (h % 1 ? h.toFixed(1) : String(h));

/** Study hours per week, stacked by subject. From your study log; weeks with no log fall back to Claude's estimate. */
export default function HoursChart({ hours, days, today }: Props) {
  const thisWeek = weekStartOf(today);
  const [picked, setPicked] = useState<string | null>(null);

  const rows = useMemo(() => {
    const logged: Record<string, Partial<Record<Subject, number>>> = {};
    for (const d of Object.values(days)) {
      if (!d.studyLog || d.date > today) continue;
      const wk = weekStartOf(d.date);
      for (const s of SUBJECTS) {
        const mins = d.studyLog[s]?.mins ?? 0;
        if (mins) logged[wk] = { ...logged[wk], [s]: (logged[wk]?.[s] ?? 0) + mins / 60 };
      }
    }
    const earliest = [...Object.keys(logged), ...Object.keys(hours)].sort()[0];
    const all: string[] = [];
    for (let w = earliest && earliest < thisWeek ? earliest : thisWeek; w <= thisWeek; w = addDays(w, 7)) all.push(w);
    return all.slice(-8).map((wk) => {
      const fromLog = Boolean(logged[wk]);
      const src = logged[wk] ?? hours[wk] ?? {};
      const parts = SUBJECTS.map((s) => ({ s, h: Math.round((src[s] ?? 0) * 10) / 10 })).filter((p) => p.h > 0);
      return { wk, fromLog, parts, total: Math.round(parts.reduce((a, p) => a + p.h, 0) * 10) / 10 };
    });
  }, [days, hours, today, thisWeek]);

  const max = Math.max(1, ...rows.map((r) => r.total));
  const current = rows[rows.length - 1];
  const shown = rows.find((r) => r.wk === picked) ?? current;
  const any = rows.some((r) => r.total > 0);

  return (
    <div>
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="text-[30px] font-extrabold leading-none tracking-[-0.03em] text-ink tabular-nums">
            {fmt(shown?.total ?? 0)}
            <span className="ml-1 text-[13px] font-semibold tracking-normal text-ink-muted">hours</span>
          </div>
          <div className="mt-1 text-[11.5px] font-semibold text-ink-muted">
            {shown?.wk === thisWeek ? "this week" : `week of ${formatWeekLabel(shown?.wk ?? thisWeek)}`}
            {shown && shown.total > 0 && !shown.fromLog ? " · Claude's estimate" : ""}
          </div>
        </div>
      </div>

      {!any ? (
        <p className="mt-3 rounded-xl bg-sand-50 px-3 py-4 text-center text-[12.5px] font-semibold text-ink-muted">Log study time on Today and your weeks build up here.</p>
      ) : (
        <>
          <div className="mt-4 flex items-end justify-between gap-1" style={{ height: BAR_MAX + 22 }}>
            {rows.map((r) => {
              const active = (picked ?? thisWeek) === r.wk;
              return (
                <button
                  key={r.wk}
                  type="button"
                  onClick={() => setPicked(r.wk === picked ? null : r.wk)}
                  className="group flex h-full min-w-0 flex-1 flex-col items-center justify-end"
                  aria-label={`Week of ${formatWeekLabel(r.wk)}: ${fmt(r.total)} hours`}
                >
                  <div className={cn("flex w-full max-w-6 flex-col-reverse gap-[2px] transition-opacity", !active && "opacity-60 group-hover:opacity-100")} style={{ height: (r.total / max) * BAR_MAX }}>
                    {r.parts.map((p, i) => (
                      <div
                        key={p.s}
                        className={cn("min-h-[2px]", i === r.parts.length - 1 && "rounded-t-[4px]")}
                        style={{ flexGrow: p.h, background: SUBJECT_COLOR[p.s] }}
                      />
                    ))}
                  </div>
                  <div className={cn("mt-1.5 truncate text-[10px] font-semibold tabular-nums", active ? "text-ink" : "text-ink-muted")}>{formatWeekLabel(r.wk)}</div>
                </button>
              );
            })}
          </div>
          <div className="mt-3 h-px bg-sand-200" />
          <ul className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-1.5">
            {SUBJECTS.map((s) => {
              const h = shown?.parts.find((p) => p.s === s)?.h ?? 0;
              return (
                <li key={s} className="flex items-center gap-1.5 text-[12px] font-semibold text-ink-soft">
                  <i className="h-2 w-2 shrink-0 rounded-sm" style={{ background: SUBJECT_COLOR[s] }} />
                  <span className="truncate">{SUBJECT_LABEL[s]}</span>
                  <span className="ml-auto font-bold tabular-nums text-ink">{h ? `${fmt(h)}h` : "–"}</span>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
