"use client";

import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { addDays, formatLong, formatShort } from "@/lib/dates";
import { downloadText } from "@/lib/reminders";
import Journal from "./Journal";
import DateSwitcher from "./DateSwitcher";

type Range = 7 | 30 | 0;

/** The journal, plus active recall: write down everything you learned today, from memory. */
export default function JournalView() {
  const { today, data, getDay, updateDay } = useStore();
  const [date, setDate] = useState(today);
  const [range, setRange] = useState<Range>(30);
  const [withJournal, setWithJournal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [shown, setShown] = useState(10);
  const day = getDay(date);

  const entries = useMemo(
    () =>
      Object.values(data.days)
        .filter((d) => d.journal.trim() || d.recall?.trim())
        .sort((a, b) => b.date.localeCompare(a.date)),
    [data.days],
  );

  const exportText = useMemo(() => {
    const from = range === 0 ? "0000-00-00" : addDays(today, -(range - 1));
    const picked = entries.filter((d) => d.date >= from && d.date <= today && (d.recall?.trim() || (withJournal && d.journal.trim()))).reverse();
    const lines = [
      `# What I've covered${range ? ` (last ${range} days)` : ""}`,
      "",
      "I'm a Year 12 student taking A-level Maths, Further Maths, Physics and Economics. These are my own end-of-day active-recall notes, written from memory, so they may contain mistakes. Use them to see what I've covered, spot gaps or misunderstandings, and quiz me.",
      "",
    ];
    for (const d of picked) {
      lines.push(`## ${formatLong(d.date)} ${d.date.slice(0, 4)}`);
      if (d.recall?.trim()) lines.push("", "**Active recall**", "", d.recall.trim());
      if (withJournal && d.journal.trim()) lines.push("", "**Journal**", "", d.journal.trim());
      lines.push("");
    }
    return { text: lines.join("\n"), count: picked.length };
  }, [entries, range, today, withJournal]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(exportText.text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = exportText.text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rise flex flex-col gap-4">
      <h1 className="px-1 text-2xl font-extrabold text-ink">Journal</h1>
      <DateSwitcher date={date} today={today} onChange={setDate} />

      <section className="card p-4 md:p-5">
        <h2 className="text-lg font-extrabold text-ink">Active recall</h2>
        <p className="mb-3 text-sm font-semibold text-ink-muted">Books closed. Write everything you learned and did today, lesson by lesson. Then check your notes and fix what you got wrong. The struggle to remember is the revision.</p>
        <Journal
          key={`recall-${date}`}
          value={day.recall ?? ""}
          rows={9}
          onSave={(recall) => updateDay(date, (d) => ({ ...d, recall: recall || undefined }))}
          placeholder={"Maths: \nFurther Maths: \nPhysics: \nEconomics: \n\nAnything else I did or figured out today:"}
        />
      </section>

      <section className="card p-4 md:p-5">
        <h2 className="text-lg font-extrabold text-ink">Journal</h2>
        <p className="mb-3 text-sm font-semibold text-ink-muted">The same entry you see on Today. Short and honest beats long and skipped.</p>
        <Journal key={`journal-${date}`} value={day.journal} onSave={(journal) => updateDay(date, (d) => ({ ...d, journal }))} />
      </section>

      <section className="card p-4 md:p-5">
        <h2 className="text-lg font-extrabold text-ink">Give it to Claude</h2>
        <p className="text-sm font-semibold text-ink-muted">
          Copy your recall notes and paste them into a Claude chat (or a Claude Project, so it remembers). It will know what you&apos;ve covered at school and can quiz you on it.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <div className="flex rounded-full bg-sand-100 p-1">
            {(
              [
                [7, "7 days"],
                [30, "30 days"],
                [0, "Everything"],
              ] as const
            ).map(([r, label]) => (
              <button key={r} type="button" onClick={() => setRange(r)} className={`tap rounded-full px-3 py-1.5 text-xs font-extrabold ${range === r ? "bg-white text-ocean-800 shadow-soft" : "text-ink-muted"}`}>
                {label}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-xs font-bold text-ink-soft">
            <input type="checkbox" checked={withJournal} onChange={(e) => setWithJournal(e.target.checked)} className="h-4 w-4 accent-teal-500" />
            include journal entries
          </label>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" className="btn-primary flex-1" onClick={copy} disabled={exportText.count === 0}>
            {copied ? "Copied ✓" : `Copy ${exportText.count} ${exportText.count === 1 ? "day" : "days"}`}
          </button>
          <button type="button" className="btn-ghost" onClick={() => downloadText(`locked-in-recall-${today}.md`, exportText.text, "text/markdown")} disabled={exportText.count === 0}>
            Download .md
          </button>
        </div>
        {exportText.count === 0 && <p className="mt-2 text-xs font-semibold text-ink-muted">Nothing to export in that range yet. Write a recall entry above first.</p>}
      </section>

      <section className="card p-4 md:p-5">
        <h2 className="mb-3 text-lg font-extrabold text-ink">Past entries</h2>
        {entries.length === 0 ? (
          <p className="text-sm font-semibold text-ink-muted">Nothing written yet. Tonight&apos;s entry will be the first.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {entries.slice(0, shown).map((d) => (
              <li key={d.date}>
                <button type="button" onClick={() => { setDate(d.date); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="tap block w-full rounded-2xl bg-sand-50 px-3 py-2.5 text-left hover:bg-sand-100">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-extrabold text-ink">{formatShort(d.date)}</span>
                    <span className="text-[11px] font-bold text-ink-muted">
                      {d.recall?.trim() ? "🧠 recall" : ""}
                      {d.recall?.trim() && d.journal.trim() ? " · " : ""}
                      {d.journal.trim() ? "📓 journal" : ""}
                    </span>
                  </div>
                  <p className="mt-0.5 line-clamp-2 text-sm font-semibold text-ink-soft">{(d.journal.trim() || d.recall || "").slice(0, 180)}</p>
                </button>
              </li>
            ))}
          </ul>
        )}
        {entries.length > shown && (
          <button type="button" className="btn-ghost mt-2" onClick={() => setShown((n) => n + 20)}>
            Show more
          </button>
        )}
      </section>
    </div>
  );
}
