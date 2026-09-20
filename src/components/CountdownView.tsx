"use client";

import { useEffect, useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import type { Countdown } from "@/lib/types";
import { addDays, formatDateTime, splitDuration } from "@/lib/dates";
import { uid } from "@/lib/model";
import { HABIT_COLORS } from "@/lib/defaults";
import { cn } from "@/lib/cn";
import { PlusIcon, TrashIcon } from "./Icons";

const QUICK_EMOJI = ["🎓", "📝", "🏀", "✈️", "🎂", "🎄", "🏖️", "🎸", "🏁", "❤️", "🎉", "⏳"];

/** Live countdowns to the things you're working towards. Ticks every second. */
export default function CountdownView() {
  const { data, today, updateSettings } = useStore();
  const [now, setNow] = useState(0);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [date, setDate] = useState(addDays(today, 30));
  const [time, setTime] = useState("09:00");
  const [color, setColor] = useState(HABIT_COLORS[2].hex);
  const [emoji, setEmoji] = useState("");

  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = window.setTimeout(tick, 0);
    const id = window.setInterval(tick, 1000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(id);
    };
  }, []);

  const list = useMemo(() => {
    const items = [...data.settings.countdowns];
    const ts = (c: Countdown) => new Date(c.at).getTime();
    const upcoming = items.filter((c) => ts(c) >= now).sort((a, b) => ts(a) - ts(b));
    const past = items.filter((c) => ts(c) < now).sort((a, b) => ts(b) - ts(a));
    return [...upcoming, ...past];
  }, [data.settings.countdowns, now]);

  const add = () => {
    const t = title.trim();
    if (!t || !date) return;
    const item: Countdown = { id: uid(), title: t, at: `${date}T${time || "09:00"}`, color, emoji: emoji || undefined };
    updateSettings((s) => ({ ...s, countdowns: [...s.countdowns, item] }));
    setTitle("");
    setEmoji("");
  };

  return (
    <div className="rise flex flex-col gap-4">
      <h1 className="px-1 text-2xl font-extrabold text-ink">Countdowns</h1>

      {list.length === 0 ? (
        <section className="card px-4 py-6 text-center">
          <div className="text-4xl">⏳</div>
          <p className="mt-2 text-sm font-semibold text-ink-muted">Nothing to count down to yet. Mocks, a match, a trip, results day: add it below.</p>
        </section>
      ) : (
        list.map((c) => {
          const target = new Date(c.at).getTime();
          const past = now > 0 && target < now;
          const d = splitDuration(target - (now || target));
          return (
            <section key={c.id} className="card overflow-hidden" style={{ borderLeft: `8px solid ${c.color}` }}>
              <div className="p-4" style={{ backgroundColor: `${c.color}12` }}>
                <div className="flex items-start gap-3">
                  <span className="text-3xl leading-none">{c.emoji ?? "⏳"}</span>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-lg font-extrabold leading-tight text-ink">{c.title}</h2>
                    <div className="text-xs font-bold text-ink-muted">{formatDateTime(c.at)}</div>
                  </div>
                  {confirmId === c.id ? (
                    <div className="flex items-center gap-1">
                      <button type="button" className="tap rounded-xl bg-sunset-500 px-3 py-2 text-xs font-extrabold text-white" onClick={() => updateSettings((s) => ({ ...s, countdowns: s.countdowns.filter((x) => x.id !== c.id) }))}>
                        Delete
                      </button>
                      <button type="button" className="btn-ghost px-2 py-2 text-xs" onClick={() => setConfirmId(null)}>
                        Keep
                      </button>
                    </div>
                  ) : (
                    <button type="button" className="btn-icon h-9 w-9" onClick={() => setConfirmId(c.id)} aria-label="Delete countdown">
                      <TrashIcon />
                    </button>
                  )}
                </div>
                <div className="mt-3 grid grid-cols-4 gap-2" aria-live="off">
                  {(
                    [
                      [d.days, "days"],
                      [d.hours, "hours"],
                      [d.minutes, "mins"],
                      [d.seconds, "secs"],
                    ] as const
                  ).map(([v, label]) => (
                    <div key={label} className="rounded-2xl bg-white/85 px-1 py-2 text-center shadow-soft">
                      <div className={cn("text-2xl font-extrabold leading-none tabular-nums md:text-3xl", past ? "text-ink-muted" : "text-ink")}>{now ? v : "–"}</div>
                      <div className="mt-1 text-[10px] font-extrabold uppercase tracking-wider text-ink-muted">{label}</div>
                    </div>
                  ))}
                </div>
                {past && <div className="mt-2 text-center text-xs font-extrabold uppercase tracking-wider text-ink-muted">that long ago</div>}
              </div>
            </section>
          );
        })
      )}

      <section className="card p-4 md:p-5">
        <h2 className="mb-3 text-lg font-extrabold text-ink">New countdown</h2>
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            add();
          }}
        >
          <input className="field" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Physics mock, half term, first league game" autoComplete="off" />
          <div className="flex flex-wrap items-center gap-2">
            <input type="date" className="rounded-lg border border-sand-200 bg-white px-2 py-2 text-sm font-bold text-ink" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Date" />
            <input type="time" className="rounded-lg border border-sand-200 bg-white px-2 py-2 text-sm font-bold text-ink" value={time} onChange={(e) => setTime(e.target.value)} aria-label="Time" />
          </div>
          <div className="flex flex-wrap items-center gap-1">
            {HABIT_COLORS.map((hc) => (
              <button key={hc.hex} type="button" title={hc.name} onClick={() => setColor(hc.hex)} className={cn("tap h-7 w-7 rounded-full border-2 transition-transform", color === hc.hex ? "scale-110 border-ink" : "border-white")} style={{ backgroundColor: hc.hex }} />
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-1">
            {QUICK_EMOJI.map((e) => (
              <button key={e} type="button" onClick={() => setEmoji(emoji === e ? "" : e)} className={cn("tap flex h-9 w-9 items-center justify-center rounded-lg text-lg", emoji === e ? "bg-ocean-100" : "hover:bg-sand-100")}>
                {e}
              </button>
            ))}
          </div>
          <button type="submit" className="btn-primary" disabled={!title.trim() || !date}>
            <PlusIcon /> Start counting
          </button>
        </form>
      </section>
    </div>
  );
}
