"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useStore } from "@/lib/store";
import { formatClock } from "@/lib/model";
import { formatLong } from "@/lib/dates";
import { CloseIcon } from "./Icons";

type Loaded = { date: string; url?: string; ext?: string; error?: string };

/** Full-screen player for a day's vlog. The video is read from this device if it's here, otherwise downloaded, then played. */
export default function VlogPlayer({ date, onClose }: { date: string; onClose: () => void }) {
  const { loadVlog, data } = useStore();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [progress, setProgress] = useState(0);
  const meta = data.days[date]?.vlog;

  useEffect(() => {
    let cancelled = false;
    let url: string | null = null;
    loadVlog(date, (f) => !cancelled && setProgress(f))
      .then((blob) => {
        if (cancelled) return;
        url = URL.createObjectURL(blob);
        setLoaded({ date, url, ext: blob.type.includes("webm") ? "webm" : "mp4" });
      })
      .catch((e) => !cancelled && setLoaded({ date, error: e instanceof Error && e.message ? e.message : "Couldn't play this vlog." }));
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [date, loadVlog]);

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

  const current = loaded && loaded.date === date ? loaded : null;

  return createPortal(
    <div className="fixed inset-0 z-[80] flex flex-col bg-black/90 text-white backdrop-blur-xl" role="dialog" aria-modal="true" aria-label={`Vlog from ${formatLong(date)}`} onClick={(e) => e.stopPropagation()}>
      <div className="pt-safe" />
      <div className="mx-auto flex w-full max-w-md items-center justify-between gap-3 px-4 pb-2 pt-4">
        <div className="min-w-0">
          <div className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-white/60">Vlog{meta?.dur ? ` · ${formatClock(meta.dur)}` : ""}</div>
          <div className="truncate font-serif text-2xl leading-tight">
            {formatLong(date)} {date.slice(0, 4)}
          </div>
        </div>
        <button type="button" onClick={onClose} className="tap flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15 text-white" aria-label="Close">
          <CloseIcon />
        </button>
      </div>
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 p-3">
        {current?.url ? (
          <>
            <video
              src={current.url}
              controls
              playsInline
              className="min-h-0 w-full max-w-md flex-1 rounded-3xl bg-black object-contain"
              onLoadedMetadata={(e) => {
                const v = e.currentTarget;
                const start = () => v.play().catch(() => undefined);
                if (Number.isFinite(v.duration)) return void start();
                // Recordings made in Chrome don't say how long they are until the browser has looked at the end once.
                const back = () => {
                  v.removeEventListener("timeupdate", back);
                  v.currentTime = 0;
                  void start();
                };
                v.addEventListener("timeupdate", back);
                v.currentTime = 1e101;
              }}
            />
            <a href={current.url} download={`vlog-${date}.${current.ext}`} className="tap rounded-full bg-white/15 px-4 py-2 text-[13px] font-bold text-white">
              Save a copy to this device
            </a>
          </>
        ) : current?.error ? (
          <div className="max-w-sm rounded-2xl bg-white/10 p-5 text-center">
            <p className="text-[15px] font-bold leading-relaxed">{current.error}</p>
            <button type="button" className="tap mt-4 rounded-full bg-white px-4 py-2 text-[13px] font-bold text-black" onClick={onClose}>
              OK
            </button>
          </div>
        ) : (
          <div className="w-full max-w-xs text-center">
            <p className="text-[13px] font-bold text-white/75">{progress > 0 ? `Downloading… ${Math.round(progress * 100)}%` : "Getting the vlog…"}</p>
            <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/20">
              <div className="h-full rounded-full bg-white transition-[width] duration-300" style={{ width: `${Math.max(6, Math.round(progress * 100))}%` }} />
            </div>
          </div>
        )}
      </div>
      <div className="pb-safe" />
    </div>,
    document.body,
  );
}
