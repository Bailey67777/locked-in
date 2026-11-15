"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { average, chartDays, habitRates } from "@/lib/stats";
import { formatDayMonth, formatShort, lastNDays } from "@/lib/dates";
import { useHub } from "@/lib/hub/store";
import { allMinutes, dailyMinutes, photoDays, staresOn, studyStreak, total } from "@/lib/hub/model";
import { hours, mins } from "@/lib/hub/time";
import { SUBJECT_IDS, SUBJECT_META } from "@/lib/hub/subjects";
import RandomRecording from "./RandomRecording";
import RandomBody from "./RandomBody";
import SubjectMark from "./SubjectMark";

function Big({ label, value, unit = "%" }: { label: string; value: number | string | null; unit?: string }) {
  return (
    <div className="rounded-2xl bg-surface px-3.5 py-4">
      <div className="text-[13px] text-muted">{label}</div>
      <div className="mt-2 flex items-baseline gap-0.5">
        <span className="text-[30px] font-bold leading-none tracking-[-0.04em] tabular-nums">{value === null ? "–" : value}</span>
        {value !== null && unit && <span className={unit.length > 1 ? "ml-1 text-[15px] text-muted" : "text-[15px] text-muted"}>{unit}</span>}
      </div>
    </div>
  );
}

/** Weight over time as a single line. */
function WeightChart({ points }: { points: { date: string; kg: number }[] }) {
  const W = 320;
  const H = 96;
  const min = Math.min(...points.map((p) => p.kg));
  const max = Math.max(...points.map((p) => p.kg));
  const pad = Math.max(0.5, (max - min) * 0.15);
  const lo = min - pad;
  const hi = max + pad;
  const t0 = new Date(points[0].date).getTime();
  const t1 = new Date(points[points.length - 1].date).getTime();
  const x = (d: string) => ((new Date(d).getTime() - t0) / Math.max(1, t1 - t0)) * (W - 8) + 4;
  const y = (kg: number) => H - 4 - ((kg - lo) / (hi - lo)) * (H - 8);
  const path = points.map((p, i) => `${i ? "L" : "M"}${x(p.date).toFixed(1)},${y(p.kg).toFixed(1)}`).join(" ");
  const last = points[points.length - 1];
  const change = Math.round((last.kg - points[0].kg) * 10) / 10;
  return (
    <section className="mt-9">
      <div className="flex items-baseline justify-between">
        <span className="text-[13px] text-muted">Weight</span>
        <span className="font-mono text-[12px] tabular-nums text-muted">
          {last.kg} kg · {change > 0 ? "+" : ""}
          {change} since {formatDayMonth(points[0].date)}
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 h-24 w-full" preserveAspectRatio="none" role="img" aria-label="Weight over time">
        <path d={path} fill="none" stroke="var(--ink)" strokeWidth={1.75} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      </svg>
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
  const month = dailyMinutes(today, 30, study.sessions, study.timer, hub.now);
  const sumOver = (n: number) => month.slice(-n).reduce((t, d) => t + total(d.mins), 0);
  const monthBySubject = SUBJECT_IDS.map((s) => ({ s, mins: month.reduce((t, d) => t + d.mins[s], 0) }));
  const monthMax = Math.max(60, ...month.map((d) => total(d.mins)));
  const subjectMax = Math.max(1, ...monthBySubject.map((x) => x.mins));
  const ever = total(allMinutes(study.sessions, study.timer, hub.now));
  const streak = studyStreak(today, study.sessions, study.timer, hub.now);
  const talked = lastNDays(today, 30).reduce((n, d) => n + Object.values(study.days[d]?.logs ?? {}).filter((l) => l.text.trim()).length, 0);
  const stares = lastNDays(today, 30).reduce((n, d) => n + staresOn(d, study.stares), 0);
  const photoCount = photoDays(study.photos).length;
  const weights = Object.entries(study.weights)
    .map(([date, kg]) => ({ date, kg }))
    .sort((a, b) => a.date.localeCompare(b.date));
  const recordings = Object.values(days).reduce((n, d) => n + Object.keys(d.voice ?? {}).length, 0);
  const bars = chartDays(days, settings, today);
  const rates = habitRates(days, settings, today, 30);

  return (
    <div className="fade-up">
      <header className="mb-7">
        <h1 className="text-[36px] font-bold leading-none tracking-[-0.04em]">Statistics</h1>
      </header>

      <div className="grid grid-cols-3 gap-2">
        <Big label="7 days" value={average(days, settings, today, 7)} />
        <Big label="30 days" value={average(days, settings, today, 30)} />
        <Big label="365 days" value={average(days, settings, today, 365)} />
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

      <section className="mt-9">
        <div className="text-[13px] text-muted">Habits, last 30 days</div>
        <ul className="mt-2 divide-y divide-line border-y border-line">
          {rates.map((r) => {
            const pct = r.of ? Math.round((r.done / r.of) * 100) : null;
            return (
              <li key={r.id} className="py-3.5">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0 truncate text-[16px]">{r.name}</span>
                  <span className="shrink-0 text-[14px] tabular-nums text-ink-2">{pct === null ? "–" : `${pct}%`}</span>
                </div>
                <div className="mt-2 h-[3px] w-full overflow-hidden rounded-full bg-track">
                  <div className="h-full rounded-full bg-ink" style={{ width: `${pct ?? 0}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <h2 className="mt-14 text-[28px] font-bold leading-none tracking-[-0.035em]">Study</h2>

      <div className="mt-5 grid grid-cols-3 gap-2">
        <Big label="7 days" value={hours(sumOver(7))} unit="h" />
        <Big label="30 days" value={hours(sumOver(30))} unit="h" />
        <Big label="All time" value={hours(ever)} unit="h" />
      </div>

      <section className="mt-9">
        <div className="text-[13px] text-muted">Every day</div>
        <div className="mt-3 flex h-28 items-end gap-[3px]" role="img" aria-label="Time studied each day">
          {month.map((d) => {
            const t = total(d.mins);
            return (
              <div key={d.date} className="flex h-full flex-1 flex-col justify-end" title={`${formatShort(d.date)}: ${mins(t)}`}>
                {t >= 1 ? (
                  <div className="flex w-full flex-col-reverse overflow-hidden rounded-[2px]" style={{ height: `${Math.max(3, (t / monthMax) * 100)}%` }}>
                    {SUBJECT_IDS.map((s) => (d.mins[s] > 0 ? <div key={s} style={{ flexGrow: d.mins[s], background: SUBJECT_META[s].color }} /> : null))}
                  </div>
                ) : (
                  <div className="mx-auto h-[3px] w-[3px] rounded-full bg-faint" />
                )}
              </div>
            );
          })}
        </div>
        <div className="mt-2 flex justify-between font-mono text-[10.5px] text-muted">
          <span>{formatShort(month[0].date)}</span>
          <span>{formatShort(month[month.length - 1].date)}</span>
        </div>
      </section>

      <section className="mt-9">
        <div className="text-[13px] text-muted">Subjects, last 30 days</div>
        <ul className="mt-2 divide-y divide-line border-y border-line">
          {monthBySubject.map(({ s, mins: m }) => (
            <li key={s} className="py-3.5">
              <div className="flex items-center gap-3">
                <SubjectMark subject={s} height={16} />
                <span className="min-w-0 flex-1 truncate text-[16px]">{SUBJECT_META[s].name}</span>
                <span className="shrink-0 text-[14px] tabular-nums text-ink-2">{mins(m)}</span>
              </div>
              <div className="mt-2 h-[3px] w-full overflow-hidden rounded-full bg-track">
                <div className="h-full rounded-full" style={{ width: `${(m / subjectMax) * 100}%`, background: SUBJECT_META[s].color }} />
              </div>
            </li>
          ))}
        </ul>
      </section>

      <div className="mt-6 grid grid-cols-3 gap-2">
        <Big label="Streak" value={streak} unit={streak === 1 ? "day" : "days"} />
        <Big label="Lessons" value={talked} unit="" />
        <Big label="Stares" value={stares} unit="" />
      </div>

      {weights.length >= 2 && <WeightChart points={weights} />}

      {random && <RandomRecording onClose={() => setRandom(false)} />}
      {body && <RandomBody onClose={() => setBody(false)} />}
    </div>
  );
}
