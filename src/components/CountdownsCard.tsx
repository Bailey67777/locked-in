"use client";

import { useEffect, useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { formatDateTime, splitDuration } from "@/lib/dates";

type Item = { id: string; title: string; at: number; color: string; emoji: string; when: string };

/** Live countdowns on Today: the first A-level exam (from Settings) plus anything you add in Settings → Countdowns. */
export default function CountdownsCard() {
  const { data } = useStore();
  const [now, setNow] = useState(0);

  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = window.setTimeout(tick, 0);
    const id = window.setInterval(tick, 1000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(id);
    };
  }, []);

  const items = useMemo<Item[]>(() => {
    const list: Item[] = data.settings.countdowns.map((c) => ({ id: c.id, title: c.title, at: new Date(c.at).getTime(), color: c.color, emoji: c.emoji ?? "⏳", when: formatDateTime(c.at) }));
    if (data.settings.examDate) list.push({ id: "exam", title: "First A-level exam", at: new Date(`${data.settings.examDate}T09:00`).getTime(), color: "#d95f18", emoji: "🎓", when: formatDateTime(`${data.settings.examDate}T09:00`) });
    // Keep things that finished in the last day, then they drop off. Before the first tick, show everything.
    const cutoff = now ? now - 24 * 3600 * 1000 : 0;
    return list.filter((i) => i.at >= cutoff).sort((a, b) => a.at - b.at);
  }, [data.settings.countdowns, data.settings.examDate, now]);

  if (items.length === 0) {
    return (
      <section className="card p-4 md:p-5">
        <h2 className="text-lg font-extrabold text-ink">⏳ Countdowns</h2>
        <p className="mt-1 text-sm font-semibold text-ink-muted">Nothing being counted down to. Add a test, a match or a trip in Settings → Countdowns, and your first exam date there too.</p>
      </section>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {items.map((c) => {
        const past = now > 0 && c.at < now;
        const d = splitDuration(c.at - (now || c.at));
        return (
          <section key={c.id} className="card overflow-hidden" style={{ borderLeft: `8px solid ${c.color}` }}>
            <div className="p-4" style={{ backgroundColor: `${c.color}12` }}>
              <div className="flex items-start gap-3">
                <span className="text-2xl leading-none">{c.emoji}</span>
                <div className="min-w-0 flex-1">
                  <h2 className="text-lg font-extrabold leading-tight text-ink">{c.title}</h2>
                  <div className="text-xs font-bold text-ink-muted">{c.when}</div>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-4 gap-2">
                {(
                  [
                    [d.days, "days"],
                    [d.hours, "hours"],
                    [d.minutes, "mins"],
                    [d.seconds, "secs"],
                  ] as const
                ).map(([v, label]) => (
                  <div key={label} className="rounded-2xl bg-white/85 px-1 py-2 text-center shadow-soft">
                    <div className={`text-2xl font-extrabold leading-none tabular-nums md:text-3xl ${past ? "text-ink-muted" : "text-ink"}`}>{now ? v : "–"}</div>
                    <div className="mt-1 text-[10px] font-extrabold uppercase tracking-wider text-ink-muted">{label}</div>
                  </div>
                ))}
              </div>
              {past && <div className="mt-2 text-center text-xs font-extrabold uppercase tracking-wider text-ink-muted">that long ago</div>}
            </div>
          </section>
        );
      })}
    </div>
  );
}
