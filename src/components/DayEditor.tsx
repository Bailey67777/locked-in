"use client";

import { useEffect, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { dayProgress, habitItem, habitLook, uid } from "@/lib/model";
import { habitStreak } from "@/lib/stats";
import { haptic, playRandomSound, playSound, precacheSounds, prewarmRandom, prewarmSounds } from "@/lib/sounds";
import { cn } from "@/lib/cn";
import { prewarmEdits, useEditBank } from "@/lib/edits";
import DayList from "./DayList";
import DayPlanner from "./DayPlanner";
import EditPlayer from "./EditPlayer";
import ProgressRing from "./ProgressRing";
import RatingBar from "./RatingBar";
import Confetti from "./Confetti";
import SubmitDay from "./SubmitDay";
import JournalCard from "./JournalCard";
import CountdownsCard from "./CountdownsCard";
import ThrowbackJournal from "./ThrowbackJournal";
import { LockIcon, PlusIcon } from "./Icons";

type Props = { date: string; compact?: boolean };

/**
 * Everything for one day: progress, the To Do (habits and everything else in one list), journal, ratings,
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
  const items = day.todos;
  const itemsDone = items.filter((t) => t.done).length;
  const bank = useEditBank();
  const [playing, setPlaying] = useState<{ editId: string; title: string } | null>(null);
  const [planning, setPlanning] = useState(false);
  const [text, setText] = useState("");
  const [showHabits, setShowHabits] = useState(false);
  const missingHabits = settings.habits.filter((h) => !items.some((t) => t.habitId === h.id));

  // Edits attached to things still to do are fetched in the background, so ticking plays them straight away.
  const editSig = locked ? "" : [...new Set(items.filter((t) => !t.done && t.editId && bank.byId[t.editId]).map((t) => t.editId as string))].join(",");
  useEffect(() => {
    if (!editSig) return;
    prewarmEdits(editSig.split(",").map((id) => bank.byId[id]).filter(Boolean));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refetch only when the set of edits changes
  }, [editSig]);

  // Render this day's sounds in the background so the first tap plays instantly.
  const soundIds = settings.habits.map((h) => h.sound).join(",");
  useEffect(() => {
    if (!settings.soundsOn) return;
    if (settings.randomSounds) {
      prewarmRandom();
      prewarmSounds([settings.dayCompleteSound]);
    } else prewarmSounds([...soundIds.split(","), settings.todoSound, settings.dayCompleteSound]);
    precacheSounds(); // all fifty into the offline cache, in the background
  }, [soundIds, settings.soundsOn, settings.randomSounds, settings.todoSound, settings.dayCompleteSound]);

  // Cheap enough to work out on every render (a handful of habits over a few months of days).
  const streaks: Record<string, number> = {};
  for (const h of day.habits) streaks[h.id] = habitStreak(data.days, h.id, date).current;

  const addText = () => {
    const t = text.trim();
    if (!t) return;
    updateDay(date, (d) => ({ ...d, todos: [...d.todos, { id: uid(), text: t, done: false }] }));
    setText("");
  };

  /** Tick or untick an item. Ticking plays its edit if it has one, otherwise its sound; finishing the list celebrates. */
  const toggleItem = (id: string) => {
    if (locked) return;
    const target = items.find((t) => t.id === id);
    if (!target) return;
    const turningOn = !target.done;
    const wasComplete = items.length > 0 && items.every((t) => t.done);
    const next = items.map((t) => (t.id === id ? { ...t, done: !t.done } : t));
    updateDay(date, (d) => ({ ...d, todos: d.todos.map((t) => (t.id === id ? { ...t, done: !t.done } : t)) }));
    if (!turningOn) return;
    haptic(12);
    const edit = target.editId ? bank.byId[target.editId] : undefined;
    if (edit) setPlaying({ editId: edit.id, title: target.habitId ? (settings.habits.find((h) => h.id === target.habitId)?.name ?? target.text) : target.text });
    else if (settings.soundsOn) {
      // Lucky dip plays a different random sound every tick; otherwise the habit's own one (or the to-do sound).
      if (settings.randomSounds) playRandomSound();
      else playSound(target.habitId ? habitLook(target.habitId, settings).sound : settings.todoSound);
    }
    const nowComplete = next.length > 0 && next.every((t) => t.done);
    if (nowComplete && !wasComplete) {
      haptic([20, 60, 20, 60, 40]);
      if (settings.soundsOn && !edit) window.setTimeout(() => playSound(settings.dayCompleteSound), 220);
      setCelebrating(true);
      if (celebrateTimer.current) window.clearTimeout(celebrateTimer.current);
      celebrateTimer.current = window.setTimeout(() => setCelebrating(false), 2600);
    }
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
          <div className="font-serif text-[20px] leading-none text-ink">
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

      <section className={cn("card overflow-hidden px-4 pt-4", locked && "opacity-70")}>
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <h2 className="card-title">To Do</h2>
          <div className="flex items-center gap-2">
            {lockedNote}
            {items.length > 0 && (
              <span className="font-mono text-[11.5px] tabular-nums text-ink-muted">
                {itemsDone}/{items.length}
              </span>
            )}
            {!locked && (
              <button type="button" className="chip border border-white/70" onClick={() => setPlanning(true)} title="Reorder, add habits, attach edits">
                Edit list
              </button>
            )}
          </div>
        </div>
        {items.length > 0 && (
          <div className="mb-3 mt-3 h-[2px] w-full overflow-hidden rounded-full bg-black/[0.06]">
            <div className="grad-fill h-full rounded-full transition-[width] duration-500" style={{ width: `${(itemsDone / items.length) * 100}%` }} />
          </div>
        )}
        <div className={cn(locked && "pointer-events-none")}>
          <DayList
            items={items}
            settings={settings}
            streaks={streaks}
            edits={bank.byId}
            onToggle={toggleItem}
            onDelete={locked ? undefined : (id) => updateDay(date, (d) => ({ ...d, todos: d.todos.filter((t) => t.id !== id) }))}
            onCarryOver={locked ? undefined : (id) => carryTodoOver(date, id)}
          />
        </div>
        {!locked && (
          <div className="py-3">
            <form
              className="flex items-center gap-1.5"
              onSubmit={(e) => {
                e.preventDefault();
                addText();
              }}
            >
              <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Add a to-do" className="field py-2 text-[14px]" enterKeyHint="done" autoComplete="off" />
              {missingHabits.length > 0 && (
                <button type="button" onClick={() => setShowHabits((v) => !v)} className={cn("tap h-[38px] shrink-0 rounded-full px-3 text-[12.5px] font-bold", showHabits ? "bg-ink text-white" : "bg-white/70 text-ink-soft")} aria-expanded={showHabits}>
                  ⭐ Habit
                </button>
              )}
              <button type="submit" className="btn-primary h-[38px] w-[38px] shrink-0 px-0" aria-label="Add to-do" disabled={!text.trim()}>
                <PlusIcon width={18} height={18} />
              </button>
            </form>
            {showHabits && missingHabits.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {missingHabits.map((h) => (
                  <button key={h.id} type="button" onClick={() => updateDay(date, (d) => ({ ...d, todos: [...d.todos, habitItem(h)] }))} className="tap chip border border-white/70 py-1 text-[12px]">
                    {h.emoji} {h.name.length > 28 ? `${h.name.slice(0, 27)}…` : h.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
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

      {planning && <DayPlanner date={date} onClose={() => setPlanning(false)} />}
      {playing && <EditPlayer editId={playing.editId} title={playing.title} onClose={() => setPlaying(null)} />}
    </div>
  );
}
