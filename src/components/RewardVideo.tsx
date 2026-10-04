"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { REWARD_FILE } from "@/lib/model";
import { formatLong } from "@/lib/dates";
import { CloseIcon } from "./Icons";

const EXTENSIONS = ["mp4", "mov", "m4v", "webm"];

type Props = {
  date: string;
  pct: number;
  onWatched: () => void;
  onClose: () => void;
};

/**
 * Full-screen player for the reward video (public/media/day-80-100.mp4). Close it whenever you like:
 * once it has started playing it counts as seen. If it can't load (offline, not uploaded) it stays owed
 * and plays next time the app opens.
 */
export default function RewardVideo({ date, pct, onWatched, onClose }: Props) {
  const candidates = useMemo(() => EXTENSIONS.map((ext) => `/media/${REWARD_FILE}.${ext}`), []);
  const [index, setIndex] = useState(0);
  const [needsTap, setNeedsTap] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [started, setStarted] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const reported = useRef(false);
  const missing = index >= candidates.length;

  const markWatched = () => {
    if (reported.current) return;
    reported.current = true;
    onWatched();
  };

  const close = () => {
    if (started) markWatched();
    onClose();
  };
  const closeRef = useRef(close);
  useEffect(() => {
    closeRef.current = close;
  });

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeRef.current();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  const tryPlay = () => {
    const el = video.current;
    if (!el) return;
    el.play().then(
      () => {
        setNeedsTap(false);
        setPlaying(true);
        setStarted(true);
      },
      () => setNeedsTap(true), // the browser wants a tap first (common on iPhone)
    );
  };

  const toggle = () => {
    const el = video.current;
    if (!el) return;
    if (el.paused) tryPlay();
    else el.pause();
  };

  return createPortal(
    <div className="fixed inset-0 z-[70] flex flex-col bg-black/90 backdrop-blur-xl" role="dialog" aria-modal="true" aria-label="Reward video">
      <div className="pt-safe" />
      <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 px-4 pb-2 pt-4 text-white">
        <div className="min-w-0">
          <div className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-white/60">
            {formatLong(date)} · {pct}%
          </div>
          <div className="font-serif text-2xl leading-tight">✨ Locked in</div>
        </div>
        <button type="button" onClick={close} className="tap flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15 text-white" aria-label="Close">
          <CloseIcon width={18} height={18} />
        </button>
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center p-3">
        {missing ? (
          <div className="max-w-sm rounded-2xl bg-white/10 p-5 text-center text-white">
            <p className="text-[15px] font-bold">The video couldn&apos;t load.</p>
            <p className="mt-2 text-[13px] text-white/70">
              It lives at <code className="rounded bg-white/15 px-1">public/media/{REWARD_FILE}.mp4</code>. If you&apos;re offline, it&apos;ll play next time you open the app.
            </p>
            <div className="mt-4 flex justify-center gap-2">
              <button type="button" onClick={() => setIndex(0)} className="tap rounded-full bg-white px-4 py-2 text-[13px] font-bold text-black">
                Try again
              </button>
              <button type="button" onClick={onClose} className="tap rounded-full bg-white/15 px-4 py-2 text-[13px] font-bold text-white">
                Not now
              </button>
            </div>
          </div>
        ) : (
          <div className="relative flex max-h-full w-full max-w-3xl flex-col">
            <video
              key={candidates[index]}
              ref={video}
              src={candidates[index]}
              playsInline
              autoPlay
              preload="auto"
              controlsList="nodownload noremoteplayback"
              onLoadedData={tryPlay}
              onPlay={() => {
                setPlaying(true);
                setStarted(true);
              }}
              onPause={() => setPlaying(false)}
              onTimeUpdate={() => {
                const el = video.current;
                if (el?.duration) setProgress(el.currentTime / el.duration);
              }}
              onEnded={() => {
                setPlaying(false);
                setProgress(1);
                markWatched();
              }}
              onError={() => setIndex((i) => i + 1)}
              onClick={toggle}
              className="max-h-[72vh] w-full rounded-2xl bg-black object-contain"
            />
            {needsTap && (
              <button type="button" onClick={tryPlay} className="tap absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white px-6 py-3 text-[15px] font-bold text-black shadow-lift">
                ▶ Play
              </button>
            )}
            <div className="mt-3 flex items-center gap-3 px-1">
              <button type="button" onClick={toggle} className="tap flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/15 text-[11px] text-white" aria-label={playing ? "Pause" : "Play"}>
                {playing ? "❚❚" : "▶"}
              </button>
              <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/20" aria-hidden="true">
                <div className="h-full rounded-full bg-white transition-[width] duration-300" style={{ width: `${Math.round(progress * 100)}%` }} />
              </div>
            </div>
          </div>
        )}
      </div>
      <div className="pb-safe" />
    </div>,
    document.body,
  );
}
