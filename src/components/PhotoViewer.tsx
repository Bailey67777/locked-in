"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useHub } from "@/lib/hub/store";
import { usePhotoUrl } from "@/lib/hub/useVault";
import { removePhoto } from "@/lib/hub/photos";
import { POSES } from "@/lib/hub/subjects";
import { ago } from "@/lib/hub/time";
import { formatShort } from "@/lib/dates";
import type { PoseId } from "@/lib/hub/types";
import { cn } from "@/lib/cn";
import { CloseIcon } from "./Icons";
import { lockScroll } from "@/lib/scrollLock";

/** A day's photos full screen, on black. Swipe or tap the sides to move between them. */
export default function PhotoViewer({ date, pose, onClose, onReplace }: { date: string; pose: PoseId; onClose: () => void; onReplace?: (pose: PoseId) => void }) {
  const { data, today, write } = useHub();
  const day = data.photos[date] ?? {};
  const have = POSES.filter((p) => day[p.id]);
  const [current, setCurrent] = useState<PoseId>(pose);
  const [menu, setMenu] = useState<"move" | "delete" | null>(null);
  const index = Math.max(0, have.findIndex((p) => p.id === current));
  const shown = have[index];
  const meta = shown ? day[shown.id] : undefined;
  const { url, error } = usePhotoUrl(meta, "full");
  const thumb = usePhotoUrl(meta, "thumb");
  const touch = useRef<{ x: number; y: number } | null>(null);

  const step = (d: -1 | 1) => {
    const next = have[index + d];
    if (next) {
      setCurrent(next.id);
      setMenu(null);
    }
  };

  useEffect(() => {
    const unlock = lockScroll();
    return () => {
      unlock();
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") step(-1);
      if (e.key === "ArrowRight") step(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // Nothing left to show (the last one was deleted): close.
  useEffect(() => {
    if (!have.length) onClose();
  }, [have.length, onClose]);
  if (!shown || !meta) return null;

  const move = (to: PoseId) => {
    const other = day[to];
    write(`photos/${date}/${to}`, meta);
    write(`photos/${date}/${shown.id}`, other ?? null);
    setCurrent(to);
    setMenu(null);
  };

  const remove = () => {
    write(`photos/${date}/${shown.id}`, null);
    void removePhoto(meta.id);
    setMenu(null);
    const next = have[index + 1] ?? have[index - 1];
    if (next) setCurrent(next.id);
  };

  return createPortal(
    <div className="fixed inset-0 z-[70] flex flex-col bg-black text-white" role="dialog" aria-modal="true" aria-label={shown.name}>
      <div className="pt-safe" />
      <div className="flex shrink-0 items-center justify-between px-4 py-3">
        <div className="min-w-0">
          <div className="truncate text-[16px] font-semibold tracking-[-0.01em]">{shown.name}</div>
          <div className="font-mono text-[12px] tabular-nums text-white/55">
            {formatShort(date)}
            {date !== today && ` · ${ago(date, today)}`}
          </div>
        </div>
        <button type="button" onClick={onClose} className="tap -mr-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10" aria-label="Close">
          <CloseIcon />
        </button>
      </div>

      <div
        className="relative min-h-0 flex-1 select-none"
        onTouchStart={(e) => (touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY })}
        onTouchEnd={(e) => {
          const t = touch.current;
          touch.current = null;
          if (!t) return;
          const dx = e.changedTouches[0].clientX - t.x;
          const dy = e.changedTouches[0].clientY - t.y;
          if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.3) step(dx < 0 ? 1 : -1);
          else if (dy > 110 && Math.abs(dy) > Math.abs(dx) * 1.5) onClose();
        }}
      >
        {url || thumb.url ? (
          // eslint-disable-next-line @next/next/no-img-element -- a decrypted picture held in memory
          <img key={shown.id} src={url ?? thumb.url ?? ""} alt={shown.name} className={cn("absolute inset-0 h-full w-full object-contain", !url && "blur-[2px]")} draggable={false} />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center px-8 text-center text-[13px] text-white/55">{error ?? "…"}</div>
        )}
        <button type="button" className="absolute inset-y-0 left-0 w-1/4" onClick={() => step(-1)} aria-label="Previous photo" disabled={index === 0} />
        <button type="button" className="absolute inset-y-0 right-0 w-1/4" onClick={() => step(1)} aria-label="Next photo" disabled={index === have.length - 1} />
      </div>

      <div className="shrink-0 px-4 pt-3">
        <div className="flex justify-center gap-1.5" aria-hidden="true">
          {have.map((p, i) => (
            <span key={p.id} className={cn("h-[3px] w-6 rounded-full", i === index ? "bg-white" : "bg-white/25")} />
          ))}
        </div>
        {menu === "move" ? (
          <div className="mt-3 flex flex-wrap justify-center gap-1.5">
            {POSES.filter((p) => p.id !== shown.id).map((p) => (
              <button key={p.id} type="button" onClick={() => move(p.id)} className="h-10 rounded-full bg-white/10 px-4 text-[13.5px]">
                {p.name}
              </button>
            ))}
            <button type="button" onClick={() => setMenu(null)} className="h-10 px-3 text-[13.5px] text-white/55">
              Cancel
            </button>
          </div>
        ) : menu === "delete" ? (
          <div className="mt-3 flex justify-center gap-2">
            <button type="button" onClick={remove} className="h-10 rounded-full bg-white px-5 text-[14px] font-medium text-black">
              Delete photo
            </button>
            <button type="button" onClick={() => setMenu(null)} className="h-10 px-3 text-[13.5px] text-white/55">
              Cancel
            </button>
          </div>
        ) : (
          <div className="mt-3 flex justify-center gap-1 text-[13.5px] text-white/70">
            {onReplace && (
              <button type="button" onClick={() => onReplace(shown.id)} className="h-10 px-4">
                Replace
              </button>
            )}
            <button type="button" onClick={() => setMenu("move")} className="h-10 px-4">
              Wrong pose
            </button>
            <button type="button" onClick={() => setMenu("delete")} className="h-10 px-4">
              Delete
            </button>
          </div>
        )}
      </div>
      <div className="pb-safe" />
      <div className="h-3 shrink-0" />
    </div>,
    document.body,
  );
}
