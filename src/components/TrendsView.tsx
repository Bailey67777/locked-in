"use client";

import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { addDays, formatDayMonth, lastNDays, parseKey } from "@/lib/dates";
import { habitsComplete } from "@/lib/model";
import { cn } from "@/lib/cn";
import RatingsChart, { type Series } from "./RatingsChart";

const COLORS = { day: "#1a6fd1", health: "#1f9a8a", happy: "#d95f18" };

export default function TrendsView() {
  const { today, data, getDay } = useStore();
  const [range, setRange] = useState<7 | 30>(7);

  const dates = useMemo(() => lastNDays(today, range), [today, range]);

  const series: Series[] = useMemo(() => {
    const pick = (k: "day" | "health" | "happy") => dates.map((d) => (data.days[d]?.ratings[k] ? data.days[d].ratings[k] : null));
    return [
      { key: "day", label: "Day", color: COLORS.day, values: pick("day") },
      { key: "health", label: "Health", color: COLORS.health, values: pick("health") },
      { key: "happy", label: "Happiness", color: COLORS.happy, values: pick("happy") },
    ];
  }, [dates, data]);

  const streaks = useMemo(() => {
    // Current streak: consecutive fully-complete days ending today (or yesterday if today isn't finished yet).
    let current = 0;
    let cursor = habitsComplete(getDay(today)) ? today : addDays(today, -1);
    while (data.days[cursor] && habitsComplete(getDay(cursor))) {
      current++;
      cursor = addDays(cursor, -1);
      if (current > 3650) break;
    }
    let best = 0;
    let run = 0;
    let prev: string | null = null;
    for (const key of Object.keys(data.days).sort()) {
      const complete = habitsComplete(getDay(key));
      if (complete && prev && addDays(prev, 1) === key) run++;
      else if (complete) run = 1;
      else run = 0;
      if (complete) prev = key;
      else prev = null;
      best = Math.max(best, run);
    }
    const last30 = lastNDays(today, 30);
    let done = 0;
    let total = 0;
    for (const d of last30) {
      const day = getDay(d);
      if (!data.days[d] && d !== today) continue;
      total += day.habits.length;
      done += day.habits.filter((h) => h.done).length;
    }
    return { current, best: Math.max(best, current), rate: total ? Math.round((done / total) * 100) : 0 };
  }, [data, getDay, today]);

  const heat = useMemo(() => {
    const days = lastNDays(today, range === 7 ? 14 : 30);
    const rows = data.settings.habits.map((h) => ({
      id: h.id,
      name: h.name,
      cells: days.map((d) => {
        const day = data.days[d];
        const hit = day?.habits.find((x) => x.id === h.id);
        return { date: d, done: Boolean(hit?.done), tracked: Boolean(day) };
      }),
    }));
    return { days, rows };
  }, [data, today, range]);

  return (
    <div className="rise flex flex-col gap-4">
      <div className="flex items-center justify-between px-1">
        <h1 className="text-2xl font-extrabold text-ink">Trends</h1>
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

      <section className="grid grid-cols-3 gap-3">
        <Stat label="Current streak" value={streaks.current} unit={streaks.current === 1 ? "day" : "days"} />
        <Stat label="Best streak" value={streaks.best} unit={streaks.best === 1 ? "day" : "days"} />
        <Stat label="30-day habits" value={streaks.rate} unit="%" />
      </section>

      <section className="card p-4 md:p-5">
        <h2 className="text-lg font-extrabold text-ink">Ratings</h2>
        <p className="mb-2 text-sm font-semibold text-ink-muted">Day, health and happiness, 1–10, last {range} days.</p>
        <RatingsChart dates={dates} series={series} />
      </section>

      <section className="card p-4 md:p-5">
        <h2 className="text-lg font-extrabold text-ink">Habit heatmap</h2>
        <p className="mb-3 text-sm font-semibold text-ink-muted">Each square is one day. Filled means done. A streak is a full column.</p>
        {heat.rows.length === 0 ? (
          <p className="py-4 text-center text-sm font-semibold text-ink-muted">Add habits in Settings to see them here.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="border-separate border-spacing-y-1">
              <tbody>
                {heat.rows.map((row) => (
                  <tr key={row.id}>
                    <th className="sticky left-0 z-10 max-w-36 truncate bg-white/95 py-0.5 pr-3 text-left text-xs font-bold text-ink-soft md:max-w-52" title={row.name}>
                      {row.name}
                    </th>
                    {row.cells.map((c) => (
                      <td key={c.date} className="p-0.5">
                        <div
                          title={`${formatDayMonth(c.date)} · ${c.done ? "done" : c.tracked ? "missed" : "no entry"}`}
                          className={cn("h-5 w-5 rounded-md md:h-6 md:w-6", c.done ? "bg-teal-500" : c.tracked ? "bg-sand-200" : "bg-sand-100")}
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
