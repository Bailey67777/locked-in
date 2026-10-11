"use client";

import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { formatClock, pickForDay } from "@/lib/model";
import { formatLong } from "@/lib/dates";
import VlogPlayer from "./VlogPlayer";

/** One past day, chosen for today: its journal entry and, if it has one, a button to watch that day's vlog. */
export default function ThrowbackJournal({ date }: { date: string }) {
  const { data, journalText } = useStore();
  const [skip, setSkip] = useState(0);
  const [open, setOpen] = useState(false);
  const [watching, setWatching] = useState<string | null>(null);
  const candidates = useMemo(
    () =>
      Object.values(data.days)
        .filter((d) => d.date < date && (d.journal?.trim() || d.recall?.trim() || d.vlog))
        .map((d) => d.date)
        .sort(),
    [data.days, date],
  );
  const picked = pickForDay(candidates, date, skip);
  if (!picked) return null;
  const vlog = data.days[picked]?.vlog;
  const text = journalText(picked);

  return (
    <section className="card px-4 py-3">
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <h2 className="label">Throwback · {formatLong(picked)} {picked.slice(0, 4)}</h2>
        {candidates.length > 1 && (
          <button type="button" className="text-[12px] font-bold text-ocean-700" onClick={() => setSkip((n) => n + 1)}>
            Another
          </button>
        )}
      </div>
      {text.trim() ? (
        <button type="button" onClick={() => setOpen((o) => !o)} className="block w-full text-left">
          <p className={`whitespace-pre-wrap font-serif text-[16px] leading-snug text-ink-soft ${open ? "" : "line-clamp-3"}`}>{text}</p>
        </button>
      ) : (
        <p className="font-serif text-[16px] leading-snug text-ink-muted">Nothing written that day, but you filmed it.</p>
      )}
      {vlog && (
        <button type="button" className="btn-primary mt-3 w-full" onClick={() => setWatching(picked)}>
          ▶ Watch that day&apos;s vlog{vlog.dur ? ` · ${formatClock(vlog.dur)}` : ""}
        </button>
      )}
      {watching && <VlogPlayer date={watching} onClose={() => setWatching(null)} />}
    </section>
  );
}
