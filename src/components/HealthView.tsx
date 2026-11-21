"use client";

import { useEffect, useRef, useState } from "react";
import { useHub } from "@/lib/hub/store";
import { useStore } from "@/lib/store";
import { useVault } from "@/lib/hub/useVault";
import { photoDays } from "@/lib/hub/model";
import { inCaptureOrder, preparePhoto, removePhoto, savePhoto, type Prepared } from "@/lib/hub/photos";
import { POSES, POSE_IDS } from "@/lib/hub/subjects";
import { dayTitle } from "@/lib/hub/time";
import { sleepLength } from "@/lib/hub/whoop";
import { addDays } from "@/lib/dates";
import { haptic } from "@/lib/sounds";
import type { PoseId } from "@/lib/hub/types";
import { cn } from "@/lib/cn";
import { CameraIcon, CheckIcon, ChevronIcon, LockIcon } from "./Icons";

/** The one thing eaten that day that shouldn't have been. One line: there should only ever be one. */
function Goy({ date, today }: { date: string; today: string }) {
  const { data, write } = useHub();
  const saved = data.goy[date] ?? "";
  const [draft, setDraft] = useState<string | null>(null);
  const save = () => {
    if (draft === null) return;
    const text = draft.trim();
    if (text !== saved) write(`goy/${date}`, text || null);
    setDraft(null);
  };
  return (
    <label className="flex items-center gap-3 py-4">
      <span className="shrink-0 text-[17px] font-medium tracking-[-0.015em]">{date === today ? "Goy Eaten Today:" : "Goy Eaten:"}</span>
      <input
        value={draft ?? saved}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
        maxLength={60}
        enterKeyHint="done"
        placeholder="–"
        className="min-w-0 flex-1 bg-transparent text-right text-[17px] tracking-[-0.015em] text-ink placeholder:text-faint focus:outline-none"
        aria-label="Goy eaten"
      />
    </label>
  );
}
import PhotoTile from "./PhotoTile";
import PhotoViewer from "./PhotoViewer";
import CodeSheet from "./CodeSheet";
import RandomBody from "./RandomBody";
import CameraFlow from "./CameraFlow";

/**
 * Five photos a day (face front, face side, body front, body side, back), locked with a six-digit code, to look back
 * on. They're taken here, one after another, each inside the same outline every day.
 */
