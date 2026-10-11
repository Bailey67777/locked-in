"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useStore } from "@/lib/store";
import { formatBytes, formatClock } from "@/lib/model";
import { formatLong } from "@/lib/dates";
import { VLOG_AUDIO_BPS, VLOG_BUDGET_BYTES, VLOG_MAX_BYTES, VLOG_MAX_SECONDS, VLOG_VIDEO_BPS, recorderMimes, recorderSupported, storedSize, videoDuration } from "@/lib/vlog";
import { cn } from "@/lib/cn";
import { CloseIcon } from "./Icons";

type Props = { date: string; onClose: () => void };
type Phase = "starting" | "ready" | "recording" | "review" | "saving" | "blocked";
type Clip = { blob: Blob; url: string; dur: number };

/** Milliseconds on a steady clock. Only ever called from event handlers and timers, never while rendering. */
const clock = () => performance.now();

const PROMPTS = ["What you actually did today", "What you did for Oxford", "One win, and one thing to fix tomorrow"];

/** Dev only: a moving test card with a tone, so the whole record → save → play path can be tested without a camera. */
function fakeStream(): MediaStream {
  const canvas = document.createElement("canvas");
  canvas.width = 480;
  canvas.height = 640;
  const g = canvas.getContext("2d");
  let frame = 0;
  const draw = () => {
    if (!g) return;
    frame++;
    g.fillStyle = `hsl(${(frame * 3) % 360} 60% 45%)`;
    g.fillRect(0, 0, 480, 640);
    g.fillStyle = "#fff";
    g.font = "bold 44px sans-serif";
    g.fillText(`test ${frame}`, 40, 320);
  };
  draw();
  const timer = window.setInterval(draw, 60);
  const stream = canvas.captureStream(24);
  const ac = new window.AudioContext();
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  gain.gain.value = 0.05;
  const dest = ac.createMediaStreamDestination();
  osc.connect(gain).connect(dest);
  osc.start();
  window.addEventListener("pointerdown", () => void ac.resume(), { once: true, capture: true });
  dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
  stream.getVideoTracks()[0]?.addEventListener("ended", () => {
    window.clearInterval(timer);
    void ac.close();
  });
  return stream;
}

async function openCamera(): Promise<MediaStream> {
  if (process.env.NODE_ENV !== "production" && (window as unknown as { __lockedInDev?: { fakeCamera?: boolean } }).__lockedInDev?.fakeCamera) return fakeStream();
  if (!recorderSupported()) throw new Error("unsupported");
  return navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true },
    // Small on purpose: a talking-head vlog doesn't need more, and it keeps months of them inside the free storage.
    video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 24, max: 30 } },
  });
}

function cameraMessage(e: unknown): string {
  const name = e instanceof Error ? e.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") return "Camera or microphone access is blocked for this app. Allow it in your browser settings, or use the phone's camera below.";
  if (name === "NotFoundError" || name === "OverconstrainedError") return "No camera was found here. You can still add a clip with the button below.";
  return "The camera can't be started inside the app on this device. Use the phone's camera below instead.";
}

/**
 * Full-screen vlog recorder: live selfie preview, a few prompts, a timer, then a review step.
 * Saving stores the clip on this device straight away and uploads it in the background.
 */
