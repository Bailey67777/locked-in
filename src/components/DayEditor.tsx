"use client";

import { useStore } from "@/lib/store";
import { dayProgress, uid } from "@/lib/model";
import HabitChecklist from "./HabitChecklist";
import TodoList from "./TodoList";
import ProgressRing from "./ProgressRing";
import RatingBar from "./RatingBar";
import Journal from "./Journal";

type Props = { date: string; compact?: boolean };

/** Everything for one day: habits, to-dos, progress, ratings, journal. Used by Today and the calendar. */
export default function DayEditor({ date, compact = false }: Props) {
  const { getDay, updateDay, carryTodoOver, today } = useStore();
  const day = getDay(date);
  const progress = dayProgress(day);
  const isPast = date < today;

  return (
    <div className="flex flex-col gap-4">
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

      <section className="card p-4 md:p-5">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-lg font-extrabold text-ink">Core habits</h2>
          <span className="text-sm font-bold text-ink-muted">
            {day.habits.filter((h) => h.done).length}/{day.habits.length}
          </span>
        </div>
        <HabitChecklist
          habits={day.habits}
          onToggle={(id) =>
            updateDay(date, (d) => ({ ...d, habits: d.habits.map((h) => (h.id === id ? { ...h, done: !h.done } : h)) }))
          }
        />
      </section>

      <section className="card p-4 md:p-5">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-lg font-extrabold text-ink">To-do</h2>
          <span className="text-sm font-bold text-ink-muted">just for this day</span>
        </div>
        <TodoList
          todos={day.todos}
          onAdd={(text) => updateDay(date, (d) => ({ ...d, todos: [...d.todos, { id: uid(), text, done: false }] }))}
          onToggle={(id) => updateDay(date, (d) => ({ ...d, todos: d.todos.map((t) => (t.id === id ? { ...t, done: !t.done } : t)) }))}
          onDelete={(id) => updateDay(date, (d) => ({ ...d, todos: d.todos.filter((t) => t.id !== id) }))}
          onCarryOver={(id) => carryTodoOver(date, id)}
        />
      </section>

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
      </section>

      <section className="card p-4 md:p-5">
        <div className="mb-3">
          <h2 className="text-lg font-extrabold text-ink">Journal</h2>
          <p className="text-sm font-semibold text-ink-muted">Short and honest beats long and skipped.</p>
        </div>
        <Journal key={date} value={day.journal} onSave={(journal) => updateDay(date, (d) => ({ ...d, journal }))} />
      </section>
    </div>
  );
}
