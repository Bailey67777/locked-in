"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { hasJournal } from "@/lib/model";
import { LockIcon } from "./Icons";
import Journal from "./Journal";

/**
 * The personal journal. Encrypted on this device with your passphrase before anything is saved;
 * the database, the local cache and the Claude API only ever see ciphertext.
 */
export default function EncryptedJournal({ date }: { date: string }) {
  const { getDay, data, journalState, journalBusy, journalText, setupJournal, unlockJournal, lockJournal, saveJournal } = useStore();
  const day = getDay(date);
  const [pass, setPass] = useState("");
  const [pass2, setPass2] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const legacyCount = Object.values(data.days).filter((d) => hasJournal(d) && !d.journalEnc).length;

  const create = async () => {
    setError(null);
    if (pass.length < 8) return setError("Use at least 8 characters.");
    if (pass !== pass2) return setError("The two passphrases don't match.");
    try {
      const n = await setupJournal(pass);
      setPass("");
      setPass2("");
      setNotice(n > 0 ? `Journal encrypted. ${n} existing ${n === 1 ? "entry was" : "entries were"} migrated and the plain-text copies removed.` : "Journal encrypted. New entries are private from now on.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong; nothing was changed.");
    }
  };

  const unlock = async () => {
    setError(null);
    const ok = await unlockJournal(pass);
    if (!ok) return setError("Wrong passphrase.");
    setPass("");
  };

  const header = (
    <div className="mb-2 flex items-start justify-between gap-3">
      <div>
        <h2 className="text-lg font-extrabold text-ink">Journal</h2>
        <p className="text-sm font-semibold text-ink-muted">Private. Encrypted on your device; nobody else can read it, not even Claude.</p>
      </div>
      {journalState === "unlocked" && (
        <button type="button" className="btn-ghost shrink-0 px-2" onClick={() => lockJournal()} title="Lock the journal on this device">
          <LockIcon /> Lock
        </button>
      )}
    </div>
  );

  if (journalState === "unavailable") {
    return (
      <section className="card p-4 md:p-5">
        {header}
        <p className="rounded-2xl bg-sand-50 px-4 py-3 text-sm font-semibold text-ink-soft">This browser can&apos;t do the encryption (it needs a modern browser over https). Open the app on your phone or laptop instead.</p>
      </section>
    );
  }

  if (journalState === "none") {
    return (
      <section className="card p-4 md:p-5">
        {header}
        <div className="rounded-2xl bg-sand-50 p-4">
          <p className="text-sm font-extrabold text-ink">Create a journal passphrase</p>
          <p className="mt-1 text-sm font-semibold text-ink-soft">
            {legacyCount > 0 ? `Your ${legacyCount} existing ${legacyCount === 1 ? "entry" : "entries"} will be encrypted with it and the plain-text ${legacyCount === 1 ? "copy" : "copies"} deleted. ` : ""}
            You&apos;ll enter it once on each device.
          </p>
          <p className="mt-2 rounded-xl bg-sunset-100 px-3 py-2 text-sm font-bold text-sunset-700">If you forget this, your journal entries cannot be recovered. Nobody can reset it. Write it down somewhere safe, offline.</p>
          <form
            className="mt-3 flex flex-col gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void create();
            }}
          >
            <input type="password" className="field" placeholder="Passphrase (8+ characters)" value={pass} onChange={(e) => setPass(e.target.value)} autoComplete="new-password" />
            <input type="password" className="field" placeholder="Type it again" value={pass2} onChange={(e) => setPass2(e.target.value)} autoComplete="new-password" />
            {error && <p className="text-sm font-bold text-sunset-600">{error}</p>}
            <button type="submit" className="btn-primary" disabled={journalBusy || !pass || !pass2}>
              {journalBusy ? "Encrypting…" : "Encrypt my journal"}
            </button>
          </form>
        </div>
      </section>
    );
  }

  if (journalState === "locked") {
    return (
      <section className="card p-4 md:p-5">
        {header}
        <div className="rounded-2xl bg-sand-50 p-4">
          <p className="flex items-center gap-2 text-sm font-extrabold text-ink">
            <LockIcon /> Journal locked
          </p>
          <form
            className="mt-2 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void unlock();
            }}
          >
            <input type="password" className="field" placeholder="Passphrase" value={pass} onChange={(e) => setPass(e.target.value)} autoComplete="current-password" aria-label="Journal passphrase" />
            <button type="submit" className="btn-primary px-4" disabled={journalBusy || !pass}>
              {journalBusy ? "…" : "Unlock"}
            </button>
          </form>
          {error && <p className="mt-2 text-sm font-bold text-sunset-600">{error}</p>}
          {day.journalEnc && <p className="mt-2 text-xs font-semibold text-ink-muted">There is an entry for this day. Unlock to read or edit it.</p>}
        </div>
      </section>
    );
  }

  const text = journalText(date);
  const waiting = day.journalEnc && text === null;

  return (
    <section className="card p-4 md:p-5">
      {header}
      {notice && <p className="mb-2 rounded-xl bg-teal-100/70 px-3 py-2 text-sm font-bold text-teal-700">{notice}</p>}
      {waiting ? (
        <p className="py-6 text-center text-sm font-semibold text-ink-muted">Decrypting…</p>
      ) : (
        <Journal
          key={`journal-${date}-${text === null ? "empty" : "has"}`}
          value={text ?? ""}
          onSave={(t) => {
            saveJournal(date, t).catch(() => setError("Couldn't save: the journal is locked."));
          }}
          placeholder="One honest paragraph. What went well, what you'd change, what tomorrow's block is."
        />
      )}
      {error && <p className="text-sm font-bold text-sunset-600">{error}</p>}
    </section>
  );
}
