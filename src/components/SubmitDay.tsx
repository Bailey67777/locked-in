"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { REWARD_PCT, earnsReward, missedKeystones, tierById, tierFor } from "@/lib/model";
import { haptic } from "@/lib/sounds";
import { LockIcon } from "./Icons";
import RewardVideo from "./RewardVideo";
import Confetti from "./Confetti";

/**
 * Finalise the day: lock the ticks and record the percentage. No punishment: a day of 80%+ (with every
 * must-do ticked) unlocks the reward video, anything else is simply logged.
 */
export default function SubmitDay({ date }: { date: string }) {
  const { data, getDay, updateDay } = useStore();
  const day = getDay(date);
  const settings = data.settings;
  const [confirming, setConfirming] = useState(false);
  const [rewatch, setRewatch] = useState(false);
  const [party, setParty] = useState(false);

  const preview = tierFor(day, settings);
  const missed = missedKeystones(day, settings);
  const sub = day.submitted;

  const submit = () => {
    const result = tierFor(day, settings);
    updateDay(date, (d) => ({
      ...d,
      submitted: { at: Date.now(), pct: result.pct, tier: result.tier, keystoneMissed: result.keystoneMissed, ...(result.reward ? { watched: false } : {}) },
    }));
    setConfirming(false);
    haptic(result.reward ? [20, 60, 20, 60, 40] : 20);
    if (result.reward) {
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
    const reward = earnsReward(sub.pct, sub.keystoneMissed);
    return (
      <section className="card px-4 py-3.5">
        {party && <Confetti />}
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/80 text-xl shadow-soft">{info.emoji}</span>
          <div className="min-w-0 flex-1">
            <div className="label flex items-center gap-1">
              <LockIcon width={11} height={11} /> Submitted
            </div>
            <div className="font-serif text-[20px] leading-tight text-ink">
              {sub.pct}% · <span className="italic">{info.label}</span>
            </div>
            <div className="text-[12.5px] font-semibold text-ink-muted">{info.blurb}</div>
          </div>
        </div>
        <div className="mt-3 flex gap-2">
          {reward && (
            <button type="button" className="btn-primary flex-1" onClick={() => setRewatch(true)}>
              ▶ {sub.watched === false ? "Play your video" : "Watch it again"}
            </button>
          )}
          <button type="button" className={reward ? "btn-ghost" : "btn-ghost flex-1 bg-sand-50"} onClick={reopen}>
            Reopen day
          </button>
        </div>
        {rewatch && (
          <RewardVideo
            date={date}
            pct={sub.pct}
            onWatched={() => updateDay(date, (d) => ({ ...d, submitted: d.submitted ? { ...d.submitted, watched: true } : d.submitted }))}
            onClose={() => setRewatch(false)}
          />
        )}
      </section>
    );
  }

  const toGo = Math.max(0, REWARD_PCT - preview.pct);
  return (
    <section className="card p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="card-title">Submit the day</h2>
        <span className="font-serif text-[20px] leading-none tabular-nums text-ink">{preview.pct}%</span>
      </div>

      <div className="relative mt-3 h-1 w-full rounded-full bg-black/[0.06]">
        <div className={preview.reward ? "h-full rounded-full transition-[width] duration-500" : "grad-fill h-full rounded-full transition-[width] duration-500"} style={{ width: `${preview.pct}%`, ...(preview.reward ? { background: "var(--color-teal-500)" } : {}) }} />
        <span className="absolute -top-1 h-3.5 w-[2px] rounded-full bg-ink/40" style={{ left: `${REWARD_PCT}%` }} aria-hidden="true" />
      </div>
      <p className="mt-2 text-[12.5px] font-semibold text-ink-muted">
        {preview.reward
          ? "✨ Tonight's video is unlocked."
          : missed.length > 0 && toGo === 0
            ? `Tick ${missed.map((m) => m.name).join(", ")} to unlock tonight's video.`
            : `${toGo}% more to unlock tonight's video.`}
      </p>

      {confirming ? (
        <div className="mt-3 flex gap-2">
          <button type="button" className="btn-primary flex-1" onClick={submit}>
            Lock in {preview.pct}%
          </button>
          <button type="button" className="btn-ghost" onClick={() => setConfirming(false)}>
            Not yet
          </button>
        </div>
      ) : (
        <button type="button" className="btn-primary mt-3 w-full" onClick={() => setConfirming(true)}>
          <LockIcon width={15} height={15} /> Submit day
        </button>
      )}
    </section>
  );
}
