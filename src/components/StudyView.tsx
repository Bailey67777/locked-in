"use client";

import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { ECON_CARDS, indexForDate } from "@/lib/daily";
import { daysBetween } from "@/lib/dates";
import GradeChart from "./GradeChart";
import HoursChart from "./HoursChart";

type Headline = { title: string; link: string; date: string; source: string };

/** Everything academic: Claude's grade estimates, estimated study hours, and economics for the day. */
export default function StudyView() {
  const { today, data } = useStore();
  const examDate = data.settings.examDate;
  const daysToExam = examDate ? daysBetween(today, examDate) : null;
  const econ = data.study.econ[today];
  const [econSkip, setEconSkip] = useState(0);
  const staticConcept = ECON_CARDS[(indexForDate(today, ECON_CARDS.length, 13) + econSkip) % ECON_CARDS.length];
  const [headlines, setHeadlines] = useState<Headline[] | null>(null);
  const [newsFailed, setNewsFailed] = useState(false);

  // Fallback reading list (live headlines) only when Claude hasn't written one for today.
  const needNews = !econ?.reading?.length;
  useEffect(() => {
    if (!needNews) return;
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
  }, [today, needNews]);

  return (
    <div className="rise flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-2 px-1">
        <h1 className="text-2xl font-extrabold text-ink">Study</h1>
        {daysToExam !== null ? (
          <span className="rounded-full bg-white/80 px-3 py-1.5 text-sm font-extrabold text-sunset-600 shadow-soft">
            ⏳ {daysToExam < 0 ? "exams started" : `${daysToExam} day${daysToExam === 1 ? "" : "s"} until your first A-level exam`}
          </span>
        ) : (
          <span className="text-xs font-bold text-ink-muted">Set your first exam date in Settings</span>
        )}
      </div>

      <section className="card p-4 md:p-5">
        <div className="mb-2 flex items-baseline justify-between gap-2">
          <h2 className="text-lg font-extrabold text-ink">Grade trajectory</h2>
          <span className="rounded-full bg-sand-100 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-ink-muted">Claude&apos;s estimate</span>
        </div>
        <GradeChart grades={data.study.grades} examDate={examDate} />
      </section>

      <section className="card p-4 md:p-5">
        <div className="mb-2 flex items-baseline justify-between gap-2">
          <h2 className="text-lg font-extrabold text-ink">Weekly study hours</h2>
          <span className="rounded-full bg-sand-100 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-ink-muted">Estimated by Claude</span>
        </div>
        <HoursChart hours={data.study.hours} today={today} />
      </section>

      <section className="card overflow-hidden">
        <div className="bg-ocean-100 px-4 py-2 text-xs font-extrabold uppercase tracking-[0.14em] text-ocean-800">📈 Economics · concept of the day</div>
        <div className="p-4 md:p-5">
          {econ?.concept ? (
            <>
              <h2 className="text-xl font-extrabold leading-tight text-ink">{econ.concept.title}</h2>
              <p className="mt-2 whitespace-pre-wrap text-[15px] font-semibold leading-relaxed text-ink-soft">{econ.concept.explanation}</p>
              <p className="mt-2 text-[11px] font-bold text-ink-muted">Written by Claude for today.</p>
            </>
          ) : (
            <>
              <h2 className="text-xl font-extrabold leading-tight text-ink">{staticConcept.term}</h2>
              <p className="mt-2 text-[15px] font-semibold leading-relaxed text-ink-soft">{staticConcept.what}</p>
              <dl className="mt-3 flex flex-col gap-2">
                <div className="rounded-2xl bg-sand-50 px-3 py-2">
                  <dt className="text-[11px] font-extrabold uppercase tracking-wider text-ink-muted">Real world</dt>
                  <dd className="text-sm font-semibold text-ink">{staticConcept.example}</dd>
                </div>
                <div className="rounded-2xl bg-sand-50 px-3 py-2">
                  <dt className="text-[11px] font-extrabold uppercase tracking-wider text-ink-muted">Exam angle</dt>
                  <dd className="text-sm font-semibold text-ink">{staticConcept.exam}</dd>
                </div>
              </dl>
              <button type="button" className="btn-ghost mt-2 px-0" onClick={() => setEconSkip((n) => n + 1)}>
                Another one →
              </button>
            </>
          )}

          <div className="mt-4 border-t border-sand-100 pt-4">
            <h3 className="text-sm font-extrabold text-ink">{econ?.reading?.length ? "Worth reading today" : "Today's economics headlines"}</h3>
            {econ?.reading?.length ? (
              <ul className="mt-2 flex flex-col gap-1.5">
                {econ.reading.map((r) => (
                  <li key={r.url}>
                    <a href={r.url} target="_blank" rel="noopener noreferrer" className="tap block rounded-2xl bg-sand-50 px-3 py-2 hover:bg-sand-100">
                      <span className="block text-sm font-bold leading-snug text-ink">{r.title}</span>
                      {r.why && <span className="block text-xs font-semibold text-ink-soft">{r.why}</span>}
                      <span className="text-[11px] font-bold text-ink-muted">{r.source || "link"} ↗</span>
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <>
                {headlines === null && !newsFailed && <p className="mt-2 text-sm font-semibold text-ink-muted">Fetching…</p>}
                {newsFailed && <p className="mt-2 text-sm font-semibold text-ink-muted">Couldn&apos;t reach the news feeds just now.</p>}
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
              </>
            )}
            <p className="mt-2 text-[11px] font-semibold text-ink-muted">Pick one, read it, and ask: which diagram is this? Who gains, who loses, what happens next?</p>
          </div>
        </div>
      </section>
    </div>
  );
}
