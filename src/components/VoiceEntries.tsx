"use client";

import { useEffect, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { formatClock } from "@/lib/media";
import { cn } from "@/lib/cn";
import { PauseIcon, PlayIcon } from "./Icons";

type Entry = { id: string; at: number; dur: number; status?: string };

/** Only one recording plays at a time. */
let playing: HTMLAudioElement | null = null;

const timeOf = (at: number) => new Date(at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

/** A day's voice-journal recordings, oldest first, newest at the bottom. */
export function useVoiceEntries(date: string): Entry[] {
  const { data, voicePending } = useStore();
  const saved = Object.entries(data.days[date]?.voice ?? {}).map(([id, v]) => ({ id, at: v.at, dur: v.dur }));
  const pending = Object.entries(voicePending)
    .filter(([id, p]) => p.date === date && !saved.some((s) => s.id === id))
    .map(([id, p]) => ({ id, at: p.at, dur: p.dur, status: p.state === "waiting" ? "On this device · uploads when you're online" : `Saving ${Math.round((p.uploaded / Math.max(1, p.total)) * 100)}%` }));
  return [...saved, ...pending].sort((a, b) => a.at - b.at);
}

function Row({ date, entry, canDelete }: { date: string; entry: Entry; canDelete: boolean }) {
  const { loadVoice, removeVoice } = useStore();
  const audio = useRef<HTMLAudioElement>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [confirm, setConfirm] = useState(false);

  // Load it as soon as it's on screen, so tapping play starts straight away (iPhones only allow sound from a tap).
  useEffect(() => {
    let cancelled = false;
    let made: string | null = null;
    loadVoice(date, entry.id)
      .then((blob) => {
        if (cancelled) return;
        made = URL.createObjectURL(blob);
        setUrl(made);
      })
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : "Couldn't load this recording."));
    return () => {
      cancelled = true;
      if (made) URL.revokeObjectURL(made);
    };
  }, [date, entry.id, loadVoice]);

  const toggle = () => {
    const a = audio.current;
    if (!a || !url) return;
    if (!a.paused) return a.pause();
    if (playing && playing !== a) playing.pause();
    playing = a;
    a.play().catch(() => setIsPlaying(false));
  };

  return (
    <li className="py-3">
      <div className="flex items-center gap-3.5">
        <button
          type="button"
          onClick={toggle}
          disabled={!url}
          className={cn("tap flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors", isPlaying ? "bg-ink text-bg" : "bg-surface text-ink", !url && "opacity-40")}
          aria-label={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? <PauseIcon /> : <PlayIcon className="translate-x-[1px]" />}
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-[15px] tabular-nums">{timeOf(entry.at)}</span>
            <span className="font-mono text-[12px] tabular-nums text-muted">{isPlaying || progress > 0 ? `${formatClock(progress * entry.dur)} / ${formatClock(entry.dur)}` : formatClock(entry.dur)}</span>
          </div>
          <div className="mt-2 h-[2px] w-full overflow-hidden rounded-full bg-track">
            <div className="h-full rounded-full bg-ink" style={{ width: `${progress * 100}%` }} />
          </div>
          {(error || entry.status) && <div className="mt-1.5 text-[11.5px] text-muted">{error ?? entry.status}</div>}
        </div>
        {canDelete &&
          (confirm ? (
            <button
              type="button"
              className="h-8 shrink-0 rounded-full bg-ink px-3 text-[12px] font-medium text-bg"
              onClick={() => {
                audio.current?.pause();
                void removeVoice(date, entry.id);
              }}
            >
              Delete
            </button>
          ) : (
            <button type="button" className="h-8 shrink-0 px-1 text-[12px] text-muted" onClick={() => setConfirm(true)} aria-label={`Delete the recording from ${timeOf(entry.at)}`}>
              Delete
            </button>
          ))}
      </div>
      {url && (
        <audio
          ref={audio}
          src={url}
          preload="auto"
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onEnded={() => {
            setIsPlaying(false);
            setProgress(0);
          }}
          onTimeUpdate={(e) => {
            const a = e.currentTarget;
            const d = Number.isFinite(a.duration) && a.duration > 0 ? a.duration : entry.dur;
            if (d) setProgress(Math.min(1, a.currentTime / d));
          }}
        />
      )}
    </li>
  );
}

export default function VoiceEntries({ date, entries, canDelete = false }: { date: string; entries: Entry[]; canDelete?: boolean }) {
  if (!entries.length) return null;
  return (
    <ul className="divide-y divide-line">
      {entries.map((e) => (
        <Row key={e.id} date={date} entry={e} canDelete={canDelete} />
      ))}
    </ul>
  );
}
