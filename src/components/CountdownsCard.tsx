"use client";

import { useEffect, useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { formatDateTime, pad, splitDuration } from "@/lib/dates";

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
    if (data.settings.examDate) list.push({ id: "exam", title: "First A-level exam", at: new Date(`${data.settings.examDate}T09:00`).getTime(), color: "var(--color-sunset-500)", emoji: "🎓", when: formatDateTime(`${data.settings.examDate}T09:00`) });
    // Keep things that finished in the last day, then they drop off. Before the first tick, show everything.
    const cutoff = now ? now - 24 * 3600 * 1000 : 0;
    return list.filter((i) => i.at >= cutoff).sort((a, b) => a.at - b.at);
  }, [data.settings.countdowns, data.settings.examDate, now]);

  if (items.length === 0) return null;

  return (
    <section className="card px-4 py-3">
      <h2 className="label mb-1">Countdowns</h2>
      <ul className="flex flex-col divide-y divide-black/[0.05]">
        {items.map((c) => {
          const past = now > 0 && c.at < now;
          const d = splitDuration(c.at - (now || c.at));
          return (
            <li key={c.id} className="flex items-center gap-3 py-2">
              <span className="h-7 w-[3px] shrink-0 rounded-full" style={{ background: c.color }} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13.5px] font-bold text-ink">
                  <span className="mr-1.5">{c.emoji}</span>
                  {c.title}
                </div>
                <div className="truncate text-[11px] font-semibold text-ink-muted">{c.when}</div>
              </div>
              <div className={`shrink-0 text-right tabular-nums ${past ? "text-ink-muted" : "text-ink"}`}>
                {now ? (
                  <>
                    <span className="text-[17px] font-extrabold tracking-[-0.02em]">{d.days}</span>
                    <span className="mr-1.5 text-[11px] font-bold text-ink-muted">d</span>
                    <span className="font-mono text-[12.5px] font-semibold text-ink-soft">
                      {pad(d.hours)}:{pad(d.minutes)}:{pad(d.seconds)}
                    </span>
                    {past && <div className="text-[10px] font-bold uppercase tracking-wider">ago</div>}
                  </>
                ) : (
                  <span className="text-[13px] text-ink-muted">–</span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
