"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { POSES } from "@/lib/hub/subjects";
import type { PoseId } from "@/lib/hub/types";
import { lockScroll } from "@/lib/scrollLock";
import { haptic, playCount, playShutter } from "@/lib/sounds";
import { cn } from "@/lib/cn";
import { CloseIcon, FlipIcon, LibraryIcon } from "./Icons";
import PoseOutline from "./PoseOutline";

/** How long the countdown can be, in seconds. Tapping the number moves to the next. */
const TIMERS = [3, 5, 10];
const TIMER_KEY = "locked-in:camera-timer:v1";

type Kind = "face" | "body";
const kindOf = (pose: PoseId): Kind => (pose.startsWith("face") ? "face" : "body");

/** A face is held at arm's length; a body shot needs time to step back from the phone. */
function savedTimers(): Record<Kind, number> {
  let saved: Partial<Record<Kind, number>> = {};
  try {
    saved = JSON.parse(localStorage.getItem(TIMER_KEY) ?? "{}") ?? {};
  } catch {
    /* the usual ones */
  }
  const ok = (n: unknown, otherwise: number) => (typeof n === "number" && TIMERS.includes(n) ? n : otherwise);
  return { face: ok(saved.face, 3), body: ok(saved.body, 10) };
}

function cameraMessage(e: unknown): string {
  const name = e instanceof DOMException ? e.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") return "The camera is switched off for this app.";
  return "No camera here.";
}

/**
 * The day's photos, taken one after another without leaving the camera: line up with the outline, tap, a countdown,
 * the picture; Submit keeps it and the next one is already waiting. The outline is the same every day, which is what
 * makes the photos sit over each other later. The picture kept is exactly what the frame showed.
 */
