"use client";

import { useEffect, useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { ECON_CARDS, HEALTH_FACTS, indexForDate } from "@/lib/daily";
import { formatLong } from "@/lib/dates";

type Headline = { title: string; link: string; date: string; source: string };

/** Three things a day: a health fact, some economics, and a flashback to something you wrote. */
export default function DailyView() {
  const { today, data } = useStore();
  const [healthSkip, setHealthSkip] = useState(0);
  const [econSkip, setEconSkip] = useState(0);
  const [flashSkip, setFlashSkip] = useState(0);
  const [headlines, setHeadlines] = useState<Headline[] | null>(null);
  const [newsFailed, setNewsFailed] = useState(false);

  const fact = HEALTH_FACTS[(indexForDate(today, HEALTH_FACTS.length, 7) + healthSkip) % HEALTH_FACTS.length];
  const econ = ECON_CARDS[(indexForDate(today, ECON_CARDS.length, 13) + econSkip) % ECON_CARDS.length];

  useEffect(() => {
    let cancelled = false;
    const cacheKey = `locked-in:econ-news:${today}`;
    try {
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached) as Headline[];
        window.setTimeout(() => !cancelled && setHeadlines(parsed), 0);
        return () => {
          cancelled = true;
        };
      }
    } catch {
      /* ignore */
    }
    fetch("/api/econ-news")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("bad status"))))
      .then((j: { headlines?: Headline[] }) => {
        if (cancelled) return;
        const list = Array.isArray(j.headlines) ? j.headlines : [];
        setHeadlines(list);
        try {
          sessionStorage.setItem(cacheKey, JSON.stringify(list));
        } catch {
          /* ignore */
        }
      })
      .catch(() => !cancelled && setNewsFailed(true));
    return () => {
      cancelled = true;
    };
  }, [today]);

  const memories = useMemo(
    () =>
      Object.values(data.days)
        .filter((d) => d.date < today && (d.journal.trim() || d.recall?.trim()))
        .sort((a, b) => a.date.localeCompare(b.date)),
    [data.days, today],
  );
  const memory = memories.length ? memories[(indexForDate(today, memories.length, 23) + flashSkip) % memories.length] : null;

  return (
    <div className="rise flex flex-col gap-4">
      <h1 className="px-1 text-2xl font-extrabold text-ink">Daily</h1>

      <section className="card overflow-hidden">
        <div className="bg-teal-100/70 px-4 py-2 text-xs font-extrabold uppercase tracking-[0.14em] text-teal-700">🌿 Health · one thing worth knowing</div>
        <div className="p-4 md:p-5">
          <h2 className="text-xl font-extrabold leading-tight text-ink">{fact.title}</h2>
          <p className="mt-2 text-[15px] font-semibold leading-relaxed text-ink-soft">{fact.body}</p>
          <p className="mt-3 rounded-2xl bg-sand-50 px-3 py-2 text-sm font-bold text-ink">
            <span className="text-teal-600">Try it: </span>
            {fact.tryIt}
          </p>
          <button type="button" className="btn-ghost mt-2 px-0" onClick={() => setHealthSkip((n) => n + 1)}>
            Another one →
          </button>
        </div>
      </section>

      <section className="card overflow-hidden">
        <div className="bg-ocean-100 px-4 py-2 text-xs font-extrabold uppercase tracking-[0.14em] text-ocean-800">📈 Economics · concept of the day</div>
        <div className="p-4 md:p-5">
          <h2 className="text-xl font-extrabold leading-tight text-ink">{econ.term}</h2>
          <p className="mt-2 text-[15px] font-semibold leading-relaxed text-ink-soft">{econ.what}</p>
          <dl className="mt-3 flex flex-col gap-2">
            <div className="rounded-2xl bg-sand-50 px-3 py-2">
              <dt className="text-[11px] font-extrabold uppercase tracking-wider text-ink-muted">Real world</dt>
              <dd className="text-sm font-semibold text-ink">{econ.example}</dd>
            </div>
            <div className="rounded-2xl bg-sand-50 px-3 py-2">
              <dt className="text-[11px] font-extrabold uppercase tracking-wider text-ink-muted">Exam angle</dt>
              <dd className="text-sm font-semibold text-ink">{econ.exam}</dd>
            </div>
          </dl>
          <button type="button" className="btn-ghost mt-2 px-0" onClick={() => setEconSkip((n) => n + 1)}>
            Another one →
          </button>

          <div className="mt-4 border-t border-sand-100 pt-4">
            <h3 className="text-sm font-extrabold text-ink">Today&apos;s economics headlines</h3>
            {headlines === null && !newsFailed && <p className="mt-2 text-sm font-semibold text-ink-muted">Fetching…</p>}
            {newsFailed && <p className="mt-2 text-sm font-semibold text-ink-muted">Couldn&apos;t reach the news feeds just now. The concept above still counts.</p>}
            {headlines && headlines.length === 0 && <p className="mt-2 text-sm font-semibold text-ink-muted">No headlines came back. Try again later.</p>}
            {headlines && headlines.length > 0 && (
              <ul className="mt-2 flex flex-col gap-1.5">
                {headlines.map((h) => (
                  <li key={h.link}>
                    <a href={h.link} target="_blank" rel="noopener noreferrer" className="tap block rounded-2xl bg-sand-50 px-3 py-2 hover:bg-sand-100">
                      <span className="block text-sm font-bold leading-snug text-ink">{h.title}</span>
                      <span className="text-[11px] font-bold text-ink-muted">{h.source} ↗</span>
                    </a>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-2 text-[11px] font-semibold text-ink-muted">Pick one, read it, and ask: which diagram is this? Who gains, who loses, what happens next?</p>
          </div>
        </div>
      </section>

      <section className="card overflow-hidden">
        <div className="bg-sunset-100 px-4 py-2 text-xs font-extrabold uppercase tracking-[0.14em] text-sunset-700">🕰️ Flashback · something you wrote</div>
        <div className="p-4 md:p-5">
          {!memory ? (
            <p className="text-sm font-semibold text-ink-muted">Nothing to look back on yet. Every journal entry you write becomes a future flashback, so this gets better the longer you keep going.</p>
          ) : (
            <>
              <div className="flex items-center gap-3">
                {memory.thumb && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={memory.thumb} alt="" className="h-14 w-14 shrink-0 rounded-2xl object-cover shadow-soft" />
                )}
                <div className="min-w-0">
                  <h2 className="text-lg font-extrabold leading-tight text-ink">{formatLong(memory.date)}</h2>
                  <div className="text-xs font-bold text-ink-muted">
                    {memory.ratings.day ? `Day ${memory.ratings.day}/10` : "Not rated"}
                    {memory.ratings.happy ? ` · Happiness ${memory.ratings.happy}/10` : ""}
                    {memory.song ? ` · 🎵 ${memory.song}` : ""}
                  </div>
                </div>
              </div>
              {memory.journal.trim() && <p className="mt-3 whitespace-pre-wrap rounded-2xl bg-sand-50 px-3 py-3 text-[15px] font-semibold leading-relaxed text-ink">{memory.journal}</p>}
              {memory.recall?.trim() && (
                <div className="mt-2 rounded-2xl bg-sand-50 px-3 py-3">
                  <div className="text-[11px] font-extrabold uppercase tracking-wider text-ink-muted">What you&apos;d learned</div>
                  <p className="mt-1 whitespace-pre-wrap text-sm font-semibold leading-relaxed text-ink">{memory.recall}</p>
                </div>
              )}
              {memories.length > 1 && (
                <button type="button" className="btn-ghost mt-2 px-0" onClick={() => setFlashSkip((n) => n + 1)}>
                  Another memory →
                </button>
              )}
              <p className="mt-1 text-[11px] font-semibold text-ink-muted">
                {memories.length} {memories.length === 1 ? "entry" : "entries"} in the bank.
              </p>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
