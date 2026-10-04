"use client";

import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { formatDayMonth, lastNDays, parseKey } from "@/lib/dates";
import { TIERS, habitLook } from "@/lib/model";
import { dayStreak, habitStats, insights, tierCounts } from "@/lib/stats";
import { cn } from "@/lib/cn";
import RatingsChart, { type Series } from "./RatingsChart";

// Fixed (not seasonal) and validated as a set, so Day / Health / Happiness keep their colours all year.
const COLORS = { day: "#2a78d6", health: "#1baf7a", happy: "#eb6834" };
// Submitted-day bands are ordered, so one hue from light to dark: the season's accent.
const TIER_SHADE: Record<string, string> = { t80: "var(--color-ocean-700)", t50: "var(--color-ocean-500)", t25: "var(--color-ocean-300)", t0: "var(--color-sand-300)" };

export default function TrendsView() {
  const { today, data } = useStore();
  const [range, setRange] = useState<7 | 30>(7);
  const settings = data.settings;

  const dates = useMemo(() => lastNDays(today, range), [today, range]);

  const series: Series[] = useMemo(() => {
    const pick = (k: "day" | "health" | "happy") => dates.map((d) => (data.days[d]?.ratings[k] ? data.days[d].ratings[k] : null));
    return [
      { key: "day", label: "Day", color: COLORS.day, values: pick("day") },
      { key: "health", label: "Health", color: COLORS.health, values: pick("health") },
      { key: "happy", label: "Happiness", color: COLORS.happy, values: pick("happy") },
    ];
  }, [dates, data]);

  const streak = useMemo(() => dayStreak(data.days, settings, today), [data.days, settings, today]);
  const perHabit = useMemo(() => habitStats(data.days, settings, today, 30), [data.days, settings, today]);
  const tips = useMemo(() => insights(data.days, settings, today), [data.days, settings, today]);
  const tiers = useMemo(() => tierCounts(data.days, today, 30), [data.days, today]);
  const submittedTotal = tiers.t80 + tiers.t50 + tiers.t25 + tiers.t0;
  const daysTracked = useMemo(() => Object.keys(data.days).filter((k) => k <= today).length, [data.days, today]);

  const rate30 = useMemo(() => {
    const done = perHabit.reduce((a, h) => a + h.done, 0);
    const tracked = perHabit.reduce((a, h) => a + h.tracked, 0);
    return tracked ? Math.round((done / tracked) * 100) : 0;
  }, [perHabit]);

  const heat = useMemo(() => {
    const days = lastNDays(today, range === 7 ? 14 : 30);
    const rows = settings.habits.map((h) => ({
      id: h.id,
      name: h.name,
      look: habitLook(h.id, settings),
      cells: days.map((d) => {
        const day = data.days[d];
        const hit = day?.habits.find((x) => x.id === h.id);
        return { date: d, done: Boolean(hit?.done), tracked: Boolean(day) };
      }),
    }));
    return { days, rows };
  }, [data, settings, today, range]);

  return (
    <div className="rise flex flex-col gap-3">
      <div className="flex items-end justify-between px-1 pb-1">
        <h1 className="font-serif text-[28px] leading-none text-ink">Health</h1>
        <div className="flex rounded-full border border-black/[0.06] bg-white/70 p-0.5">
          {([7, 30] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRange(r)}
              className={cn("tap rounded-full px-3 py-1 text-[12px] font-bold", range === r ? "bg-ink text-white" : "text-ink-muted")}
            >
              {r}d
            </button>
          ))}
        </div>
      </div>

      <section className="card grid grid-cols-2 divide-black/[0.05] sm:grid-cols-4 sm:divide-x">
        <Stat label="Current streak" value={streak.current} unit={streak.current === 1 ? "day" : "days"} />
        <Stat label="Best streak" value={streak.best} unit={streak.best === 1 ? "day" : "days"} />
        <Stat label="Habits, 30 days" value={rate30} unit="%" />
        <Stat label="Days tracked" value={daysTracked} unit="" />
      </section>

      <section className="card p-4">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="card-title">Ratings</h2>
          <span className="card-sub">1–10 · last {range} days</span>
        </div>
        <div className="mt-3">
          <RatingsChart dates={dates} series={series} />
        </div>
      </section>

      <section className="card p-4">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="card-title">Submitted days</h2>
          <span className="card-sub">last 30 days</span>
        </div>
        {submittedTotal === 0 ? (
          <p className="mt-2 text-[12.5px] font-semibold text-ink-muted">Nothing submitted yet. Submit tonight from the bottom of Today.</p>
        ) : (
          <>
            <div className="mt-3 flex h-2.5 w-full gap-[2px] overflow-hidden rounded-full">
              {TIERS.map((t) =>
                tiers[t.id] ? <div key={t.id} title={`${t.label}: ${tiers[t.id]}`} style={{ flexGrow: tiers[t.id], background: TIER_SHADE[t.id] }} /> : null,
              )}
            </div>
            <div className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-4">
              {TIERS.map((t) => (
                <div key={t.id} className="flex items-center gap-1.5 text-[12px] font-semibold text-ink-soft">
                  <i className="h-2 w-2 shrink-0 rounded-sm" style={{ background: TIER_SHADE[t.id] }} />
                  <span className="truncate">{t.label}</span>
                  <span className="ml-auto font-bold tabular-nums text-ink sm:ml-1">{tiers[t.id]}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      <section className="card p-4">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="card-title">Each habit</h2>
          <span className="card-sub">done on tracked days · 30 days</span>
        </div>
        {perHabit.length === 0 ? (
          <p className="mt-2 text-[12.5px] font-semibold text-ink-muted">Add habits in Settings to see them here.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2.5">
            {perHabit.map((h) => {
              const look = habitLook(h.id, settings);
              return (
                <li key={h.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1">
                  <span className="flex min-w-0 items-center gap-1.5 text-[12.5px] font-semibold text-ink">
                    <span className="text-[12px]">{look.emoji}</span>
                    <span className="truncate">{h.name}</span>
                  </span>
                  <span className="flex items-center gap-2 text-[11.5px] tabular-nums">
                    {h.current >= 2 && <span className="font-semibold text-ink-muted" title="Current streak">🔥{h.current}</span>}
                    <span className="w-8 text-right font-bold text-ink">{h.tracked ? `${h.pct}%` : "–"}</span>
                  </span>
                  <div className="col-span-2 h-1.5 w-full overflow-hidden rounded-full bg-sand-100">
                    <div className="h-full rounded-full transition-all" style={{ width: `${h.pct}%`, backgroundColor: look.color }} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="card p-4">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="card-title">Habit heatmap</h2>
          <span className="card-sub">last {heat.days.length} days</span>
        </div>
        {heat.rows.length === 0 ? (
          <p className="mt-2 text-[12.5px] font-semibold text-ink-muted">Add habits in Settings to see them here.</p>
        ) : (
          <>
            <div className="mt-3 overflow-x-auto">
              <table className="border-separate border-spacing-[2px]">
                <tbody>
                  {heat.rows.map((row) => (
                    <tr key={row.id}>
                      <th className="sticky left-0 z-10 max-w-32 truncate bg-white pr-2 text-left text-[11.5px] font-semibold text-ink-soft md:max-w-48" title={row.name}>
                        {row.name}
                      </th>
                      {row.cells.map((c) => (
                        <td key={c.date} className="p-0">
                          <div
                            title={`${row.name} · ${formatDayMonth(c.date)} · ${c.done ? "done" : c.tracked ? "missed" : "no entry"}`}
                            className={cn("h-4 w-4 rounded-[4px] md:h-[18px] md:w-[18px]", c.done ? "bg-ocean-500" : c.tracked ? "bg-sand-200" : "bg-sand-100")}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                  <tr>
                    <th className="sticky left-0 bg-white" />
                    {heat.days.map((d, i) => (
                      <td key={d} className="pt-1 text-center text-[9.5px] font-semibold text-ink-muted">
                        {i % (range === 7 ? 2 : 5) === 0 ? parseKey(d).getDate() : ""}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="mt-2 flex gap-3 text-[11px] font-semibold text-ink-muted">
              <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-[3px] bg-ocean-500" /> done</span>
              <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-[3px] bg-sand-200" /> missed</span>
              <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-[3px] bg-sand-100" /> no entry</span>
            </div>
          </>
        )}
      </section>

      <section className="card p-4">
        <h2 className="card-title">Insights</h2>
        {tips.length === 0 ? (
          <p className="mt-1 text-[12.5px] font-semibold text-ink-muted">After about a week of ticking and rating, this shows which habits line up with your best days, your strongest weekday, and what&apos;s slipping.</p>
        ) : (
          <ul className="mt-2 flex flex-col divide-y divide-black/[0.05]">
            {tips.map((t, i) => (
              <li key={i} className="flex gap-2.5 py-2 text-[13px] font-semibold leading-snug text-ink-soft">
                <span className="text-[14px] leading-tight">{t.emoji}</span>
                <span>{t.text}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value, unit }: { label: string; value: number; unit: string }) {
  return (
    <div className="px-4 py-3">
      <div className="text-[11.5px] font-semibold text-ink-muted">{label}</div>
      <div className="mt-0.5 text-[24px] font-extrabold leading-none tracking-[-0.02em] text-ink">
        {value}
        {unit && <span className="ml-1 text-[12px] font-semibold tracking-normal text-ink-muted">{unit}</span>}
      </div>
    </div>
  );
}
