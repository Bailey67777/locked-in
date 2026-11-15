"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useHub } from "@/lib/hub/store";
import { useVault } from "@/lib/hub/useVault";
import { photoDays } from "@/lib/hub/model";
import { POSES } from "@/lib/hub/subjects";
import { ago } from "@/lib/hub/time";
import { formatShort } from "@/lib/dates";
import type { PoseId } from "@/lib/hub/types";
import { CloseIcon } from "./Icons";
import PhotoTile from "./PhotoTile";
import PhotoViewer from "./PhotoViewer";
import PasscodeSheet from "./PasscodeSheet";

const ROW = 56;
const SPIN = 28;
const SPIN_MS = 2400;

/** A reel of days that spins and lands on a random one, then shows that day's five photos. */
function Spinner({ days }: { days: string[] }) {
  const { data, today } = useHub();
  const [round, setRound] = useState(0);
  const [reel, setReel] = useState<string[]>([]);
  const [offset, setOffset] = useState(0);
  const [landed, setLanded] = useState(false);
  const [open, setOpen] = useState<PoseId | null>(null);
  const pick = reel[SPIN - 1];

  useEffect(() => {
    // A fresh reel each round (the last row is the pick), shown at the top with no animation, then run down to it.
    const reset = window.setTimeout(() => {
      setReel(Array.from({ length: SPIN + 1 }, () => days[Math.floor(Math.random() * days.length)]));
      setLanded(false);
      setOffset(0);
    }, 0);
    const go = window.setTimeout(() => setOffset(ROW * (2 - SPIN)), 80);
    // Lands on a timer, so it never gets stuck if the animation event doesn't fire.
    const land = window.setTimeout(() => setLanded(true), 80 + SPIN_MS + 60);
    return () => {
      window.clearTimeout(reset);
      window.clearTimeout(go);
      window.clearTimeout(land);
    };
    // Only a new round re-spins (not new data arriving mid-spin).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round]);

  const day = pick ? (data.photos[pick] ?? {}) : {};

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-full overflow-hidden" style={{ height: ROW * 3 }}>
        <div className="will-change-transform" style={{ transform: `translateY(${offset}px)`, transition: offset === 0 ? "none" : `transform ${SPIN_MS}ms cubic-bezier(0.12, 0.75, 0.1, 1)` }}>
          {reel.map((d, i) => (
            <div key={i} className="flex items-center justify-center text-[22px] font-semibold tabular-nums tracking-[-0.02em]" style={{ height: ROW }}>
              {formatShort(d)}
            </div>
          ))}
        </div>
        <div className="pointer-events-none absolute inset-x-0 top-0 bg-gradient-to-b from-bg to-transparent" style={{ height: ROW }} />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-bg to-transparent" style={{ height: ROW }} />
        <div className="pointer-events-none absolute inset-x-0 border-y border-ink" style={{ top: ROW, height: ROW }} />
      </div>

      <div className="mt-3 h-5 font-mono text-[12px] text-muted">{landed && pick ? ago(pick, today) : ""}</div>

      <div className="mt-3 grid w-full grid-cols-5 gap-1.5">
        {POSES.map((p) => (landed && pick ? <PhotoTile key={`${pick}:${p.id}`} meta={day[p.id]} label="" className="rounded-[10px]" onClick={day[p.id] ? () => setOpen(p.id) : undefined} /> : <div key={p.id} className="aspect-[3/4] w-full rounded-[10px] bg-surface" />))}
      </div>

      <button type="button" className="btn mt-6 w-full" disabled={!landed} onClick={() => setRound((n) => n + 1)}>
        Spin again
      </button>

      {open && pick && <PhotoViewer date={pick} pose={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

export default function RandomBody({ onClose }: { onClose: () => void }) {
  const { data } = useHub();
  const vault = useVault();
  const { today } = useHub();
  // Looking back is the point: today's photos only come up when there is nothing else yet.
  const all = photoDays(data.photos);
  const past = all.filter((d) => d !== today);
  const days = past.length ? past : all;
  const [unlock, setUnlock] = useState(false);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
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
      <div className="sheet-up max-h-[94dvh] w-full max-w-[520px] overflow-y-auto rounded-t-[22px] bg-bg px-5 pb-safe pt-5" role="dialog" aria-modal="true" aria-label="Random body progress">
        <div className="flex items-start justify-between">
          <div className="text-[22px] font-bold tracking-[-0.03em]">Random body progress</div>
          <button type="button" className="tap -mr-2 flex h-9 w-9 items-center justify-center rounded-full text-ink-2" onClick={onClose} aria-label="Close">
            <CloseIcon />
          </button>
        </div>
        <div className="py-7">
          {!days.length ? (
            <p className="py-10 text-center text-[15px] text-muted">No photos yet.</p>
          ) : vault.state === "open" ? (
            <Spinner days={days} />
          ) : (
            <button type="button" className="btn my-8 w-full" onClick={() => setUnlock(true)} disabled={vault.state !== "locked"}>
              Unlock photos
            </button>
          )}
        </div>
      </div>
      {unlock && <PasscodeSheet mode="unlock" onClose={() => setUnlock(false)} />}
    </div>,
    document.body,
  );
}
