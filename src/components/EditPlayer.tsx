"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { editUrlNow, loadEditUrl, useEditBank } from "@/lib/edits";
import { CloseIcon } from "./Icons";

/** Plays an edit from the bank full screen, once, then closes itself. */
export default function EditPlayer({ editId, title, onClose }: { editId: string; title?: string; onClose: () => void }) {
  const bank = useEditBank();
  const meta = bank.byId[editId];
  const [loaded, setLoaded] = useState<{ url?: string; error?: string }>(() => ({ url: editUrlNow(editId) }));
  const [needsTap, setNeedsTap] = useState(false);
  const [progress, setProgress] = useState(0);
  const video = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (loaded.url || loaded.error || !meta) return;
    let cancelled = false;
    loadEditUrl(meta, (f) => !cancelled && setProgress(f))
      .then((url) => !cancelled && setLoaded({ url }))
      .catch((e) => !cancelled && setLoaded({ error: e instanceof Error ? e.message : "Couldn't play this edit." }));
    return () => {
      cancelled = true;
    };
  }, [loaded.url, loaded.error, meta]);

  // Try to start with sound straight away; if the phone wants a tap first, show a play button.
  useEffect(() => {
    const v = video.current;
    if (!loaded.url || !v) return;
    v.play().catch(() => setNeedsTap(true));
  }, [loaded.url]);

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

  const missing = bank.ready && !meta;

  return createPortal(
    <div className="fixed inset-0 z-[85] flex flex-col bg-black text-white" role="dialog" aria-modal="true" aria-label="Edit">
      <div className="pt-safe" />
      <div className="mx-auto flex w-full max-w-md items-center justify-between gap-3 px-4 pb-2 pt-4">
        <div className="min-w-0">
          <div className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-white/60">{meta?.name ?? "Edit"}</div>
          {title && <div className="truncate font-serif text-2xl leading-tight">✓ {title}</div>}
        </div>
        <button type="button" onClick={onClose} className="tap flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15 text-white" aria-label="Close">
          <CloseIcon />
        </button>
      </div>
      <div className="relative flex min-h-0 flex-1 items-center justify-center p-3">
        {loaded.url ? (
          <>
            <video
              ref={video}
              src={loaded.url}
              playsInline
              autoPlay
              onPlay={() => setNeedsTap(false)}
              onEnded={() => window.setTimeout(onClose, 250)}
              onClick={() => video.current?.play().catch(() => undefined)}
              className="max-h-full w-full max-w-md rounded-2xl bg-black object-contain"
            />
            {needsTap && (
              <button type="button" onClick={() => video.current?.play().catch(() => undefined)} className="tap absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white px-6 py-3 text-[15px] font-bold text-black">
                ▶ Play
              </button>
            )}
          </>
        ) : loaded.error || missing ? (
          <div className="max-w-sm rounded-2xl bg-white/10 p-5 text-center">
            <p className="text-[15px] font-bold">{missing ? "That edit isn't in the bank any more." : loaded.error}</p>
            <button type="button" className="tap mt-4 rounded-full bg-white px-4 py-2 text-[13px] font-bold text-black" onClick={onClose}>
              OK
            </button>
          </div>
        ) : (
          <div className="w-full max-w-xs text-center">
            <p className="text-[13px] font-bold text-white/75">{progress > 0 ? `Loading… ${Math.round(progress * 100)}%` : "Loading…"}</p>
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
