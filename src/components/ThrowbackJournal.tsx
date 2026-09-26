"use client";

import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { pickForDay } from "@/lib/model";
import { formatLong } from "@/lib/dates";
import { LockIcon } from "./Icons";

/** One past journal entry, chosen for today, decrypted on this device and only ever shown here. */
export default function ThrowbackJournal({ date }: { date: string }) {
  const { data, journalState, journalText } = useStore();
  const [skip, setSkip] = useState(0);
  const candidates = useMemo(
    () =>
      Object.values(data.days)
        .filter((d) => d.journalEnc && d.date < date)
        .map((d) => d.date)
        .sort(),
    [data.days, date],
  );
  const picked = pickForDay(candidates, date, skip);

  return (
    <section className="card p-4 md:p-5">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-extrabold text-ink">🕰️ Throwback</h2>
          <p className="text-sm font-semibold text-ink-muted">A past entry from your journal. Nobody else sees this, including Claude.</p>
        </div>
        {candidates.length > 1 && journalState === "unlocked" && (
          <button type="button" className="btn-ghost shrink-0 px-2" onClick={() => setSkip((n) => n + 1)}>
            Another →
          </button>
        )}
      </div>
      {journalState !== "unlocked" ? (
        <p className="flex items-center gap-2 rounded-2xl bg-sand-50 px-4 py-3 text-sm font-semibold text-ink-soft">
          <LockIcon /> Unlock your journal (above) to see a throwback.
        </p>
      ) : !picked ? (
        <p className="rounded-2xl bg-sand-50 px-4 py-3 text-sm font-semibold text-ink-muted">Write a few entries and one of them turns up here.</p>
      ) : (
        <div className="rounded-2xl bg-sand-50 px-4 py-3">
          <div className="text-xs font-extrabold uppercase tracking-wider text-ink-muted">
            {formatLong(picked)} {picked.slice(0, 4)}
          </div>
          <p className="mt-1 whitespace-pre-wrap text-[15px] font-semibold leading-relaxed text-ink">{journalText(picked) ?? "Decrypting…"}</p>
        </div>
      )}
    </section>
  );
}
