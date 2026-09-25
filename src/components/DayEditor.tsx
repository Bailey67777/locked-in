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
import DebouncedInput from "./DebouncedInput";
import EncryptedJournal from "./EncryptedJournal";
import AcademicJournal from "./AcademicJournal";
import TodayQuestions from "./TodayQuestions";
import ExamCountdown from "./ExamCountdown";

type Props = { date: string; compact?: boolean };

/**
 * Everything for one day, in this order: progress, habits, to-do, song, journal (encrypted), ratings,
 * academic journal, today's questions, exam countdown, submit. Used by Today and the calendar's day view.
 */
export default function DayEditor({ date, compact = false }: Props) {
  const { data, getDay, updateDay, carryTodoOver, today } = useStore();
  const day = getDay(date);
  const progress = dayProgress(day); // habits + to-dos only; questions never count
  const isPast = date < today;
  const settings = data.settings;
  const [celebrating, setCelebrating] = useState(false);
  const celebrateTimer = useRef<number | null>(null);
  const locked = Boolean(day.submitted);

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

  return (
    <div className="flex flex-col gap-4">
      {celebrating && <Confetti />}

      <section className="card flex items-center gap-4 p-4 md:p-5">
        <ProgressRing pct={progress.pct} size={compact ? 80 : 96} />
        <div className="flex-1">
          <div className="label">Progress</div>
          <div className="mt-1 text-lg font-extrabold leading-tight text-ink">
            {progress.total === 0
              ? "Nothing to tick yet"
              : progress.pct === 100
                ? "Everything done. That's evidence."
                : `${progress.done} of ${progress.total} done`}
          </div>
          <div className="mt-1 text-sm font-semibold text-ink-muted">
            {progress.pct === 100
              ? "Bank it and enjoy the evening."
              : progress.pct >= 50
                ? "Over halfway. Keep the anchors."
                : isPast
                  ? "You can still fill this day in."
                  : "Start with the next thing on the list."}
          </div>
        </div>
      </section>

      <section className={cn("card p-4 md:p-5", locked && "pointer-events-none opacity-75")}>
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-lg font-extrabold text-ink">Core habits{locked ? " · locked" : ""}</h2>
          <span className="text-sm font-bold text-ink-muted">
            {day.habits.filter((h) => h.done).length}/{day.habits.length}
          </span>
        </div>
        <HabitChecklist habits={day.habits} settings={settings} streaks={streaks} onToggle={toggleHabit} />
      </section>

      <section className={cn("card p-4 md:p-5", locked && "pointer-events-none opacity-75")}>
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-lg font-extrabold text-ink">To-do{locked ? " · locked" : ""}</h2>
          <span className="text-sm font-bold text-ink-muted">just for this day</span>
        </div>
        <TodoList
          todos={day.todos}
          onAdd={(text) => updateDay(date, (d) => ({ ...d, todos: [...d.todos, { id: uid(), text, done: false }] }))}
          onToggle={toggleTodo}
          onDelete={(id) => updateDay(date, (d) => ({ ...d, todos: d.todos.filter((t) => t.id !== id) }))}
          onCarryOver={(id) => carryTodoOver(date, id)}
        />
      </section>

      <section className="card p-4 md:p-5">
        <h2 className="text-lg font-extrabold text-ink">🎵 Song of the day</h2>
        <DebouncedInput key={`song-${date}`} value={day.song ?? ""} onSave={(song) => updateDay(date, (d) => ({ ...d, song: song || undefined }))} placeholder="Artist – track" ariaLabel="Song of the day" className="field mt-2" />
      </section>

      <EncryptedJournal date={date} />

      <section className="card p-4 md:p-5">
        <div className="mb-4">
          <h2 className="text-lg font-extrabold text-ink">How was it?</h2>
          <p className="text-sm font-semibold text-ink-muted">Tap or drag. 1 is rough, 10 is a great day.</p>
        </div>
        <div className="flex flex-col gap-5">
          <RatingBar label="Day" hint="overall" tone="ocean" value={day.ratings.day} onChange={(v) => updateDay(date, (d) => ({ ...d, ratings: { ...d.ratings, day: v } }))} />
          <RatingBar label="Health" hint="sleep, food, movement" tone="teal" value={day.ratings.health} onChange={(v) => updateDay(date, (d) => ({ ...d, ratings: { ...d.ratings, health: v } }))} />
          <RatingBar label="Happiness" hint="mood, people, energy" tone="sunset" value={day.ratings.happy} onChange={(v) => updateDay(date, (d) => ({ ...d, ratings: { ...d.ratings, happy: v } }))} />
        </div>
        <div className="mt-5 border-t border-sand-100 pt-4">
          <span className="mb-1 block text-sm font-extrabold text-ink">📱 Screen time</span>
          <div className="flex items-center gap-2">
            <select
              className="field w-auto py-3"
              aria-label="Screen time hours"
              value={typeof day.screenMinutes === "number" ? Math.floor(day.screenMinutes / 60) : ""}
              onChange={(e) => {
                const h = e.target.value === "" ? null : Number(e.target.value);
                updateDay(date, (d) => ({ ...d, screenMinutes: h === null ? undefined : h * 60 + ((d.screenMinutes ?? 0) % 60) }));
              }}
            >
              <option value="">–</option>
              {Array.from({ length: 17 }, (_, i) => (
                <option key={i} value={i}>
                  {i}h
                </option>
              ))}
            </select>
            <select
              className="field w-auto py-3"
              aria-label="Screen time minutes"
              value={typeof day.screenMinutes === "number" ? day.screenMinutes % 60 - (day.screenMinutes % 5) : ""}
              onChange={(e) => {
                const m = e.target.value === "" ? 0 : Number(e.target.value);
                updateDay(date, (d) => ({ ...d, screenMinutes: Math.floor((d.screenMinutes ?? 0) / 60) * 60 + m }));
              }}
            >
              <option value="">–</option>
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i} value={i * 5}>
                  {i * 5}m
                </option>
              ))}
            </select>
            <span className="text-[11px] font-semibold text-ink-muted">from Settings → Screen Time on your phone</span>
          </div>
        </div>
      </section>

      <AcademicJournal date={date} />

      <TodayQuestions date={date} />

      {date === today && <ExamCountdown />}

      <SubmitDay date={date} />
    </div>
  );
}
