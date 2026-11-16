"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { average, chartDays, habitRates } from "@/lib/stats";
import { formatShort, lastNDays } from "@/lib/dates";
import { useHub } from "@/lib/hub/store";
import { averageRating, beforeAndNow, photoDays, staresOn } from "@/lib/hub/model";
import { SUBJECT_IDS, SUBJECT_META } from "@/lib/hub/subjects";
import RandomRecording from "./RandomRecording";
import RandomBody from "./RandomBody";
import { ArrowIcon } from "./Icons";
import SubjectMark from "./SubjectMark";

function Big({ label, value, unit = "%", sub }: { label: string; value: number | string | null; unit?: string; sub?: string }) {
  return (
    <div className="rounded-2xl bg-surface px-3.5 py-4">
      <div className="text-[13px] text-muted">{label}</div>
      <div className="mt-2 flex items-baseline gap-0.5">
        <span className="text-[30px] font-bold leading-none tracking-[-0.04em] tabular-nums">{value === null ? "–" : value}</span>
        {value !== null && unit && <span className={unit.length > 1 ? "ml-1 text-[15px] text-muted" : "text-[15px] text-muted"}>{unit}</span>}
      </div>
      {sub !== undefined && <div className="mt-2 font-mono text-[12px] tabular-nums text-muted">{sub}</div>}
    </div>
  );
}

type Rate = { id: string; name: string; pct: number };

function HabitRows({ title, rows }: { title: string; rows: Rate[] }) {
  return (
    <section className="mt-9">
      <div className="text-[13px] text-muted">{title}</div>
      <ul className="mt-2 divide-y divide-line border-y border-line">
        {rows.map((r) => (
          <li key={r.id} className="py-3.5">
            <div className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 truncate text-[16px]">{r.name}</span>
              <span className="shrink-0 text-[14px] tabular-nums text-ink-2">{r.pct}%</span>
            </div>
            <div className="mt-2 h-[3px] w-full overflow-hidden rounded-full bg-track">
              <div className="h-full rounded-full bg-ink" style={{ width: `${r.pct}%` }} />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function StatsView() {
  const { today, data } = useStore();
  const { days, settings } = data;
  const [random, setRandom] = useState(false);
  const [body, setBody] = useState(false);
  const hub = useHub();
  const study = hub.data;
  const talked = lastNDays(today, 30).reduce((n, d) => n + Object.values(study.days[d]?.logs ?? {}).filter((l) => l.text.trim()).length, 0);
  const stares = lastNDays(today, 30).reduce((n, d) => n + staresOn(d, study.stares), 0);
  const photoCount = photoDays(study.photos).length;
  // Claude's day ratings, averaged. The habit percentage stays underneath, small.
  const rated = (n: number) => {
    const r = averageRating(study.ratings, today, n);
    return r === null ? null : r.toFixed(2);
  };
  const pct = (n: number) => {
    const p = average(days, settings, today, n);
    return p === null ? "" : `${p}%`;
  };
  const recordings = Object.values(days).reduce((n, d) => n + Object.keys(d.voice ?? {}).length, 0);
  const bars = chartDays(days, settings, today);
  // Not all fifteen: the three kept best and the three kept worst over the last 30 days.
  const ranked: Rate[] = habitRates(days, settings, today, 30)
    .filter((r) => r.of > 0)
    .map((r) => ({ id: r.id, name: r.name, pct: Math.round((r.done / r.of) * 100) }));
  const best = [...ranked].sort((a, b) => b.pct - a.pct).slice(0, 3);
  const worst = [...ranked]
    .reverse()
    .sort((a, b) => a.pct - b.pct)
    .filter((r) => !best.some((x) => x.id === r.id))
    .slice(0, 3);

  return (
    <div className="fade-up">
      <header className="mb-7">
        <h1 className="text-[36px] font-bold leading-none tracking-[-0.04em]">Statistics</h1>
      </header>

      <div className="grid grid-cols-3 gap-2">
        <Big label="7 days" value={rated(7)} unit="" sub={pct(7)} />
        <Big label="30 days" value={rated(30)} unit="" sub={pct(30)} />
        <Big label="365 days" value={rated(365)} unit="" sub={pct(365)} />
      </div>

      <section className="mt-9">
        <div className="text-[13px] text-muted">Every day</div>
        <div className="mt-3 flex h-28 items-end gap-[3px]" role="img" aria-label="Each day's percentage">
          {bars.map((b) => (
            <div key={b.date} className="flex h-full flex-1 flex-col justify-end" title={`${formatShort(b.date)}${b.pct === null ? "" : `: ${b.pct}%`}`}>
              {b.pct === null || b.future ? (
                <div className="mx-auto h-[3px] w-[3px] rounded-full bg-faint" />
              ) : (
                <div className="w-full rounded-[2px] bg-ink" style={{ height: `${Math.max(3, b.pct)}%`, opacity: b.date === today && !days[today]?.submitted ? 0.4 : 1 }} />
              )}
            </div>
          ))}
        </div>
        <div className="mt-2 flex justify-between font-mono text-[10.5px] text-muted">
          <span>{formatShort(bars[0].date)}</span>
          <span>{formatShort(bars[bars.length - 1].date)}</span>
        </div>
      </section>

      <div className="mt-9 space-y-2">
        <button type="button" onClick={() => setRandom(true)} className="tap flex h-14 w-full items-center justify-between rounded-2xl bg-surface px-5 text-left">
          <span className="text-[16px] font-medium">Random recordings</span>
          <span className="font-mono text-[12px] text-muted">{recordings}</span>
        </button>
        <button type="button" onClick={() => setBody(true)} className="tap flex h-14 w-full items-center justify-between rounded-2xl bg-surface px-5 text-left">
          <span className="text-[16px] font-medium">Random body progress</span>
          <span className="font-mono text-[12px] text-muted">{photoCount}</span>
        </button>
      </div>

      {best.length > 0 && <HabitRows title="Best three, last 30 days" rows={best} />}
      {worst.length > 0 && <HabitRows title="Worst three" rows={worst} />}

      <h2 className="mt-14 text-[28px] font-bold leading-none tracking-[-0.035em]">Academics</h2>

      <ul className="mt-5 divide-y divide-line border-y border-line">
        {SUBJECT_IDS.map((s) => {
          const { before, now: current } = beforeAndNow(s, study.grades, study.settings.shiftDate);
          const target = study.settings.targets[s];
          return (
            <li key={s} className="flex items-center gap-3 py-3.5">
              <SubjectMark subject={s} height={16} />
              <span className="min-w-0 flex-1 truncate text-[16px]">{SUBJECT_META[s].name}</span>
              {target && <span className="shrink-0 font-mono text-[12px] text-muted">target {target}</span>}
              <span className="flex shrink-0 items-center gap-2 text-[16px] font-semibold tabular-nums">
                {before && current && <span className="text-muted">{before.grade}</span>}
                {before && current && <ArrowIcon width={13} height={13} className="text-faint" />}
                {current || before ? <span>{(current ?? before)?.grade}</span> : <span className="font-normal text-faint">–</span>}
              </span>
            </li>
          );
        })}
      </ul>

      <div className="mt-6 grid grid-cols-2 gap-2">
        <Big label="Lessons" value={talked} unit="" />
        <Big label="Stares" value={stares} unit="" />
      </div>

      {random && <RandomRecording onClose={() => setRandom(false)} />}
      {body && <RandomBody onClose={() => setBody(false)} />}
    </div>
  );
}
