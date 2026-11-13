"use client";

import { useStore } from "@/lib/store";
import { TIERS, dayProgress } from "@/lib/model";
import { formatLong } from "@/lib/dates";
import { haptic, playAllDone, playSubmit, playTick, playUntick } from "@/lib/sounds";
import HabitList from "./HabitList";

/** Today: ten habits, a bar, a submit button. */
export default function HabitsView() {
  const { today, data, getDay, updateDay } = useStore();
  const settings = data.settings;
  const day = getDay(today);
  const { done, total, pct } = dayProgress(day);
  const sub = day.submitted;

  const toggle = (id: string) => {
    if (sub) return;
    const target = day.habits.find((h) => h.id === id);
    if (!target) return;
    const turningOn = !target.done;
    updateDay(today, (d) => ({ ...d, habits: d.habits.map((h) => (h.id === id ? { ...h, done: !h.done } : h)) }));
    haptic(turningOn ? 10 : 6);
    if (!settings.soundsOn) return;
    if (!turningOn) return playUntick();
    playTick();
    if (done + 1 === total) playAllDone();
  };

  const submit = () => {
    const tier = (TIERS.find((t) => pct >= t.min) ?? TIERS[TIERS.length - 1]).id;
    updateDay(today, (d) => ({ ...d, submitted: { at: Date.now(), pct, tier, keystoneMissed: false } }));
    haptic([12, 50, 12]);
    if (settings.soundsOn) playSubmit();
  };

  const reopen = () =>
    updateDay(today, (d) => {
      const next = { ...d };
      delete next.submitted;
      return next;
    });

  return (
    <>
      <div className="fade-up">
      <header className="mb-7">
        <div className="label">{formatLong(today)}</div>
        <h1 className="mt-2 text-[34px] font-semibold leading-none tracking-[-0.035em]">Habits</h1>
      </header>

      <div className={sub ? "opacity-60" : undefined}>
        <HabitList habits={day.habits} settings={settings} locked={Boolean(sub)} onToggle={toggle} />
      </div>
      </div>

      {/* Outside the animated block: a transformed parent would carry this fixed bar along with it. */}
      <div className="fixed inset-x-0 bottom-[calc(57px+env(safe-area-inset-bottom,0px))] z-30">
        <div className="h-6 bg-gradient-to-t from-bg to-transparent" aria-hidden="true" />
        <div className="mx-auto w-full max-w-[520px] bg-bg px-5 pb-4 pt-1">
          <div className="flex items-baseline justify-between font-mono text-[12px] tabular-nums">
            <span className="text-muted">
              {done}/{total}
            </span>
            <span className="text-ink">{pct}%</span>
          </div>
          <div className="mt-2 h-[3px] w-full overflow-hidden rounded-full bg-track" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Today's progress">
            <div className="h-full rounded-full bg-ink transition-[width] duration-500 ease-out" style={{ width: `${pct}%` }} />
          </div>
          {sub ? (
            <div className="mt-4 flex h-12 items-center justify-between">
              <span className="text-[15px] font-medium">Submitted · {sub.pct}%</span>
              <button type="button" className="btn-quiet -mr-3 text-muted" onClick={reopen}>
                Reopen
              </button>
            </div>
          ) : (
            <button type="button" className="btn mt-4 w-full" onClick={submit} disabled={total === 0}>
              Submit day
            </button>
          )}
        </div>
      </div>
    </>
  );
}
