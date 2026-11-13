"use client";

import { useStore } from "@/lib/store";
import { STREAK_PCT, average, habitRates, lastDays, streak } from "@/lib/stats";
import { formatShort } from "@/lib/dates";

function Big({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="rounded-2xl bg-surface px-4 py-4">
      <div className="label">{label}</div>
      <div className="mt-2 flex items-baseline gap-1">
        <span className="text-[34px] font-semibold leading-none tracking-[-0.04em] tabular-nums">{value}</span>
        {unit && <span className="text-[13px] text-muted">{unit}</span>}
      </div>
    </div>
  );
}

export default function StatsView() {
  const { today, data } = useStore();
  const { days, settings } = data;
  const s = streak(days, settings, today);
  const w = average(days, settings, today, 7);
  const m = average(days, settings, today, 30);
  const bars = lastDays(days, settings, today, 30);
  const rates = habitRates(days, settings, today, 30);

  return (
    <div className="fade-up">
      <header className="mb-7">
        <div className="label">Stats</div>
        <h1 className="mt-2 text-[34px] font-semibold leading-none tracking-[-0.035em]">How it&apos;s going</h1>
      </header>

      <div className="grid grid-cols-2 gap-2">
        <Big label="Streak" value={String(s.current)} unit={s.current === 1 ? "day" : "days"} />
        <Big label="Best" value={String(s.best)} unit={s.best === 1 ? "day" : "days"} />
        <Big label="7 days" value={w.pct === null ? "–" : String(w.pct)} unit={w.pct === null ? undefined : "%"} />
        <Big label="30 days" value={m.pct === null ? "–" : String(m.pct)} unit={m.pct === null ? undefined : "%"} />
      </div>
      <p className="mt-2 px-1 text-[12px] text-muted">A streak counts days in a row at {STREAK_PCT}% or more. Averages only count days you used the app.</p>

      <section className="mt-9">
        <div className="label">Last 30 days</div>
        <div className="mt-3 flex h-28 items-end gap-[3px]" role="img" aria-label="Daily percentage over the last 30 days">
          {bars.map((b) => (
            <div key={b.date} className="flex h-full flex-1 flex-col justify-end" title={`${formatShort(b.date)}: ${b.pct === null ? "nothing recorded" : `${b.pct}%`}`}>
              {b.pct === null ? <div className="mx-auto h-[3px] w-[3px] rounded-full bg-faint" /> : <div className="w-full rounded-[2px] bg-ink" style={{ height: `${Math.max(3, b.pct)}%`, opacity: b.date === today ? 0.45 : 1 }} />}
            </div>
          ))}
        </div>
        <div className="mt-2 flex justify-between font-mono text-[10.5px] text-muted">
          <span>{formatShort(bars[0].date)}</span>
          <span>Today</span>
        </div>
      </section>

      <section className="mt-9">
        <div className="label">Each habit · 30 days</div>
        <ul className="mt-3 divide-y divide-line border-y border-line">
          {rates.map((r) => {
            const pct = r.of ? Math.round((r.done / r.of) * 100) : null;
            return (
              <li key={r.id} className="py-3.5">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0 truncate text-[15px]">{r.name}</span>
                  <span className="shrink-0 font-mono text-[12px] tabular-nums text-muted">{pct === null ? "–" : `${r.done}/${r.of} · ${pct}%`}</span>
                </div>
                <div className="mt-2 h-[3px] w-full overflow-hidden rounded-full bg-track">
                  <div className="h-full rounded-full bg-ink" style={{ width: `${pct ?? 0}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
