"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useHub } from "@/lib/hub/store";
import { unseenRating } from "@/lib/hub/model";
import { dayTitle } from "@/lib/hub/time";
import { lockScroll } from "@/lib/scrollLock";

const COUNT_MS = 1400;

/** The number, counting up to the rating once. */
function Score({ value }: { value: number }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const id = window.setTimeout(() => setShown(value), 0);
      return () => window.clearTimeout(id);
    }
    let raf = 0;
    const from = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - from) / COUNT_MS);
      setShown(value * (1 - Math.pow(1 - t, 3))); // fast, then settling
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    // Timers and frames stop when the app is in the background: land on the real number regardless.
    const land = window.setTimeout(() => setShown(value), COUNT_MS + 200);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(land);
    };
  }, [value]);
  return <>{shown.toFixed(2)}</>;
}

/**
 * Claude's rating of a day, shown once, the first time the app is opened after it arrives: just the number out of
 * ten. A tap anywhere puts it away, on every device.
 */
export default function RatingReveal() {
  const { data, today, fresh, write } = useHub();
  // Only once the cloud's copy is in: this device's copy may not know the rating was already seen elsewhere.
  const next = fresh ? unseenRating(data.ratings, today) : null;

  useEffect(() => {
    if (!next) return;
    return lockScroll();
  }, [next]);

  if (!next) return null;

  const dismiss = () => {
    const at = Date.now();
    // Older ones that were never opened are put away with it: only the newest is ever shown.
    for (const [date, r] of Object.entries(data.ratings)) if (!r.seen && date <= next.date) write(`ratings/${date}/seen`, at);
  };

  return createPortal(
    <button type="button" onClick={dismiss} className="fade-in fixed inset-0 z-[80] flex flex-col items-center justify-center bg-bg text-ink" aria-label={`${dayTitle(next.date, today)}: ${next.rating.score.toFixed(2)} out of 10. Tap to close`}>
      <span className="label">{dayTitle(next.date, today)}</span>
      <span className="mt-4 text-[104px] font-bold leading-none tracking-[-0.06em] tabular-nums">
        <Score value={next.rating.score} />
      </span>
      <span className="mt-4 text-[15px] text-muted">out of 10</span>
    </button>,
    document.body,
  );
}
