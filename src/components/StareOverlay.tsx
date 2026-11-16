"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useHub } from "@/lib/hub/store";
import { uid } from "@/lib/hub/model";
import { stopwatch } from "@/lib/hub/time";
import { haptic, playChime, unlockAudio } from "@/lib/hub/chimes";
import { CloseIcon } from "./Icons";
import { lockScroll } from "@/lib/scrollLock";

/** Always ten minutes. */
const MINUTES = 10;

type WakeLock = { release: () => Promise<void> };

/**
 * Stare at Wall: a blank screen for a few minutes before studying, to bring your dopamine down.
 * Nothing moves except a faint countdown. A soft chime at the end, then straight into a study block.
 */
export default function StareOverlay({ onClose }: { onClose: () => void }) {
  const { write } = useHub();
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const [done, setDone] = useState(false);
  const lock = useRef<WakeLock | null>(null);
  const length = MINUTES * 60000;
  const left = startedAt ? Math.max(0, startedAt + length - now) : length;

  useEffect(() => {
    const unlock = lockScroll();
    return () => {
      unlock();
      void lock.current?.release().catch(() => undefined);
    };
  }, []);

  useEffect(() => {
    if (!startedAt || done) return;
    const tick = () => {
      const t = Date.now();
      setNow(t);
      if (t >= startedAt + length) {
        setDone(true);
        write(`stares/${uid()}`, { start: startedAt, end: startedAt + length });
        playChime();
        haptic([30, 80, 30]);
        void lock.current?.release().catch(() => undefined);
      }
    };
    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [startedAt, done, length, write]);

  const begin = async () => {
    unlockAudio();
    setStartedAt(Date.now());
    setNow(Date.now());
    try {
      const wl = (navigator as unknown as { wakeLock?: { request: (t: "screen") => Promise<WakeLock> } }).wakeLock;
      if (wl) lock.current = await wl.request("screen");
    } catch {
      /* the screen may dim; the countdown still runs off the clock */
    }
  };

  const endEarly = () => {
    if (startedAt && Date.now() - startedAt >= 60000) write(`stares/${uid()}`, { start: startedAt, end: Date.now() });
    onClose();
  };

  return createPortal(
    <div className="fixed inset-0 z-[60] flex flex-col bg-bg pb-safe pt-safe" role="dialog" aria-modal="true" aria-label="Stare at Wall">
      {!startedAt && (
        <div className="fade-up mx-auto flex w-full max-w-[420px] flex-1 flex-col px-6">
          <div className="flex justify-end pt-4">
            <button type="button" onClick={onClose} className="tap -mr-2 flex h-10 w-10 items-center justify-center rounded-full text-ink-2" aria-label="Close">
              <CloseIcon />
            </button>
          </div>
          <div className="flex flex-1 flex-col justify-center pb-16">
            <h2 className="text-[36px] font-bold leading-none tracking-[-0.04em]">Stare at Wall</h2>
            <div className="mt-3 font-mono text-[13px] text-muted">10 minutes</div>
            <button type="button" onClick={() => void begin()} className="btn mt-8 h-14 w-full text-[16px]">
              Start
            </button>
          </div>
        </div>
      )}

      {startedAt && !done && (
        <div className="flex flex-1 flex-col items-center justify-end pb-10">
          <div className="font-mono text-[13px] tabular-nums text-faint">{stopwatch(Math.ceil(left / 1000))}</div>
          <button type="button" onClick={endEarly} className="mt-3 px-4 py-2 text-[12px] text-faint">
            End
          </button>
        </div>
      )}

      {done && (
        <div className="fade-up mx-auto flex w-full max-w-[420px] flex-1 flex-col justify-center px-6">
          <h2 className="text-[36px] font-bold leading-none tracking-[-0.04em]">Done.</h2>
          <button type="button" onClick={onClose} className="btn mt-8 w-full">
            Close
          </button>
        </div>
      )}
    </div>,
    document.body,
  );
}
