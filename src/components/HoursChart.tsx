"use client";

import type { Subject } from "@/lib/types";
import { SUBJECTS, SUBJECT_COLOR, SUBJECT_LABEL } from "@/lib/model";
import { addDays, formatWeekLabel, weekStartOf } from "@/lib/dates";

type Props = { hours: Record<string, Partial<Record<Subject, number>>>; today: string };

/** Estimated study hours per week, stacked by subject. Numbers come from Claude, not the app. */
export default function HoursChart({ hours, today }: Props) {
  const thisWeek = weekStartOf(today);
  const weeks: string[] = [];
  const earliest = Object.keys(hours).sort()[0];
  let w = earliest && earliest < thisWeek ? earliest : thisWeek;
  // At most the last 10 weeks, always ending on the current week.
  const all: string[] = [];
  while (w <= thisWeek) {
    all.push(w);
    w = addDays(w, 7);
  }
  weeks.push(...all.slice(-10));
  const totals = weeks.map((wk) => SUBJECTS.reduce((a, s) => a + (hours[wk]?.[s] ?? 0), 0));
  const max = Math.max(1, ...totals);
  const current = totals[weeks.length - 1] ?? 0;
  const any = Object.keys(hours).length > 0;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="whitespace-nowrap text-3xl font-extrabold leading-none text-ink">
            {current % 1 ? current.toFixed(1) : current}
            <span className="ml-1 text-sm font-bold text-ink-muted">h this week</span>
          </div>
          <div className="mt-1 text-[11px] font-extrabold uppercase tracking-wider text-ink-muted">week of {formatWeekLabel(thisWeek)}</div>
        </div>
        <div className="flex flex-wrap justify-end gap-x-3 gap-y-1">
          {SUBJECTS.map((s) => (
            <span key={s} className="flex items-center gap-1 text-[11px] font-bold text-ink-soft">
              <i className="inline-block h-2 w-2 rounded-sm" style={{ background: SUBJECT_COLOR[s] }} />
              {SUBJECT_LABEL[s]}
            </span>
          ))}
        </div>
      </div>
      {!any ? (
        <p className="rounded-2xl bg-sand-50 px-4 py-5 text-center text-sm font-semibold text-ink-muted">No estimates yet. Claude fills this in each night.</p>
      ) : (
        <div className="flex items-end gap-1.5" style={{ height: 160 }}>
          {weeks.map((wk, i) => {
            const total = totals[i];
            return (
              <div key={wk} className="flex h-full min-w-0 flex-1 flex-col justify-end" title={`${formatWeekLabel(wk)}: ${total}h`}>
                <div className="mb-1 text-center text-[10px] font-extrabold tabular-nums text-ink-muted">{total ? (total % 1 ? total.toFixed(1) : total) : ""}</div>
                <div className="flex w-full flex-col-reverse overflow-hidden rounded-md" style={{ height: `${(total / max) * 120}px` }}>
                  {SUBJECTS.map((s) => {
                    const v = hours[wk]?.[s] ?? 0;
                    if (!v) return null;
                    return <div key={s} style={{ height: `${(v / total) * 100}%`, background: SUBJECT_COLOR[s], borderTop: "2px solid #fbf7f0" }} />;
                  })}
                </div>
                <div className={`mt-1 truncate text-center text-[10px] font-bold ${wk === thisWeek ? "text-ink" : "text-ink-muted"}`}>{formatWeekLabel(wk)}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
