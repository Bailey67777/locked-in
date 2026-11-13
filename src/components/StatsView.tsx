"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { average, chartDays, habitRates } from "@/lib/stats";
import { formatShort } from "@/lib/dates";
import RandomRecording from "./RandomRecording";

function Big({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="rounded-2xl bg-surface px-4 py-4">
      <div className="text-[13px] text-muted">{label}</div>
      <div className="mt-2 flex items-baseline gap-0.5">
        <span className="text-[36px] font-bold leading-none tracking-[-0.04em] tabular-nums">{value === null ? "–" : value}</span>
        {value !== null && <span className="text-[15px] text-muted">%</span>}
      </div>
    </div>
  );
}

export default function StatsView() {
  const { today, data } = useStore();
  const { days, settings } = data;
  const [random, setRandom] = useState(false);
  const recordings = Object.values(days).reduce((n, d) => n + Object.keys(d.voice ?? {}).length, 0);
  const bars = chartDays(days, settings, today);
  const rates = habitRates(days, settings, today, 30);

  return (
    <div className="fade-up">
      <header className="mb-7">
        <h1 className="text-[36px] font-bold leading-none tracking-[-0.04em]">Statistics</h1>
      </header>

      <div className="grid grid-cols-2 gap-2">
        <Big label="Last 7 days" value={average(days, settings, today, 7)} />
        <Big label="Last 30 days" value={average(days, settings, today, 30)} />
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

      <button type="button" onClick={() => setRandom(true)} className="tap mt-6 flex h-14 w-full items-center justify-between rounded-2xl bg-surface px-5 text-left">
        <span className="text-[16px] font-medium">Random recordings</span>
        <span className="font-mono text-[12px] text-muted">{recordings}</span>
      </button>

      {random && <RandomRecording onClose={() => setRandom(false)} />}
    </div>
  );
}