export default function VlogRecorder({ date, onClose }: Props) {
  const { data, saveVlog } = useStore();
  const [phase, setPhase] = useState<Phase>("starting");
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [clip, setClip] = useState<Clip | null>(null);
  const preview = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const parts = useRef<Blob[]>([]);
  const startedAt = useRef(0);
  const alive = useRef(true);
  const fileInput = useRef<HTMLInputElement>(null);

  const used = useMemo(() => Object.values(data.days).reduce((n, d) => n + (d.vlog && d.date !== date ? storedSize(d.vlog.bytes) : 0), 0), [data.days, date]);
  const blockReason =
    used >= VLOG_BUDGET_BYTES ? `Your vlog storage is full (${formatBytes(used)}). Save some older vlogs to your device and delete them (Calendar → that day), then record this one.` : null;

  const stopCamera = useCallback(() => {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    if (preview.current) preview.current.srcObject = null;
  }, []);

  const startCamera = useCallback(async () => {
    try {
      const s = await openCamera();
      if (!alive.current) {
        s.getTracks().forEach((t) => t.stop());
        return;
      }
      stream.current = s;
      const el = preview.current;
      if (el) {
        el.srcObject = s;
        el.play().catch(() => undefined);
      }
      setPhase("ready");
    } catch (e) {
      if (!alive.current) return;
      setError(cameraMessage(e));
      setPhase("blocked");
    }
  }, []);

  useEffect(() => {
    alive.current = true;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const id = blockReason ? 0 : window.setTimeout(() => void startCamera(), 0);
    return () => {
      alive.current = false;
      window.clearTimeout(id);
      document.body.style.overflow = prev;
      const rec = recorder.current;
      if (rec && rec.state !== "inactive") {
        rec.onstop = null;
        rec.stop();
      }
      stopCamera();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the camera is opened once when the recorder appears
  }, []);

  useEffect(
    () => () => {
      if (clip) URL.revokeObjectURL(clip.url);
    },
    [clip],
  );

  const finish = useCallback(() => {
    const rec = recorder.current;
    if (rec && rec.state !== "inactive") rec.stop();
  }, []);

  // The clock while recording, and the hard stop at the limit.
  useEffect(() => {
    if (phase !== "recording") return;
    const id = window.setInterval(() => {
      const s = (clock() - startedAt.current) / 1000;
      setElapsed(s);
      if (s >= VLOG_MAX_SECONDS) finish();
    }, 250);
    let lock: WakeLockSentinel | null = null;
    navigator.wakeLock
      ?.request("screen")
      .then((l) => (lock = l))
      .catch(() => undefined);
    return () => {
      window.clearInterval(id);
      lock?.release().catch(() => undefined);
    };
  }, [phase, finish]);

  /** Start recording. If the browser's encoder for one format fails to start, the next format is tried automatically. */
  const begin = (attempt = 0) => {
    const s = stream.current;
    if (!s) return;
    setError(null);
    const mimes = recorderMimes();
    const mime = mimes[attempt] ?? "";
    const giveUp = () => {
      recorder.current = null;
      stopCamera();
      setError("This browser couldn't record video inside the app. Use the phone's camera below instead.");
      setPhase("blocked");
    };
    const retake = (message: string) => {
      setError(message);
      setPhase("starting");
      void startCamera();
    };
    try {
      const rec = new MediaRecorder(s, { ...(mime ? { mimeType: mime } : {}), videoBitsPerSecond: VLOG_VIDEO_BPS, audioBitsPerSecond: VLOG_AUDIO_BPS });
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
        const blob = new Blob(parts.current, { type: (rec.mimeType || mime || "video/mp4").split(";")[0] });
        parts.current = [];
        recorder.current = null;
        if (failed || blob.size < 2000) {
          // The encoder never got going. Try the next format on the same camera, or own up.
          if (attempt + 1 < mimes.length && stream.current) return begin(attempt + 1);
          return giveUp();
        }
        stopCamera();
        if (blob.size > VLOG_MAX_BYTES) return retake(`That came out at ${formatBytes(blob.size)}, which is too big to store. Try a shorter one.`);
        if (dur < 1.5) return retake("That was too short to keep. Have another go.");
        setClip({ blob, url: URL.createObjectURL(blob), dur });
        setPhase("review");
      };
      rec.start();
      recorder.current = rec;
      startedAt.current = clock();
      setElapsed(0);
      setPhase("recording");
    } catch {
      if (attempt + 1 < mimes.length) return begin(attempt + 1);
      giveUp();
    }
  };

  const redo = () => {
    setClip(null);
    setError(null);
    setPhase("starting");
    void startCamera();
  };

  const pickFile = async (file: File | undefined) => {
    if (fileInput.current) fileInput.current.value = "";
    if (!file) return;
    if (file.size > VLOG_MAX_BYTES) {
      setError(`That clip is ${formatBytes(file.size)}, which is too big to store. Keep it under about two minutes, or record it here instead.`);
      return;
    }
    setError(null);
    const dur = await videoDuration(file);
    stopCamera();
    // iPhone clips arrive as QuickTime; labelled as MP4 they also play on the laptop.
    const type = !file.type || file.type === "video/quicktime" ? "video/mp4" : file.type;
    const blob = file.slice(0, file.size, type);
    setClip({ blob, url: URL.createObjectURL(blob), dur });
    setPhase("review");
  };

  const save = async () => {
    if (!clip) return;
    setPhase("saving");
    setError(null);
    try {
      await saveVlog(date, clip.blob, clip.dur);
      onClose();
    } catch (e) {
      setPhase("review");
      setError(e instanceof Error && e.message ? e.message : "Couldn't save that. Try again.");
    }
  };

  const left = Math.max(0, VLOG_MAX_SECONDS - elapsed);
  const showPreview = phase === "starting" || phase === "ready" || phase === "recording";
  const pill = "tap rounded-full px-4 py-2 text-[13px] font-bold";

  return createPortal(
    <div className="fixed inset-0 z-[80] flex flex-col bg-[#0b0d10] text-white" role="dialog" aria-modal="true" aria-label="Record your vlog">
      <input ref={fileInput} type="file" accept="video/*" capture="user" className="hidden" onChange={(e) => void pickFile(e.target.files?.[0])} />
      <div className="pt-safe" />
      <div className="mx-auto flex w-full max-w-md items-center justify-between gap-3 px-4 pb-2 pt-4">
        <div className="min-w-0">
          <div className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-white/60">Vlog</div>
          <div className="truncate font-serif text-2xl leading-tight">{formatLong(date)}</div>
        </div>
        <button type="button" onClick={onClose} disabled={phase === "saving"} className="tap flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-white/15 px-3 text-[13px] font-bold text-white disabled:opacity-40" aria-label="Close without saving">
          <CloseIcon width={15} height={15} /> {phase === "recording" || phase === "review" ? "Discard" : "Not now"}
        </button>
      </div>

      <div className="relative flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-3">
        {blockReason ? (
          <div className="max-w-sm rounded-2xl bg-white/10 p-5 text-center">
            <p className="text-[15px] font-bold leading-relaxed">{blockReason}</p>
            <button type="button" className={cn(pill, "mt-4 bg-white text-black")} onClick={onClose}>
              OK
            </button>
          </div>
        ) : (
          <>
            <div className={cn("relative min-h-0 w-full max-w-md flex-1 overflow-hidden rounded-3xl bg-black", !showPreview && "hidden")}>
              <video ref={preview} muted playsInline autoPlay className="h-full w-full -scale-x-100 object-cover" />
              {phase === "starting" && <div className="absolute inset-0 flex items-center justify-center text-[13px] font-bold text-white/70">Starting the camera…</div>}
              {phase === "recording" && (
                <div className="absolute left-3 top-3 flex items-center gap-2 rounded-full bg-black/55 px-3 py-1.5 font-mono text-[12.5px] tabular-nums">
                  <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-500" />
                  {formatClock(elapsed)}
                  <span className={cn("text-white/60", left <= 20 && "text-sunset-300")}>· {formatClock(left)} left</span>
                </div>
              )}
              {(phase === "ready" || phase === "recording") && (
                <div className="absolute inset-x-3 bottom-3 rounded-2xl bg-black/50 px-3.5 py-2.5 backdrop-blur-sm">
                  <div className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-white/60">Talk through</div>
                  <ul className="mt-1 font-serif text-[16px] leading-snug">
                    {PROMPTS.map((p) => (
                      <li key={p}>{p}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {phase === "blocked" && (
              <div className="max-w-sm rounded-2xl bg-white/10 p-5 text-center">
                <p className="text-[15px] font-bold leading-relaxed">{error}</p>
              </div>
            )}

            {(phase === "review" || phase === "saving") && clip && (
              <div className="flex min-h-0 w-full max-w-md flex-1 flex-col">
                <video src={clip.url} controls playsInline className="min-h-0 w-full flex-1 rounded-3xl bg-black object-contain" />
                <p className="mt-2 text-center font-mono text-[11px] text-white/60">
                  {clip.dur > 0 ? `${formatClock(clip.dur)} · ` : ""}
                  {formatBytes(clip.blob.size)}
                </p>
              </div>
            )}
          </>
        )}
      </div>

      {!blockReason && (
        <div className="flex flex-col items-center gap-2 px-4 pb-3 pt-3">
          {error && phase !== "blocked" && <p className="max-w-md text-center text-[13px] font-bold text-sunset-300">{error}</p>}
          {(phase === "ready" || phase === "starting") && (
            <button type="button" onClick={() => begin()} disabled={phase !== "ready"} className="tap flex h-[72px] w-[72px] items-center justify-center rounded-full border-4 border-white bg-red-500 disabled:opacity-40" aria-label="Start recording">
              <span className="h-6 w-6 rounded-full bg-white/90" />
            </button>
          )}
          {phase === "recording" && (
            <button type="button" onClick={finish} className="tap flex h-[72px] w-[72px] items-center justify-center rounded-full border-4 border-white bg-white/10" aria-label="Stop recording">
              <span className="h-6 w-6 rounded-md bg-red-500" />
            </button>
          )}
          {(phase === "review" || phase === "saving") && (
            <div className="flex w-full max-w-md gap-2">
              <button type="button" onClick={redo} disabled={phase === "saving"} className={cn(pill, "flex-1 bg-white/15 py-3 text-white disabled:opacity-40")}>
                Redo
              </button>
              <button type="button" onClick={() => void save()} disabled={phase === "saving"} className={cn(pill, "flex-[2] bg-white py-3 text-black disabled:opacity-60")}>
                {phase === "saving" ? "Saving…" : "Save vlog"}
              </button>
            </div>
          )}
          {phase === "ready" && <p className="text-[12px] text-white/55">Up to {Math.round(VLOG_MAX_SECONDS / 60)} minutes. Tap the red button to start.</p>}
          {(phase === "ready" || phase === "blocked") && (
            <button type="button" onClick={() => fileInput.current?.click()} className={cn(pill, phase === "blocked" ? "bg-white text-black" : "text-white/65 underline")}>
              {phase === "blocked" ? "Use the phone's camera" : "Use the phone's camera instead"}
            </button>
          )}
        </div>
      )}
      <div className="pb-safe" />
    </div>,
    document.body,
  );
}