export default function CameraFlow({
  poses,
  sounds,
  onShot,
  onLibrary,
  onClose,
}: {
  poses: PoseId[];
  sounds: boolean;
  onShot: (pose: PoseId, shot: Blob) => void;
  onLibrary: (pose: PoseId) => void;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(0);
  const pose = poses[Math.min(index, poses.length - 1)];
  const name = POSES.find((p) => p.id === pose)?.name ?? "";
  const kind = kindOf(pose);

  const [facing, setFacing] = useState<"user" | "environment">("user");
  const [awake, setAwake] = useState(true);
  const [live, setLive] = useState(false);
  const [mirror, setMirror] = useState(true);
  const [problem, setProblem] = useState<string | null>(null);
  const [timers, setTimers] = useState(savedTimers);
  const [count, setCount] = useState<number | null>(null);
  const [flash, setFlash] = useState(false);
  const [shot, setShot] = useState<{ blob: Blob; url: string } | null>(null);
  const video = useRef<HTMLVideoElement>(null);
  const ticking = useRef<number | null>(null);
  const shotUrl = useRef<string | null>(null);

  // The camera, for as long as this is open and on screen. Turning it round starts it again.
  useEffect(() => {
    if (!awake) return;
    let gone = false;
    let stream: MediaStream | null = null;
    const el = video.current;
    void (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("no camera");
        stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: facing, width: { ideal: 1920 }, height: { ideal: 1080 } } });
        if (gone) return stream.getTracks().forEach((t) => t.stop());
        // The front camera shows you as a mirror does; so does a laptop's.
        setMirror(stream.getVideoTracks()[0]?.getSettings().facingMode !== "environment");
        setProblem(null);
        if (el) {
          el.srcObject = stream;
          await el.play().catch(() => undefined);
        }
      } catch (e) {
        if (!gone) setProblem(cameraMessage(e));
      }
    })();
    return () => {
      gone = true;
      stream?.getTracks().forEach((t) => t.stop());
      if (el) el.srcObject = null;
    };
  }, [facing, awake]);

  const stopCount = () => {
    if (ticking.current) window.clearInterval(ticking.current);
    ticking.current = null;
    setCount(null);
  };

  useEffect(() => {
    const unlock = lockScroll();
    let lock: WakeLockSentinel | null = null;
    navigator.wakeLock
      ?.request("screen")
      .then((l) => (lock = l))
      .catch(() => undefined);
    // Leaving the app lets go of the camera and calls off a countdown; coming back picks the camera up again.
    const onVisible = () => {
      const visible = document.visibilityState === "visible";
      if (!visible && ticking.current) {
        window.clearInterval(ticking.current);
        ticking.current = null;
        setCount(null);
      }
      setAwake(visible);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      unlock();
      lock?.release().catch(() => undefined);
      document.removeEventListener("visibilitychange", onVisible);
      if (ticking.current) window.clearInterval(ticking.current);
      if (shotUrl.current) URL.revokeObjectURL(shotUrl.current);
    };
  }, []);

  /** Keep the 3:4 middle of what the camera sees, which is exactly what the frame shows. */
  const snap = () => {
    const v = video.current;
    if (!v || !v.videoWidth || !v.videoHeight) return;
    const vw = v.videoWidth;
    const vh = v.videoHeight;
    const wide = vw / vh > 3 / 4;
    const sw = wide ? Math.round((vh * 3) / 4) : vw;
    const sh = wide ? vh : Math.round((vw * 4) / 3);
    const canvas = document.createElement("canvas");
    canvas.width = sw;
    canvas.height = sh;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    if (mirror) {
      ctx.translate(sw, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(v, (vw - sw) / 2, (vh - sh) / 2, sw, sh, 0, 0, sw, sh);
    if (sounds) playShutter();
    haptic(12);
    setFlash(true);
    window.setTimeout(() => setFlash(false), 140);
    canvas.toBlob(
      (blob) => {
        canvas.width = canvas.height = 0; // hand the memory back now; iOS is slow to take it
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        shotUrl.current = url;
        setShot({ blob, url });
      },
      "image/jpeg",
      0.95,
    );
  };

  /** The round button: start the countdown, or call it off. */
  const press = () => {
    if (count !== null) return stopCount();
    if (!live || shot) return;
    let left = timers[kind];
    setCount(left);
    if (sounds) playCount();
    haptic(8);
    ticking.current = window.setInterval(() => {
      left -= 1;
      if (left > 0) {
        setCount(left);
        if (sounds) playCount();
        return;
      }
      stopCount();
      snap();
    }, 1000);
  };

  const nextTimer = () => {
    const next = { ...timers, [kind]: TIMERS[(TIMERS.indexOf(timers[kind]) + 1) % TIMERS.length] };
    setTimers(next);
    try {
      localStorage.setItem(TIMER_KEY, JSON.stringify(next));
    } catch {
      /* it just won't be remembered */
    }
  };

  const drop = () => {
    const url = shot?.url;
    if (url) window.setTimeout(() => URL.revokeObjectURL(url), 1000); // after the picture has left the screen
    shotUrl.current = null;
    setShot(null);
  };

  const submit = () => {
    if (!shot) return;
    onShot(pose, shot.blob);
    haptic(10);
    drop();
    if (index + 1 < poses.length) setIndex(index + 1);
    else onClose();
  };

  const round = "tap flex h-11 w-11 items-center justify-center rounded-full bg-white/10";

  return createPortal(
    <div className="fixed inset-0 z-[70] flex flex-col bg-black text-white" role="dialog" aria-modal="true" aria-label={name}>
      <div className="pt-safe" />
      <div className="flex shrink-0 items-center justify-between px-4 py-3">
        <div className="min-w-0">
          <div className="truncate text-[16px] font-semibold tracking-[-0.01em]">{name}</div>
          <div className="font-mono text-[12px] tabular-nums text-white/55">
            {index + 1}/{poses.length}
          </div>
        </div>
        <button type="button" onClick={onClose} className="tap -mr-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10" aria-label="Close">
          <CloseIcon />
        </button>
      </div>

      <div className="flex min-h-0 flex-1 items-center justify-center [container-type:size]">
        <div className="relative aspect-[3/4] overflow-hidden bg-white/[0.06]" style={{ width: "min(100cqw, 75cqh)" }}>
          <video
            ref={video}
            playsInline
            muted
            autoPlay
            onPlaying={() => setLive(true)}
            onEmptied={() => setLive(false)}
            className={cn("absolute inset-0 h-full w-full object-cover", mirror && "-scale-x-100")}
          />
          {shot ? (
            // eslint-disable-next-line @next/next/no-img-element -- the picture just taken, held in memory
            <img src={shot.url} alt={name} className="absolute inset-0 h-full w-full object-cover" draggable={false} />
          ) : (
            <PoseOutline pose={pose} className="absolute inset-0 h-full w-full" />
          )}
          {!shot && count === null && (
            <button type="button" onClick={nextTimer} className="absolute right-3 top-3 h-9 min-w-[52px] rounded-full bg-black/45 px-3 font-mono text-[13px] tabular-nums" aria-label={`Countdown, ${timers[kind]} seconds. Tap to change`}>
              {timers[kind]}s
            </button>
          )}
          {/* Far from the phone the number has to be read across the room; up close it stays off the face. */}
          {count !== null && kind === "body" && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center font-mono text-[132px] font-medium tabular-nums [text-shadow:0_2px_28px_rgba(0,0,0,.5)]" aria-hidden="true">
              {count}
            </div>
          )}
          {problem && !shot && <p className="absolute inset-x-0 bottom-0 px-6 pb-5 text-center text-[13px] text-white/70">{problem}</p>}
          <div className={cn("pointer-events-none absolute inset-0 bg-white", flash ? "opacity-90" : "opacity-0 transition-opacity duration-300")} />
        </div>
      </div>

      <div className="flex h-[108px] shrink-0 items-center justify-between px-7">
        {shot ? (
          <>
            <button type="button" onClick={drop} className="h-11 w-[88px] text-left text-[15px] text-white/70">
              Retake
            </button>
            <button type="button" onClick={submit} className="tap h-[52px] rounded-full bg-white px-9 text-[16px] font-semibold tracking-[-0.01em] text-black">
              Submit
            </button>
            <span className="w-[88px]" />
          </>
        ) : (
          <>
            <button type="button" onClick={() => onLibrary(pose)} className={round} aria-label="Choose from your photos">
              <LibraryIcon />
            </button>
            <button
              type="button"
              onClick={press}
              disabled={!live && count === null}
              className="tap flex h-[72px] w-[72px] items-center justify-center rounded-full border-[3px] border-white p-[5px] disabled:opacity-35"
              aria-label={count === null ? "Take the photo" : "Stop the countdown"}
            >
              {count === null ? <span className="block h-full w-full rounded-full bg-white" /> : <span className="font-mono text-[28px] font-medium tabular-nums">{count}</span>}
            </button>
            <button type="button" onClick={() => setFacing((f) => (f === "user" ? "environment" : "user"))} disabled={count !== null} className={cn(round, "disabled:opacity-35")} aria-label="Turn the camera round">
              <FlipIcon />
            </button>
          </>
        )}
      </div>
      <div className="pb-safe" />
    </div>,
    document.body,
  );
}
