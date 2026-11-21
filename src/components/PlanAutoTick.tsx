"use client";

import { useEffect, useRef } from "react";
import { useHub } from "@/lib/hub/store";
import { useStore } from "@/lib/store";
import { planFor } from "@/lib/hub/model";
import { playAllDone } from "@/lib/sounds";

/**
 * Finishing the plan ticks a habit. When the last thing on today's plan is ticked, the habit chosen in Settings
 * (his "100% Valid Structured") ticks itself; untick something on the plan and it unticks again. It acts only at
 * the moment the plan changes between finished and unfinished, so ticking or unticking that habit by hand is left alone.
 */
export default function PlanAutoTick() {
  const { data, today, fresh } = useHub();
  const store = useStore();
  const habitId = data.settings.planHabit;
  const day = store.getDay(today);
  const target = habitId ? day.habits.find((h) => h.id === habitId) : undefined;
  // Something that is also a habit counts as done when the habit is; the habit being ticked here never counts itself.
  const tasks = planFor(today, data.plan).filter((t) => t.habit !== habitId);
  const complete =
    tasks.length > 0 &&
    tasks.every((t) => {
      const habit = t.habit ? day.habits.find((h) => h.id === t.habit) : undefined;
      return habit ? habit.done : t.done > 0;
    });
  const ready = fresh && store.loaded && today !== "" && Boolean(target);
  const targetDone = target?.done ?? false;
  const soundsOn = store.data.settings.soundsOn;
  const { updateDay } = store;
  const seen = useRef<{ date: string; complete: boolean } | null>(null);

  useEffect(() => {
    if (!ready) return;
    const before = seen.current;
    seen.current = { date: today, complete };
    // The first look at a day only notes how things stand; after that, only a change does anything.
    if (!before || before.date !== today || before.complete === complete || targetDone === complete) return;
    updateDay(today, (d) => ({ ...d, habits: d.habits.map((h) => (h.id === habitId ? { ...h, done: complete } : h)) }));
    if (complete && soundsOn) playAllDone();
  }, [ready, today, complete, targetDone, habitId, soundsOn, updateDay]);

  return null;
}
