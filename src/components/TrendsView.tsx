"use client";

import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { formatDayMonth, lastNDays, parseKey } from "@/lib/dates";
import { TIERS, habitLook } from "@/lib/model";
import { dayStreak, habitStats, insights, tierCounts } from "@/lib/stats";
import { cn } from "@/lib/cn";
import RatingsChart, { type Series } from "./RatingsChart";

const COLORS = { day: "#1a6fd1", health: "#1f9a8a", happy: "#d95f18" };

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
    <div className="rise flex flex-col gap-4">
      <div className="flex items-center justify-between px-1">
        <h1 className="text-2xl font-extrabold text-ink">Health</h1>
        <div className="flex rounded-full bg-sand-100 p-1">
          {([7, 30] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRange(r)}
              className={cn("tap rounded-full px-4 py-1.5 text-sm font-extrabold", range === r ? "bg-white text-ocean-800 shadow-soft" : "text-ink-muted")}
            >
              {r} days
            </button>
          ))}
        </div>
      </div>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Current streak" value={streak.current} unit={streak.current === 1 ? "day" : "days"} />
        <Stat label="Best streak" value={streak.best} unit={streak.best === 1 ? "day" : "days"} />
        <Stat label="30-day habits" value={rate30} unit="%" />
        <Stat label="Days tracked" value={daysTracked} unit={daysTracked === 1 ? "day" : "days"} />
      </section>

      <section className="card p-4 md:p-5">
        <h2 className="text-lg font-extrabold text-ink">Submitted days</h2>
        <p className="mb-3 text-sm font-semibold text-ink-muted">Where the last 30 days landed when you locked them in.</p>
        {submittedTotal === 0 ? (
          <p className="rounded-2xl bg-sand-50 px-4 py-3 text-sm font-semibold text-ink-soft">No days submitted yet. Hit Submit day at the bottom of Today tonight.</p>
        ) : (
          <div className="grid grid-cols-4 gap-2">
            {TIERS.map((t) => (
              <div key={t.id} className="rounded-2xl bg-sand-50 px-1 py-3 text-center">
                <div className="text-2xl leading-none">{t.emoji}</div>
                <div className="mt-1 text-xl font-extrabold leading-none text-ink">{tiers[t.id]}</div>
                <div className="mt-1 text-[10px] font-extrabold uppercase tracking-wider text-ink-muted">{t.label}</div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="card p-4 md:p-5">
        <h2 className="text-lg font-extrabold text-ink">Insights</h2>
        <p className="mb-3 text-sm font-semibold text-ink-muted">Patterns in your own numbers. Only shown once there&apos;s enough evidence.</p>
        {tips.length === 0 ? (
          <p className="rounded-2xl bg-sand-50 px-4 py-3 text-sm font-semibold text-ink-soft">
            Not enough data yet. After about a week of ticking and rating, this starts telling you which habits line up with your best days, your strongest weekday, and what&apos;s slipping.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {tips.map((t, i) => (
              <li key={i} className="flex gap-3 rounded-2xl bg-sand-50 px-4 py-3 text-sm font-semibold text-ink">
                <span className="text-lg leading-none">{t.emoji}</span>
                <span className="leading-snug">{t.text}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card p-4 md:p-5">
        <h2 className="text-lg font-extrabold text-ink">Ratings</h2>
        <p className="mb-2 text-sm font-semibold text-ink-muted">Day, health and happiness, 1–10, last {range} days.</p>
        <RatingsChart dates={dates} series={series} />
      </section>

      <section className="card p-4 md:p-5">
        <h2 className="text-lg font-extrabold text-ink">Each habit, last 30 days</h2>
        <p className="mb-3 text-sm font-semibold text-ink-muted">How often you did it on tracked days, plus the streak.</p>
        {perHabit.length === 0 ? (
          <p className="py-4 text-center text-sm font-semibold text-ink-muted">Add habits in Settings to see them here.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {perHabit.map((h) => {
              const look = habitLook(h.id, settings);
              return (
                <li key={h.id}>
                  <div className="mb-1 flex items-center gap-2">
                    <span className="text-base leading-none">{look.emoji}</span>
                    <span className="min-w-0 flex-1 truncate text-sm font-bold text-ink">{h.name}</span>
                    <span className="text-xs font-extrabold text-ink-muted">
                      {h.tracked ? `${h.pct}%` : "–"}
                    </span>
                    <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-extrabold", h.current >= 2 ? "bg-sunset-100 text-sunset-700" : "bg-sand-100 text-ink-muted")} title="Current streak · best streak">
                      🔥 {h.current} · best {h.best}
                    </span>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-sand-100">
                    <div className="h-full rounded-full transition-all" style={{ width: `${h.pct}%`, backgroundColor: look.color }} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="card p-4 md:p-5">
        <h2 className="text-lg font-extrabold text-ink">Habit heatmap</h2>
        <p className="mb-3 text-sm font-semibold text-ink-muted">Each square is one day. Filled means done. A streak is a full row.</p>
        {heat.rows.length === 0 ? (
          <p className="py-4 text-center text-sm font-semibold text-ink-muted">Add habits in Settings to see them here.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="border-separate border-spacing-y-1">
              <tbody>
                {heat.rows.map((row) => (
                  <tr key={row.id}>
                    <th className="sticky left-0 z-10 max-w-36 truncate bg-white/95 py-0.5 pr-3 text-left text-xs font-bold text-ink-soft md:max-w-52" title={row.name}>
                      <span className="mr-1">{row.look.emoji}</span>
                      {row.name}
                    </th>
                    {row.cells.map((c) => (
                      <td key={c.date} className="p-0.5">
                        <div
                          title={`${formatDayMonth(c.date)} · ${c.done ? "done" : c.tracked ? "missed" : "no entry"}`}
                          className={cn("h-5 w-5 rounded-md md:h-6 md:w-6", !c.done && (c.tracked ? "bg-sand-200" : "bg-sand-100"))}
                          style={c.done ? { backgroundColor: row.look.color } : undefined}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
                <tr>
                  <th className="sticky left-0 bg-white/95" />
                  {heat.days.map((d, i) => (
                    <td key={d} className="p-0.5 text-center text-[10px] font-bold text-ink-muted">
                      {i % (range === 7 ? 2 : 5) === 0 ? parseKey(d).getDate() : ""}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value, unit }: { label: string; value: number; unit: string }) {
  return (
    <div className="card px-3 py-3 text-center md:px-4">
      <div className="text-2xl font-extrabold leading-none text-ink md:text-3xl">
        {value}
        <span className="ml-0.5 text-sm font-bold text-ink-muted">{unit}</span>
      </div>
      <div className="mt-1.5 text-[11px] font-extrabold uppercase tracking-wider text-ink-muted">{label}</div>
    </div>
  );
}
