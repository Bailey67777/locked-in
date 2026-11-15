"use client";

import { useEffect, useRef, useState } from "react";
import { useHub } from "@/lib/hub/store";
import { useVault } from "@/lib/hub/useVault";
import { photoDays } from "@/lib/hub/model";
import { inCaptureOrder, preparePhoto, removePhoto, savePhoto, type Prepared } from "@/lib/hub/photos";
import { POSES, POSE_IDS } from "@/lib/hub/subjects";
import { dayTitle } from "@/lib/hub/time";
import { addDays } from "@/lib/dates";
import { haptic } from "@/lib/sounds";
import type { PoseId } from "@/lib/hub/types";
import { cn } from "@/lib/cn";
import { CameraIcon, CheckIcon, ChevronIcon, LockIcon } from "./Icons";
import PhotoTile from "./PhotoTile";
import PhotoViewer from "./PhotoViewer";
import PasscodeSheet from "./PasscodeSheet";
import CompareView from "./CompareView";
import RandomBody from "./RandomBody";
import WeightSheet from "./WeightSheet";

/** Five photos a day (face front, face side, body front, body side, back), locked with a passcode, to look back on. */
export default function HealthView() {
  const { data, today, write } = useHub();
  const vault = useVault();
  const [back, setBack] = useState(0);
  const date = addDays(today, -back);
  const day = data.photos[date] ?? {};
  const count = POSE_IDS.filter((p) => day[p]).length;
  const days = photoDays(data.photos);

  const [busy, setBusy] = useState<{ done: number; of: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [viewer, setViewer] = useState<PoseId | null>(null);
  const [passcode, setPasscode] = useState<"create" | "unlock" | null>(null);
  const [compare, setCompare] = useState(false);
  const [random, setRandom] = useState(false);
  const [weight, setWeight] = useState(false);
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

  const pickAll = () => {
    if (busy || !ready()) return;
    setError(null);
    many.current?.click();
  };
  const pickOne = (pose: PoseId) => {
    if (busy || !ready()) return;
    setError(null);
    target.current = pose;
    one.current?.click();
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
            <PhotoTile key={p.id} meta={day[p.id]} label={p.name} onClick={() => (day[p.id] ? (ready() ? setViewer(p.id) : undefined) : pickOne(p.id))} />
          ))}
          <button
            type="button"
            onClick={locked ? () => setPasscode("unlock") : pickAll}
            disabled={Boolean(busy) || vault.state === "checking"}
            className={cn("tap flex aspect-[3/4] w-full flex-col items-center justify-center gap-2 rounded-[14px] transition-colors", full && !busy ? "bg-surface text-ink" : "bg-ink text-bg")}
            aria-label={locked ? "Unlock photos" : full ? "All five photos are in. Upload again to replace them" : "Upload five photos"}
          >
            {locked ? <LockIcon width={22} height={22} /> : full && !busy ? <CheckIcon width={24} height={24} /> : <CameraIcon width={24} height={24} />}
            <span className="text-[14px] font-medium tracking-[-0.01em]">{locked ? "Unlock" : busy ? "Saving" : full ? "Done" : "Upload"}</span>
            <span className={cn("font-mono text-[11.5px] tabular-nums", full && !busy ? "text-muted" : "opacity-60")}>{busy ? `${busy.done}/${busy.of}` : `${count}/5`}</span>
          </button>
        </div>
        {error && <p className="mt-3 text-[13px] text-ink-2">{error}</p>}
      </section>

      <ul className="mt-8 divide-y divide-line border-y border-line">
        <li>
          <button type="button" onClick={() => (ready() ? setCompare(true) : undefined)} disabled={days.length < 2} className="tap flex w-full items-center justify-between py-4 text-left disabled:opacity-35">
            <span className="text-[17px] font-medium tracking-[-0.015em]">Compare</span>
            <ChevronIcon width={16} height={16} className="text-muted" />
          </button>
        </li>
        <li>
          <button type="button" onClick={() => (ready() ? setRandom(true) : undefined)} disabled={days.length < 1} className="tap flex w-full items-center justify-between py-4 text-left disabled:opacity-35">
            <span className="text-[17px] font-medium tracking-[-0.015em]">Random day</span>
            <span className="font-mono text-[12px] tabular-nums text-muted">{days.length}</span>
          </button>
        </li>
        <li>
          <button type="button" onClick={() => setWeight(true)} className="tap flex w-full items-center justify-between py-4 text-left">
            <span className="text-[17px] font-medium tracking-[-0.015em]">Weight</span>
            <span className="font-mono text-[13px] tabular-nums text-muted">{data.weights[date] ? `${data.weights[date]} kg` : "–"}</span>
          </button>
        </li>
      </ul>

      {viewer && <PhotoViewer date={date} pose={viewer} onClose={() => setViewer(null)} onReplace={pickOne} />}
      {passcode && <PasscodeSheet mode={passcode} onClose={() => setPasscode(null)} />}
      {compare && <CompareView onClose={() => setCompare(false)} />}
      {random && <RandomBody onClose={() => setRandom(false)} />}
      {weight && <WeightSheet date={date} onClose={() => setWeight(false)} />}
    </div>
  );
}