export default function HealthView() {
  const { data, today, write } = useHub();
  const vault = useVault();
  const [back, setBack] = useState(0);
  const date = addDays(today, -back);
  const day = data.photos[date] ?? {};
  const count = POSE_IDS.filter((p) => day[p]).length;
  const days = photoDays(data.photos);
  const whoop = data.whoop[date];

  const [busy, setBusy] = useState<{ done: number; of: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [viewer, setViewer] = useState<PoseId | null>(null);
  const [passcode, setPasscode] = useState<"create" | "unlock" | null>(null);
  const [random, setRandom] = useState(false);
  /** The photos the camera is open for, in the order it takes them. */
  const [camera, setCamera] = useState<PoseId[] | null>(null);
  const soundsOn = useStore().data.settings.soundsOn;
  /** Photos just taken are locked and stored one at a time, behind the camera, so it never waits. */
  const saving = useRef<Promise<void>>(Promise.resolve());
  // A note about the last upload goes away by itself.
  useEffect(() => {
    if (!error) return;
    const id = window.setTimeout(() => setError(null), 6000);
    return () => window.clearTimeout(id);
  }, [error]);
  const many = useRef<HTMLInputElement>(null);
  const one = useRef<HTMLInputElement>(null);
  const target = useRef<PoseId | null>(null);

  /** True when photos can be added right now; otherwise asks for the passcode first. */
  const ready = () => {
    if (vault.state === "open") return true;
    if (vault.state === "none") setPasscode("create");
    else if (vault.state === "locked") setPasscode("unlock");
    return false;
  };

  /** Open the camera: for the photos still missing, or for all five again once they're in. */
  const takeAll = () => {
    if (busy || !ready()) return;
    setError(null);
    const empty = POSE_IDS.filter((p) => !day[p]);
    setCamera(empty.length ? empty : POSE_IDS);
  };
  /** Open the camera on one photo: an empty one carries on through the empty ones after it; a replacement is just that one. */
  const takeOne = (pose: PoseId) => {
    if (busy || !ready()) return;
    setError(null);
    setCamera(day[pose] ? [pose] : POSE_IDS.filter((p) => p === pose || (!day[p] && POSE_IDS.indexOf(p) > POSE_IDS.indexOf(pose))));
  };
  /** From the camera, choose pictures already on the phone instead: all that are needed, or the one being replaced. */
  const pick = (pose: PoseId) => {
    const several = (camera?.length ?? 0) > 1;
    setCamera(null);
    if (several) return many.current?.click();
    target.current = pose;
    one.current?.click();
  };

  /** Keep a photo the camera just took. */
  const shoot = (pose: PoseId, shot: Blob) => {
    const key = vault.key;
    if (!key) return;
    const old = day[pose];
    const on = date;
    setBusy((b) => ({ done: b?.done ?? 0, of: (b?.of ?? 0) + 1 }));
    saving.current = saving.current.then(async () => {
      try {
        const meta = await savePhoto(key, await preparePhoto(shot));
        write(`photos/${on}/${pose}`, meta);
        if (old) void removePhoto(old.id);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't save that photo.");
      } finally {
        setBusy((b) => (b && b.done + 1 < b.of ? { done: b.done + 1, of: b.of } : null));
      }
    });
  };

  /** Shrink, lock and store the chosen photos, and put them on the day's poses. */
  const add = async (files: File[], only: PoseId | null) => {
    const key = vault.key;
    if (!key || !files.length) return;
    // A batch fills the empty poses in order; when all five are already there, it replaces them all.
    const empty = POSE_IDS.filter((p) => !day[p]);
    const slots = only ? [only] : empty.length ? empty : POSE_IDS;
    const chosen = files.slice(0, slots.length);
    setBusy({ done: 0, of: chosen.length });
    let failed = 0;
    try {
      const prepared: Prepared[] = [];
      for (const f of chosen) {
        try {
          prepared.push(await preparePhoto(f));
        } catch {
          failed++;
        }
      }
      const ordered = only ? prepared : inCaptureOrder(prepared);
      for (let i = 0; i < ordered.length; i++) {
        const meta = await savePhoto(key, ordered[i]);
        const old = day[slots[i]];
        write(`photos/${date}/${slots[i]}`, meta);
        if (old) void removePhoto(old.id);
        setBusy({ done: i + 1, of: ordered.length });
      }
      if (ordered.length) haptic(10);
      if (failed) setError(failed === 1 ? "One photo couldn't be opened." : `${failed} photos couldn't be opened.`);
      else if (files.length > slots.length) setError(`Only ${slots.length === 1 ? "one was" : `${slots.length} were`} needed, so the rest were left out.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save those photos.");
    } finally {
      setBusy(null);
    }
  };

  const locked = vault.state === "locked";
  const full = count === POSE_IDS.length;

  return (
    <div className="fade-up">
      <input
        ref={many}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = "";
          void add(files, null);
        }}
      />
      <input
        ref={one}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []).slice(0, 1);
          e.target.value = "";
          void add(files, target.current);
        }}
      />

      <header className="mb-7">
        <h1 className="text-[36px] font-bold leading-none tracking-[-0.04em]">Health</h1>
      </header>

      <section>
        <div className="flex h-8 items-center justify-between">
          <span className="text-[13px] text-muted">{dayTitle(date, today)}</span>
          <span className="-mr-2 flex items-center">
            <button type="button" onClick={() => setBack((n) => n + 1)} className="flex h-8 w-8 items-center justify-center text-muted" aria-label="The day before">
              <ChevronIcon dir="left" width={16} height={16} />
            </button>
            <button type="button" onClick={() => setBack((n) => Math.max(0, n - 1))} disabled={back === 0} className="flex h-8 w-8 items-center justify-center text-muted disabled:opacity-25" aria-label="The day after">
              <ChevronIcon width={16} height={16} />
            </button>
          </span>
        </div>

        <div className="mt-1 grid grid-cols-3 gap-2">
          {POSES.map((p) => (
            <PhotoTile key={p.id} meta={day[p.id]} label={p.name} pose={p.id} onClick={() => (day[p.id] ? (ready() ? setViewer(p.id) : undefined) : takeOne(p.id))} />
          ))}
          <button
            type="button"
            onClick={locked ? () => setPasscode("unlock") : takeAll}
            disabled={Boolean(busy) || vault.state === "checking"}
            className={cn("tap flex aspect-[3/4] w-full flex-col items-center justify-center gap-2 rounded-[14px] transition-colors", full && !busy ? "bg-surface text-ink" : "bg-ink text-bg")}
            aria-label={locked ? "Unlock photos" : full ? "All five photos are in. Take them again to replace them" : "Take the photos"}
          >
            {locked ? <LockIcon width={22} height={22} /> : full && !busy ? <CheckIcon width={24} height={24} /> : <CameraIcon width={24} height={24} />}
            <span className="text-[14px] font-medium tracking-[-0.01em]">{locked ? "Unlock" : busy ? "Saving" : full ? "Done" : "Take photos"}</span>
            <span className={cn("font-mono text-[11.5px] tabular-nums", full && !busy ? "text-muted" : "opacity-60")}>{busy ? `${busy.done}/${busy.of}` : `${count}/5`}</span>
          </button>
        </div>
        {error && <p className="mt-3 text-[13px] text-ink-2">{error}</p>}

        {/* The last two weeks at a glance: lit when all five were taken, outlined when some were. */}
        <div className="mt-5 flex items-center justify-between gap-3">
          <span className="shrink-0 whitespace-nowrap text-[13px] text-muted">Last 14 days</span>
          <span className="flex gap-1" role="img" aria-label="Which of the last 14 days have photos">
            {Array.from({ length: 14 }, (_, i) => addDays(today, i - 13)).map((d) => {
              const n = POSE_IDS.filter((p) => data.photos[d]?.[p]).length;
              return <span key={d} className={cn("h-3 w-3 rounded-[3.5px]", n === POSE_IDS.length ? "lit-bar bg-[var(--accent)]" : n ? "border-[1.5px] border-[var(--accent)]" : "bg-track", d === date && "ring-1 ring-ink ring-offset-2 ring-offset-bg")} />;
            })}
          </span>
        </div>
      </section>

      <ul className="mt-8 divide-y divide-line border-y border-line">
        <li>
          <button type="button" onClick={() => (ready() ? setRandom(true) : undefined)} disabled={days.length < 1} className="tap flex w-full items-center justify-between py-4 text-left disabled:opacity-35">
            <span className="text-[17px] font-medium tracking-[-0.015em]">Random day</span>
            <span className="font-mono text-[12px] tabular-nums text-muted">{days.length}</span>
          </button>
        </li>
        <li>
          <Goy key={date} date={date} today={today} />
        </li>
        {whoop?.recovery !== undefined && (
          <li className="flex items-center justify-between py-4">
            <span className="text-[17px] font-medium tracking-[-0.015em]">Recovery</span>
            <span className="font-mono text-[13px] tabular-nums text-ink-2">{whoop.recovery}%</span>
          </li>
        )}
        {whoop?.sleep !== undefined && (
          <li className="flex items-center justify-between py-4">
            <span className="text-[17px] font-medium tracking-[-0.015em]">Sleep</span>
            <span className="font-mono text-[13px] tabular-nums text-ink-2">{`${whoop.sleep}%${whoop.asleep ? ` · ${sleepLength(whoop.asleep)}` : ""}`}</span>
          </li>
        )}
      </ul>

      {viewer && <PhotoViewer date={date} pose={viewer} onClose={() => setViewer(null)} onReplace={takeOne} />}
      {passcode && <CodeSheet mode={passcode} onClose={() => setPasscode(null)} />}
      {random && <RandomBody onClose={() => setRandom(false)} />}
      {camera && <CameraFlow poses={camera} sounds={soundsOn} onShot={shoot} onLibrary={pick} onClose={() => setCamera(null)} />}
    </div>
  );
}
