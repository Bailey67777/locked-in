"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { dayProgress, habitLook, habitsComplete, uid } from "@/lib/model";
import { habitStreak } from "@/lib/stats";
import { haptic, playSound, prewarmSounds } from "@/lib/sounds";
import { cn } from "@/lib/cn";
import HabitChecklist from "./HabitChecklist";
import TodoList from "./TodoList";
import ProgressRing from "./ProgressRing";
import RatingBar from "./RatingBar";
import Confetti from "./Confetti";
import SubmitDay from "./SubmitDay";
import JournalCard from "./JournalCard";
import CountdownsCard from "./CountdownsCard";
import ThrowbackJournal from "./ThrowbackJournal";
import { LockIcon } from "./Icons";

type Props = { date: string; compact?: boolean };

/**
 * Everything for one day: progress, habits, to-do, journal, ratings,
 * then (today only) countdowns and a throwback entry, then submit. Used by Today and the calendar's day view.
 */
export default function DayEditor({ date }: Props) {
  const { data, getDay, updateDay, carryTodoOver, today } = useStore();
  const day = getDay(date);
  const progress = dayProgress(day); // habits + to-dos only
  const isPast = date < today;
  const settings = data.settings;
  const [celebrating, setCelebrating] = useState(false);
  const celebrateTimer = useRef<number | null>(null);
  const locked = Boolean(day.submitted);
  const habitsDone = day.habits.filter((h) => h.done).length;

  // Render this day's sounds in the background so the first tap plays instantly.
  const soundIds = settings.habits.map((h) => h.sound).join(",");
  useEffect(() => {
    if (!settings.soundsOn) return;
    prewarmSounds([...soundIds.split(","), settings.todoSound, settings.dayCompleteSound]);
  }, [soundIds, settings.soundsOn, settings.todoSound, settings.dayCompleteSound]);

  const streaks = useMemo(() => {
    const out: Record<string, number> = {};
    for (const h of day.habits) out[h.id] = habitStreak(data.days, h.id, date).current;
    return out;
  }, [data.days, day.habits, date]);

  const toggleHabit = (id: string) => {
    if (locked) return;
    const wasComplete = habitsComplete(day);
    const target = day.habits.find((h) => h.id === id);
    const turningOn = target ? !target.done : false;
    const nextHabits = day.habits.map((h) => (h.id === id ? { ...h, done: !h.done } : h));
    updateDay(date, (d) => ({ ...d, habits: d.habits.map((h) => (h.id === id ? { ...h, done: !h.done } : h)) }));
    if (turningOn) {
      haptic(12);
      if (settings.soundsOn) playSound(habitLook(id, settings).sound);
      const nowComplete = nextHabits.length > 0 && nextHabits.every((h) => h.done);
      if (nowComplete && !wasComplete) {
        haptic([20, 60, 20, 60, 40]);
        if (settings.soundsOn) window.setTimeout(() => playSound(settings.dayCompleteSound), 220);
        setCelebrating(true);
        if (celebrateTimer.current) window.clearTimeout(celebrateTimer.current);
        celebrateTimer.current = window.setTimeout(() => setCelebrating(false), 2600);
      }
    }
  };

  const toggleTodo = (id: string) => {
    if (locked) return;
    const t = day.todos.find((x) => x.id === id);
    if (t && !t.done) {
      haptic(10);
      if (settings.soundsOn) playSound(settings.todoSound);
    }
    updateDay(date, (d) => ({ ...d, todos: d.todos.map((x) => (x.id === id ? { ...x, done: !x.done } : x)) }));
  };

  const lockedNote = locked && (
    <span className="chip">
      <LockIcon width={11} height={11} /> locked
    </span>
  );

  return (
    <div className="flex flex-col gap-3">
      {celebrating && <Confetti />}

      <section className="card flex items-center gap-3.5 px-4 py-3">
        <ProgressRing pct={progress.pct} />
        <div className="min-w-0 flex-1">
          <div className="font-serif text-[23px] leading-none text-ink">
            {progress.total === 0 ? "Nothing to tick yet" : progress.pct === 100 ? "Everything done." : `${progress.done} of ${progress.total} done`}
          </div>
          <div className="mt-1 text-[12.5px] text-ink-muted">
            {progress.pct === 100
              ? "Bank it and enjoy the evening."
              : progress.pct >= 80
                ? "Past 80%. Strong day."
                : progress.pct >= 50
                  ? "Over halfway. Keep the anchors."
                  : isPast
                    ? "You can still fill this day in."
                    : "Start with the next thing on the list."}
          </div>
        </div>
      </section>

      <section className={cn("card px-4 pb-2.5 pt-3.5", locked && "pointer-events-none opacity-70")}>
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <h2 className="card-title">Core habits</h2>
          <div className="flex items-center gap-2">
            {lockedNote}
            <span className="text-[12px] font-bold tabular-nums text-ink-muted">
              {habitsDone}/{day.habits.length}
            </span>
          </div>
        </div>
        {day.habits.length > 0 && (
          <div className="mb-2 mt-2.5 h-[2px] w-full overflow-hidden rounded-full bg-black/[0.06]">
            <div className="h-full rounded-full bg-ocean-500 transition-[width] duration-500" style={{ width: `${(habitsDone / day.habits.length) * 100}%` }} />
          </div>
        )}
        <HabitChecklist habits={day.habits} settings={settings} streaks={streaks} onToggle={toggleHabit} />
      </section>

      <section className={cn("card px-4 pb-3 pt-3.5", locked && "pointer-events-none opacity-70")}>
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <h2 className="card-title">To-do</h2>
          {lockedNote || (
            <span className="text-[12px] font-bold tabular-nums text-ink-muted">
              {day.todos.length ? `${day.todos.filter((t) => t.done).length}/${day.todos.length}` : "just for this day"}
            </span>
          )}
        </div>
        <TodoList
          todos={day.todos}
          onAdd={(text) => updateDay(date, (d) => ({ ...d, todos: [...d.todos, { id: uid(), text, done: false }] }))}
          onToggle={toggleTodo}
          onDelete={(id) => updateDay(date, (d) => ({ ...d, todos: d.todos.filter((t) => t.id !== id) }))}
          onCarryOver={(id) => carryTodoOver(date, id)}
        />
      </section>

      <JournalCard date={date} />

      <section className="card p-4">
        <div className="mb-3 flex items-baseline justify-between gap-2">
          <h2 className="card-title">How was it?</h2>
          <span className="card-sub">1 rough · 10 great</span>
        </div>
        <div className="flex flex-col gap-2.5">
          <RatingBar label="Day" tone="ocean" value={day.ratings.day} onChange={(v) => updateDay(date, (d) => ({ ...d, ratings: { ...d.ratings, day: v } }))} />
          <RatingBar label="Health" tone="teal" value={day.ratings.health} onChange={(v) => updateDay(date, (d) => ({ ...d, ratings: { ...d.ratings, health: v } }))} />
          <RatingBar label="Happiness" tone="sunset" value={day.ratings.happy} onChange={(v) => updateDay(date, (d) => ({ ...d, ratings: { ...d.ratings, happy: v } }))} />
        </div>
      </section>

      {date === today && <CountdownsCard />}

      {date === today && <ThrowbackJournal date={date} />}

      <SubmitDay date={date} />
    </div>
  );
}
