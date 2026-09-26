"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { TierId } from "@/lib/types";
import { tierById } from "@/lib/model";
import { formatLong } from "@/lib/dates";
import { cn } from "@/lib/cn";
import { CloseIcon } from "./Icons";

const EXTENSIONS = ["mp4", "mov", "m4v", "webm"];

type Props = {
  date: string;
  tier: TierId;
  pct: number;
  keystoneMissed: boolean;
  /** Must be watched to the end: no close button, no skipping, until it finishes. */
  required: boolean;
  onWatched: () => void;
  onClose: () => void;
};

/**
 * Full-screen player for a submitted day's tier video (public/media/day-80-100.mp4 etc).
 * When `required`, the only way out is to watch the whole thing: seeking forward is snapped back,
 * playback speed is pinned, and the close button appears only once the video has ended.
 * A tier with no video uploaded counts as watched, so nothing can get stuck.
 */
export default function RewardVideo({ date, tier, pct, keystoneMissed, required, onWatched, onClose }: Props) {
  const info = tierById(tier);
  const candidates = useMemo(() => {
    const bases = tier === "t25" ? [info.file, tierById("t0").file] : [info.file];
    return bases.flatMap((b) => EXTENSIONS.map((ext) => `/media/${b}.${ext}`));
  }, [tier, info.file]);
  const [index, setIndex] = useState(0);
  const [needsTap, setNeedsTap] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [ended, setEnded] = useState(false);
  const [progress, setProgress] = useState(0);
  const [started, setStarted] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const maxPlayed = useRef(0);
  const reported = useRef(false);
  const missing = index >= candidates.length;
  const canClose = !required || ended || missing;

  const markWatched = useCallback(() => {
    if (reported.current) return;
    reported.current = true;
    onWatched();
  }, [onWatched]);

  // Nothing to watch: count it as watched straight away so the day can't get stuck.
  useEffect(() => {
    if (missing && required) markWatched();
  }, [missing, required, markWatched]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && canClose) onClose();
    };
    window.addEventListener("keydown", onKey);
    // Take over the whole screen where the browser allows it (not on iPhone, where the overlay already fills the page).
    const root = document.documentElement;
    if (required && root.requestFullscreen && !document.fullscreenElement) root.requestFullscreen().catch(() => undefined);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
      if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => undefined);
    };
  }, [canClose, onClose, required]);

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
    if (!el || ended) return;
    if (el.paused) tryPlay();
    else {
      el.pause();
      setPlaying(false);
    }
  };

  const guardSeek = () => {
    const el = video.current;
    if (!el || !required || ended) return;
    if (el.currentTime > maxPlayed.current + 0.75) el.currentTime = maxPlayed.current; // no skipping ahead
  };

  return createPortal(
    <div className="fixed inset-0 z-[70] flex flex-col bg-ocean-900/95 backdrop-blur" role="dialog" aria-modal="true" aria-label={`${info.label} video`}>
      <div className="flex items-center justify-between gap-3 px-4 pb-2 pt-4 text-white">
        <div className="min-w-0">
          <div className="text-xs font-extrabold uppercase tracking-[0.14em] text-white/70">
            {formatLong(date)} · {pct}%{keystoneMissed ? " · must-do missed" : ""}
          </div>
          <div className="truncate text-xl font-extrabold">
            {info.emoji} {info.label}
          </div>
        </div>
        {canClose ? (
          <button type="button" onClick={onClose} className="tap flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/15 text-white" aria-label="Close">
            <CloseIcon />
          </button>
        ) : (
          <span className="shrink-0 rounded-full bg-white/15 px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-wider text-white/80">Watch to the end</span>
        )}
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
          <div className="relative flex max-h-full w-full max-w-3xl flex-col">
            <video
              key={candidates[index]}
              ref={video}
              src={candidates[index]}
              playsInline
              autoPlay
              preload="auto"
              disablePictureInPicture
              controlsList="nodownload noplaybackrate noremoteplayback"
              onLoadedData={tryPlay}
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
              onSeeking={guardSeek}
              onRateChange={() => {
                if (video.current && video.current.playbackRate !== 1) video.current.playbackRate = 1;
              }}
              onTimeUpdate={() => {
                const el = video.current;
                if (!el) return;
                if (el.currentTime > maxPlayed.current + 0.75 && required && !ended) {
                  el.currentTime = maxPlayed.current;
                  return;
                }
                if (el.currentTime > maxPlayed.current) maxPlayed.current = el.currentTime;
                if (el.duration) setProgress(el.currentTime / el.duration);
              }}
              onEnded={() => {
                setEnded(true);
                setPlaying(false);
                setProgress(1);
                markWatched();
              }}
              onError={() => setIndex((i) => i + 1)}
              onClick={toggle}
              className="max-h-[70vh] w-full rounded-2xl bg-black object-contain shadow-lift"
            />
            {(needsTap || (!playing && !ended)) && (
              <button type="button" onClick={tryPlay} className="tap absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white px-8 py-4 text-lg font-extrabold text-ocean-900 shadow-lift">
                ▶ {started ? "Resume" : "Play"}
              </button>
            )}
            <div className="mt-3 flex items-center gap-3 px-1">
              <button type="button" onClick={toggle} disabled={ended} className="tap flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/15 text-white disabled:opacity-40" aria-label={playing ? "Pause" : "Play"}>
                {playing ? "❚❚" : "▶"}
              </button>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/20" aria-hidden="true">
                <div className={cn("h-full rounded-full transition-[width] duration-300", ended ? "bg-teal-400" : "bg-white")} style={{ width: `${Math.round(progress * 100)}%` }} />
              </div>
              <span className="w-10 text-right text-xs font-extrabold tabular-nums text-white/80">{Math.round(progress * 100)}%</span>
            </div>
            {ended ? (
              <p className="mt-2 text-center text-sm font-bold text-teal-300">Watched. You can close it now.</p>
            ) : (
              required && <p className="mt-2 text-center text-xs font-semibold text-white/70">Pausing is fine. Skipping isn&apos;t. If you leave before the end, it plays again next time you open the app.</p>
            )}
          </div>
        )}
      </div>
      <div className="pb-safe" />
    </div>,
    document.body,
  );
}
