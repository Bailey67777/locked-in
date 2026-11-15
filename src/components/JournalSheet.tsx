"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useStore } from "@/lib/store";
import { formatLong } from "@/lib/dates";
import { formatClock } from "@/lib/media";
import { VOICE_BPS, VOICE_MAX_SECONDS, recorderSupported, voiceMimes } from "@/lib/voice";
import { cn } from "@/lib/cn";
import { CloseIcon } from "./Icons";
import VoiceEntries, { useVoiceEntries } from "./VoiceEntries";
import { lockScroll } from "@/lib/scrollLock";

type Phase = "idle" | "starting" | "recording" | "saving";

const BARS = 36;
/** A steady clock, only read from handlers and timers (never while rendering). */
const clock = () => performance.now();

function micMessage(e: unknown): string {
  const name = e instanceof Error ? e.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") return "Microphone access is off for this app. Turn it on in your browser's settings, then try again.";
  if (name === "NotFoundError") return "No microphone found.";
  return "The microphone couldn't start here. Try again, or reopen the app.";
}

/** The voice journal for one day: tap, talk, tap again. It saves itself. */
export default function JournalSheet({ date, onClose }: { date: string; onClose: () => void }) {
  const { saveVoice } = useStore();
  const entries = useVoiceEntries(date);
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [levels, setLevels] = useState<number[]>(() => Array(BARS).fill(0));
  const stream = useRef<MediaStream | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const parts = useRef<Blob[]>([]);
  const startedAt = useRef(0);
  const meter = useRef<{ ctx: AudioContext; raf: number } | null>(null);
  const alive = useRef(true);
  const list = useRef<HTMLDivElement>(null);

  const cleanup = useCallback(() => {
    if (meter.current) {
      cancelAnimationFrame(meter.current.raf);
      void meter.current.ctx.close().catch(() => undefined);
      meter.current = null;
    }
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
  }, []);

  const stop = useCallback(() => {
    const rec = recorder.current;
    if (rec && rec.state !== "inactive") rec.stop();
  }, []);

  /** Watch the microphone level so the bars move while you talk. */
  const startMeter = (s: MediaStream) => {
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      const ctx = new AC();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      ctx.createMediaStreamSource(s).connect(analyser);
      const data = new Uint8Array(analyser.fftSize);
      let last = 0;
      const tick = (now: number) => {
        if (!meter.current) return;
        meter.current.raf = requestAnimationFrame(tick);
        if (now - last < 70) return;
        last = now;
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (const v of data) sum += ((v - 128) / 128) ** 2;
        const level = Math.min(1, Math.sqrt(sum / data.length) * 4.5);
        setLevels((l) => [...l.slice(1), level]);
      };
      meter.current = { ctx, raf: requestAnimationFrame(tick) };
    } catch {
      /* no meter, recording still works */
    }
  };

  const begin = async (attempt = 0) => {
    setError(null);
    if (!recorderSupported()) return setError("This browser can't record audio.");
    setPhase("starting");
    try {
      if (!stream.current) stream.current = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    } catch (e) {
      cleanup();
      setPhase("idle");
      return setError(micMessage(e));
    }
    if (!alive.current) return cleanup();
    const s = stream.current;
    const mimes = voiceMimes();
    const mime = mimes[attempt] ?? "";
    try {
      const rec = new MediaRecorder(s, { ...(mime ? { mimeType: mime } : {}), audioBitsPerSecond: VOICE_BPS });
      let failed = false;
      parts.current = [];
      rec.ondataavailable = (e) => {
        if (e.data && e.data.size) parts.current.push(e.data);
      };
      rec.onerror = () => {
        failed = true;
      };
      rec.onstop = () => {
        const dur = (clock() - startedAt.current) / 1000;
        const blob = new Blob(parts.current, { type: (rec.mimeType || mime || "audio/mp4").split(";")[0] });
        parts.current = [];
        recorder.current = null;
        if ((failed || blob.size < 500) && attempt + 1 < mimes.length && stream.current) return void begin(attempt + 1);
        cleanup();
        setLevels(Array(BARS).fill(0));
        if (failed || blob.size < 500) {
          setPhase("idle");
          return setError("That didn't record. Try again.");
        }
        if (dur < 1) {
          setPhase("idle");
          return setError("Too short to keep.");
        }
        setPhase("saving");
        saveVoice(date, blob, dur)
          .catch((err) => setError(err instanceof Error ? err.message : "Couldn't save that recording."))
          .finally(() => {
            if (!alive.current) return;
            setPhase("idle");
            window.setTimeout(() => list.current?.scrollTo({ top: list.current.scrollHeight, behavior: "smooth" }), 50);
          });
      };
      rec.start(1000); // hand over data every second, so an interruption still keeps what was said
      recorder.current = rec;
      startedAt.current = clock();
      setElapsed(0);
      if (attempt === 0) startMeter(s);
      setPhase("recording");
    } catch {
      if (attempt + 1 < mimes.length) return void begin(attempt + 1);
      cleanup();
      setPhase("idle");
      setError("This browser couldn't record audio.");
    }
  };

  // The clock, the hard stop at the limit, the screen kept awake, and a save if the app goes into the background.
  useEffect(() => {
    if (phase !== "recording") return;
    const id = window.setInterval(() => {
      const s = (clock() - startedAt.current) / 1000;
      setElapsed(s);
      if (s >= VOICE_MAX_SECONDS) stop();
    }, 250);
    let lock: WakeLockSentinel | null = null;
    navigator.wakeLock
      ?.request("screen")
      .then((l) => (lock = l))
      .catch(() => undefined);
    const onHide = () => document.visibilityState === "hidden" && stop();
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onHide);
      lock?.release().catch(() => undefined);
    };
  }, [phase, stop]);

  useEffect(() => {
    alive.current = true;
    const unlock = lockScroll();
    return () => {
      alive.current = false;
      unlock();
      // Closing while recording still saves it; otherwise just let go of the microphone.
      const rec = recorder.current;
      if (rec && rec.state !== "inactive") rec.stop();
      else cleanup();
    };
  }, [cleanup]);

  const close = () => {
    if (phase === "recording") stop();
    onClose();
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40"
      onClick={(e) => {
        e.stopPropagation();
        if (e.target === e.currentTarget && phase !== "recording") onClose();
      }}
    >
      <div className="sheet-up flex max-h-[88dvh] w-full max-w-[520px] flex-col rounded-t-[22px] bg-bg" role="dialog" aria-modal="true" aria-label="Journal">
        <div className="flex items-start justify-between px-5 pt-5">
          <div>
            <div className="label">{formatLong(date)}</div>
            <div className="mt-1.5 text-[22px] font-semibold tracking-[-0.03em]">Journal</div>
          </div>
          <button type="button" className="tap -mr-2 flex h-9 w-9 items-center justify-center rounded-full text-ink-2" onClick={close} aria-label="Close">
            <CloseIcon />
          </button>
        </div>

        <div ref={list} className="min-h-0 flex-1 overflow-y-auto px-5">
          {entries.length ? (
            <div className="mt-3">
              <VoiceEntries date={date} entries={entries} canDelete />
            </div>
          ) : null}
        </div>

        <div className="flex flex-col items-center px-5 pb-safe pt-5">
          <div className="flex h-9 w-full items-center justify-center gap-[3px]" aria-hidden="true">
            {levels.map((l, i) => (
              <span key={i} className={cn("w-[3px] rounded-full transition-[height] duration-75", phase === "recording" ? "bg-ink" : "bg-faint")} style={{ height: `${Math.max(3, l * 36)}px` }} />
            ))}
          </div>
          <div className="mt-2 font-mono text-[13px] tabular-nums text-ink-2">{phase === "recording" ? formatClock(elapsed) : phase === "saving" ? "Saving" : phase === "starting" ? "…" : formatClock(0)}</div>
          <button
            type="button"
            onClick={() => (phase === "recording" ? stop() : phase === "idle" ? void begin() : undefined)}
            disabled={phase === "starting" || phase === "saving"}
            className="tap mb-5 mt-4 flex h-[68px] w-[68px] items-center justify-center rounded-full border-[1.5px] border-ink disabled:opacity-40"
            aria-label={phase === "recording" ? "Stop recording" : "Start recording"}
          >
            <span className={cn("bg-ink transition-all duration-200", phase === "recording" ? "h-6 w-6 rounded-[5px]" : "h-[52px] w-[52px] rounded-full")} />
          </button>
          {error && <p className="-mt-2 mb-4 max-w-xs text-center text-[12.5px] text-ink-2">{error}</p>}
        </div>
      </div>
    </div>,
    document.body,
  );
}
