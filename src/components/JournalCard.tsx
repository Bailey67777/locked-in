"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import Journal from "./Journal";

/** The personal journal. Plain text, no passphrase. Older entries saved under the old passphrase get one unlock prompt, then it's gone. */
export default function JournalCard({ date }: { date: string }) {
  const { journalState, journalBusy, lockedEntries, journalText, saveJournal, unlockJournal, getDay } = useStore();
  const [pass, setPass] = useState("");
  const [error, setError] = useState<string | null>(null);
  const lockedHere = Boolean(getDay(date).journalEnc);

  return (
    <section className="card p-4">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h2 className="card-title">Journal</h2>
        <span className="card-sub">one honest paragraph</span>
      </div>

      {journalState === "locked" && (
        <form
          className="mb-3 rounded-xl bg-sand-50 p-3"
          onSubmit={async (e) => {
            e.preventDefault();
            setError(null);
            const ok = await unlockJournal(pass);
            if (ok) setPass("");
            else setError("That's not the old passphrase.");
          }}
        >
          <p className="text-[12.5px] font-semibold text-ink-soft">
            The passphrase is gone. {lockedEntries} older {lockedEntries === 1 ? "entry is" : "entries are"} still saved under it{lockedHere ? ", including this day" : ""}: type it once to unlock {lockedEntries === 1 ? "it" : "them"} for good.
          </p>
          <div className="mt-2 flex gap-1.5">
            <input type="password" className="field py-2 text-[14px]" placeholder="Old passphrase" value={pass} onChange={(e) => setPass(e.target.value)} autoComplete="current-password" aria-label="Old journal passphrase" />
            <button type="submit" className="btn-primary shrink-0 px-3.5" disabled={journalBusy || !pass}>
              {journalBusy ? "…" : "Unlock"}
            </button>
          </div>
          {error && <p className="mt-1.5 text-[12px] font-bold text-sunset-600">{error}</p>}
        </form>
      )}
      {journalState === "unavailable" && (
        <p className="mb-3 rounded-xl bg-sand-50 px-3 py-2 text-[12.5px] font-semibold text-ink-soft">
          {lockedEntries} older {lockedEntries === 1 ? "entry is" : "entries are"} saved under the old passphrase. Open the app in Safari or Chrome to unlock {lockedEntries === 1 ? "it" : "them"} once.
        </p>
      )}

      <Journal key={`journal-${date}`} value={journalText(date)} onSave={(t) => saveJournal(date, t)} rows={3} placeholder="What went well, what you'd change, what tomorrow's first block is." />
    </section>
  );
}
