"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { missedKeystones, tierById, tierFor } from "@/lib/model";
import { haptic } from "@/lib/sounds";
import { cn } from "@/lib/cn";
import { LockIcon } from "./Icons";
import RewardVideo from "./RewardVideo";
import Confetti from "./Confetti";

const TONE: Record<string, string> = { t80: "bg-teal-100 text-teal-700", t50: "bg-ocean-100 text-ocean-800", t25: "bg-sunset-100 text-sunset-700", t0: "bg-sunset-200 text-sunset-700" };

/** Finalise the day: lock the ticks, work out the tier, play that tier's video. */
export default function SubmitDay({ date }: { date: string }) {
  const { data, getDay, updateDay } = useStore();
  const day = getDay(date);
  const settings = data.settings;
  const [confirming, setConfirming] = useState(false);
  const [showing, setShowing] = useState(false);
  const [party, setParty] = useState(false);

  const preview = tierFor(day, settings);
  const missed = missedKeystones(day, settings);
  const sub = day.submitted;

  const submit = () => {
    const result = tierFor(day, settings);
    updateDay(date, (d) => ({ ...d, submitted: { at: Date.now(), pct: result.pct, tier: result.tier, keystoneMissed: result.keystoneMissed } }));
    setConfirming(false);
    setShowing(true);
    haptic(result.tier === "t80" ? [20, 60, 20, 60, 40] : 30);
    if (result.tier === "t80") {
      setParty(true);
      window.setTimeout(() => setParty(false), 2600);
    }
  };

  const reopen = () =>
    updateDay(date, (d) => {
      const next = { ...d };
      delete next.submitted;
      return next;
    });

  if (sub) {
    const info = tierById(sub.tier);
    return (
      <section className={cn("card p-4 md:p-5")}>
        {party && <Confetti />}
        <div className="flex items-center gap-3">
          <span className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-2xl", TONE[sub.tier])}>{info.emoji}</span>
          <div className="min-w-0 flex-1">
            <div className="label flex items-center gap-1">
              <LockIcon width={12} height={12} /> Day submitted
            </div>
            <div className="text-lg font-extrabold leading-tight text-ink">
              {sub.pct}% · {info.label}
            </div>
            <div className="text-sm font-semibold text-ink-muted">{sub.keystoneMissed ? "The must-do habit was missed, so it's straight to the bottom tier." : info.blurb}</div>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" className="btn-primary flex-1" onClick={() => setShowing(true)}>
            ▶ Watch the video
          </button>
          <button type="button" className="btn-ghost" onClick={reopen}>
            Reopen day
          </button>
        </div>
        {showing && <RewardVideo tier={sub.tier} pct={sub.pct} keystoneMissed={sub.keystoneMissed} onClose={() => setShowing(false)} />}
      </section>
    );
  }

  const info = tierById(preview.tier);
  return (
    <section className="card p-4 md:p-5">
      <h2 className="text-lg font-extrabold text-ink">Submit the day</h2>
      <p className="text-sm font-semibold text-ink-muted">Locks your habits and to-dos, then plays the video you earned. Habits and to-dos both count.</p>
      <div className={cn("mt-3 flex items-center gap-3 rounded-2xl px-3 py-2.5", TONE[preview.tier])}>
        <span className="text-2xl">{info.emoji}</span>
        <div className="text-sm font-bold leading-snug">
          Right now: {preview.pct}% → <span className="font-extrabold">{info.label}</span>
          {missed.length > 0 && <div className="text-xs font-bold">Must-do not ticked: {missed.map((m) => m.name).join(", ")}. Whatever the percentage, that means the bottom tier.</div>}
        </div>
      </div>
      {confirming ? (
        <div className="mt-3 flex gap-2">
          <button type="button" className="btn-primary flex-1" onClick={submit}>
            Yes, lock in {preview.pct}%
          </button>
          <button type="button" className="btn-ghost" onClick={() => setConfirming(false)}>
            Not yet
          </button>
        </div>
      ) : (
        <button type="button" className="btn-primary mt-3 w-full" onClick={() => setConfirming(true)}>
          <LockIcon /> Submit day
        </button>
      )}
    </section>
  );
}
