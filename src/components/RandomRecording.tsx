"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useStore } from "@/lib/store";
import { formatShort } from "@/lib/dates";
import { hourOf } from "@/lib/media";
import { CloseIcon } from "./Icons";
import VoiceEntries from "./VoiceEntries";
import { lockScroll } from "@/lib/scrollLock";

type Rec = { date: string; id: string; at: number; dur: number };

const ROW = 56;
const SPIN = 32;
const SPIN_MS = 2800;
const labelOf = (r: Rec) => `${formatShort(r.date)} · ${hourOf(r.at)}`;

/** Every journal recording ever made, on any day. */
function useAllRecordings(): Rec[] {
  const { data, voicePending } = useStore();
  return useMemo(() => {
    const out: Rec[] = [];
    for (const [date, d] of Object.entries(data.days)) for (const [id, v] of Object.entries(d.voice ?? {})) out.push({ date, id, at: v.at, dur: v.dur });
    for (const [id, p] of Object.entries(voicePending)) if (!out.some((r) => r.id === id)) out.push({ date: p.date, id, at: p.at, dur: p.dur });
    return out;
  }, [data.days, voicePending]);
}

/** A reel of recordings that spins and lands on a random one, which you can then play. */
function Spinner({ all }: { all: Rec[] }) {
  const [round, setRound] = useState(0);
  const [reel, setReel] = useState<Rec[]>([]);
  const [offset, setOffset] = useState(0);
  const [landed, setLanded] = useState(false);
  const pick = reel[SPIN - 1];

  useEffect(() => {
    // A fresh reel of random recordings each round (the last one is the pick), shown at the top with no
    // animation, then let it run down to the pick.
    const reset = window.setTimeout(() => {
      // one extra row after the pick, so the reel doesn't end in a blank space
      setReel(Array.from({ length: SPIN + 1 }, () => all[Math.floor(Math.random() * all.length)]));
      setLanded(false);
      setOffset(0);
    }, 0);
    const go = window.setTimeout(() => setOffset(ROW * (2 - SPIN)), 80);
    // Lands when the spin is over (a timer, so it never gets stuck if the animation event doesn't fire).
    const land = window.setTimeout(() => setLanded(true), 80 + SPIN_MS + 60);
    return () => {
      window.clearTimeout(reset);
      window.clearTimeout(go);
      window.clearTimeout(land);
    };
    // Only a new round re-spins (not new data arriving mid-spin).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round]);

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-full overflow-hidden" style={{ height: ROW * 3 }}>
        <div
          className="will-change-transform"
          style={{ transform: `translateY(${offset}px)`, transition: offset === 0 ? "none" : `transform ${SPIN_MS}ms cubic-bezier(0.12, 0.75, 0.1, 1)` }}
        >
          {reel.map((r, i) => (
            <div key={i} className="flex items-center justify-center text-[22px] font-semibold tabular-nums tracking-[-0.02em]" style={{ height: ROW }}>
              {labelOf(r)}
            </div>
          ))}
        </div>
        {/* fade the rows above and below, and frame the middle one */}
        <div className="pointer-events-none absolute inset-x-0 top-0 bg-gradient-to-b from-bg to-transparent" style={{ height: ROW }} />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-bg to-transparent" style={{ height: ROW }} />
        <div className="pointer-events-none absolute inset-x-0 border-y border-ink" style={{ top: ROW, height: ROW }} />
      </div>

      <div className="mt-6 w-full" style={{ minHeight: 76 }}>
        {landed && pick && <VoiceEntries key={pick.id} date={pick.date} entries={[{ id: pick.id, at: pick.at, dur: pick.dur }]} />}
      </div>

      <button type="button" className="btn mt-4 w-full" disabled={!landed} onClick={() => setRound((n) => n + 1)}>
        Spin again
      </button>
    </div>
  );
}

export default function RandomRecording({ onClose }: { onClose: () => void }) {
  const all = useAllRecordings();

  useEffect(() => {
    const unlock = lockScroll();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      unlock();
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40"
      onClick={(e) => {
        e.stopPropagation();
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="sheet-up w-full max-w-[520px] rounded-t-[22px] bg-bg px-5 pb-safe pt-5" role="dialog" aria-modal="true" aria-label="Random recordings">
        <div className="flex items-start justify-between">
          <div className="text-[22px] font-bold tracking-[-0.03em]">Random recordings</div>
          <button type="button" className="tap -mr-2 flex h-9 w-9 items-center justify-center rounded-full text-ink-2" onClick={onClose} aria-label="Close">
            <CloseIcon />
          </button>
        </div>
        <div className="py-8">{all.length ? <Spinner all={all} /> : <p className="py-10 text-center text-[15px] text-muted">No recordings yet.</p>}</div>
      </div>
    </div>,
    document.body,
  );
}
