"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { TierId } from "@/lib/types";
import { tierById } from "@/lib/model";
import { CloseIcon } from "./Icons";

const EXTENSIONS = ["mp4", "mov", "m4v", "webm"];

type Props = { tier: TierId; pct: number; keystoneMissed: boolean; onClose: () => void };

/**
 * Full-screen player for the video that goes with a submitted day's tier.
 * Videos live in /public/media (day-80-100.mp4, day-50-80.mp4, day-25-50.mp4, day-0-25.mp4); any length.
 * A missing 25–50 video falls back to the 0–25 one.
 */
export default function RewardVideo({ tier, pct, keystoneMissed, onClose }: Props) {
  const info = tierById(tier);
  const candidates = useMemo(() => {
    const bases = tier === "t25" ? [info.file, tierById("t0").file] : [info.file];
    return bases.flatMap((b) => EXTENSIONS.map((ext) => `/media/${b}.${ext}`));
  }, [tier, info.file]);
  const [index, setIndex] = useState(0);
  const [needsTap, setNeedsTap] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const missing = index >= candidates.length;

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

  const tryPlay = () => {
    const el = video.current;
    if (!el) return;
    el.play().then(
      () => setNeedsTap(false),
      () => setNeedsTap(true), // the browser wants a tap first (common on iPhone)
    );
  };

  return createPortal(
    <div className="fixed inset-0 z-[70] flex flex-col bg-ocean-900/95 backdrop-blur" role="dialog" aria-modal="true" aria-label={`${info.label} video`}>
      <div className="flex items-center justify-between gap-3 px-4 pb-2 pt-4 text-white">
        <div className="min-w-0">
          <div className="text-xs font-extrabold uppercase tracking-[0.14em] text-white/70">
            Day submitted · {pct}%{keystoneMissed ? " · must-do missed" : ""}
          </div>
          <div className="truncate text-xl font-extrabold">
            {info.emoji} {info.label}
          </div>
        </div>
        <button type="button" onClick={onClose} className="tap flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/15 text-white" aria-label="Close">
          <CloseIcon />
        </button>
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center p-3">
        {missing ? (
          <div className="max-w-md rounded-3xl bg-white/10 p-6 text-center text-white">
            <div className="text-5xl">{info.emoji}</div>
            <p className="mt-3 text-lg font-extrabold">{info.blurb}</p>
            <p className="mt-3 text-sm font-semibold text-white/80">
              No video uploaded for this tier yet. Add <code className="rounded bg-white/15 px-1">public/media/{info.file}.mp4</code> on GitHub and it will play here.
            </p>
          </div>
        ) : (
          <>
            <video
              key={candidates[index]}
              ref={video}
              src={candidates[index]}
              controls
              playsInline
              autoPlay
              onLoadedData={tryPlay}
              onError={() => setIndex((i) => i + 1)}
              className="max-h-full max-w-full rounded-2xl bg-black shadow-lift"
            />
            {needsTap && (
              <button type="button" onClick={tryPlay} className="tap absolute rounded-full bg-white px-8 py-4 text-lg font-extrabold text-ocean-900 shadow-lift">
                ▶ Play
              </button>
            )}
          </>
        )}
      </div>
      <div className="pb-safe" />
    </div>,
    document.body,
  );
}
