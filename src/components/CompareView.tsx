"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useHub } from "@/lib/hub/store";
import { POSES } from "@/lib/hub/subjects";
import { ago } from "@/lib/hub/time";
import { formatDayMonth, parseKey } from "@/lib/dates";
import type { PoseId } from "@/lib/hub/types";
import { cn } from "@/lib/cn";
import { ChevronIcon, CloseIcon } from "./Icons";
import PhotoTile from "./PhotoTile";
import PhotoViewer from "./PhotoViewer";

const label = (date: string, today: string) => `${formatDayMonth(date)}${parseKey(date).getFullYear() !== parseKey(today).getFullYear() ? ` ${parseKey(date).getFullYear()}` : ""}`;

function Side({ pose, dates, date, onDate, onOpen }: { pose: PoseId; dates: string[]; date: string | null; onDate: (d: string) => void; onOpen: (d: string) => void }) {
  const { data, today } = useHub();
  const i = date ? dates.indexOf(date) : -1;
  const meta = date ? data.photos[date]?.[pose] : undefined;
  return (
    <div>
      <PhotoTile meta={meta} label="–" full onClick={date && meta ? () => onOpen(date) : undefined} />
      <div className="mt-2 flex items-center justify-between">
        <button type="button" onClick={() => onDate(dates[i - 1])} disabled={i <= 0} className="flex h-9 w-8 items-center justify-center text-muted disabled:opacity-25" aria-label="Earlier">
          <ChevronIcon dir="left" width={16} height={16} />
        </button>
        <div className="text-center">
          <div className="text-[14px] font-medium tabular-nums">{date ? label(date, today) : "–"}</div>
          <div className="font-mono text-[11px] text-muted">{date ? ago(date, today) : ""}</div>
        </div>
        <button type="button" onClick={() => onDate(dates[i + 1])} disabled={i < 0 || i >= dates.length - 1} className="flex h-9 w-8 items-center justify-center text-muted disabled:opacity-25" aria-label="Later">
          <ChevronIcon width={16} height={16} />
        </button>
      </div>
    </div>
  );
}

/** Two days side by side in the same pose: by default the first photo ever and the latest. */
export default function CompareView({ onClose }: { onClose: () => void }) {
  const { data } = useHub();
  const [pose, setPose] = useState<PoseId>("body-front");
  const dates = useMemo(
    () =>
      Object.keys(data.photos)
        .filter((d) => data.photos[d]?.[pose])
        .sort(),
    [data.photos, pose],
  );
  const [picked, setPicked] = useState<{ pose: PoseId; then: string | null; now: string | null }>({ pose, then: null, now: null });
  const then = picked.pose === pose && picked.then && dates.includes(picked.then) ? picked.then : (dates[0] ?? null);
  const now = picked.pose === pose && picked.now && dates.includes(picked.now) ? picked.now : (dates[dates.length - 1] ?? null);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !open && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose, open]);

  return createPortal(
    <div className="fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-bg" role="dialog" aria-modal="true" aria-label="Compare">
      <div className="fade-up mx-auto w-full max-w-[520px] px-5 pb-[calc(40px+env(safe-area-inset-bottom,0px))]">
        <div className="pt-safe" />
        <header className="mb-6 flex items-center justify-between gap-4 pt-7">
          <h1 className="text-[36px] font-bold leading-none tracking-[-0.04em]">Compare</h1>
          <button type="button" onClick={onClose} className="tap flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-[1.5px] border-ink text-ink" aria-label="Close">
            <CloseIcon />
          </button>
        </header>

        <div className="grid grid-cols-5 gap-1 rounded-2xl bg-surface p-1">
          {POSES.map((p) => (
            <button key={p.id} type="button" aria-pressed={pose === p.id} onClick={() => setPose(p.id)} className={cn("h-10 rounded-xl text-[12.5px] transition-colors", pose === p.id ? "bg-ink text-bg" : "text-ink-2")}>
              {p.short}
            </button>
          ))}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <Side pose={pose} dates={dates} date={then} onDate={(d) => setPicked({ pose, then: d, now })} onOpen={setOpen} />
          <Side pose={pose} dates={dates} date={now} onDate={(d) => setPicked({ pose, then, now: d })} onOpen={setOpen} />
        </div>
      </div>
      {open && <PhotoViewer date={open} pose={pose} onClose={() => setOpen(null)} />}
    </div>,
    document.body,
  );
}
