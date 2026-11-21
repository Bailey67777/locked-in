"use client";

import { useEffect, useRef, useState } from "react";
import { useHub } from "@/lib/hub/store";
import { todoLists } from "@/lib/hub/model";
import { dayBounds } from "@/lib/hub/time";
import { parseKey } from "@/lib/dates";
import { useStore } from "@/lib/store";
import { haptic, playTodo, playUntick } from "@/lib/sounds";
import { PlusIcon } from "./Icons";
import HabitList from "./HabitList";
import Sheet from "./Sheet";
import TodoSettings from "./TodoSettings";

/** Ticked things with a day are kept this long, so the Calendar can still show them; then cleared out for good. */
const KEEP_DONE_MS = 30 * 86400000;
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/**
 * The to-do list: today's, tomorrow's when there are any, and a Miscellaneous list with no day. A bar under the
 * title fills as today's get ticked. The + adds one (and is where they're removed); one left undone stays under
 * Today and says which day it's from.
 */
export default function TodoView() {
  const { data, today, write } = useHub();
  const soundsOn = useStore().data.settings.soundsOn;
  const lists = todoLists(data.todos, today);
  const [adding, setAdding] = useState(false);

  // Once, when the list opens: Miscellaneous things ticked on an earlier day are done with and go; things that had
  // a day stay a month.
  const swept = useRef(false);
  useEffect(() => {
    if (swept.current) return;
    swept.current = true;
    const [morning] = dayBounds(today);
    const cutoff = Date.now() - KEEP_DONE_MS;
    for (const [id, t] of Object.entries(data.todos)) if (t.done && t.done < (t.when === "later" ? morning : cutoff)) write(`todos/${id}`, null);
  }, [data.todos, today, write]);

  const groups = [
    { id: "today", name: "Today", items: lists.today, always: true },
    { id: "tomorrow", name: "Tomorrow", items: lists.tomorrow, always: false },
    { id: "later", name: "Miscellaneous", items: lists.later, always: true },
  ].filter((g) => g.always || g.items.length);

  const done = lists.today.filter((x) => x.done).length;
  const total = lists.today.length;
  const all = [...lists.today, ...lists.tomorrow, ...lists.later];

  return (
    <div className="fade-up">
      <header className="mb-7">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-[36px] font-bold leading-none tracking-[-0.04em]">To do</h1>
          <button type="button" onClick={() => setAdding(true)} className="tap flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-ink text-bg" aria-label="Add or remove to-dos">
            <PlusIcon width={20} height={20} />
          </button>
        </div>
        <div className="mt-5 flex items-baseline justify-between text-[13px] tabular-nums">
          <span className="text-muted">{total ? (done === total ? "Today is clear" : `${total - done} left today`) : "Nothing for today"}</span>
          {total > 0 && (
            <span className="text-ink-2">
              {done}/{total}
            </span>
          )}
        </div>
        <div className="mt-2 h-[3px] w-full overflow-hidden rounded-full bg-track">
          <div className="lit-bar h-full rounded-full bg-[var(--accent)] transition-[width] duration-500 ease-out" style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
        </div>
      </header>

      {groups.map((g, i) => {
        const left = g.items.filter((x) => !x.done).length;
        // Still to do first; what's been ticked today sinks to the bottom.
        const items = [...g.items].sort((a, b) => Number(Boolean(a.done)) - Number(Boolean(b.done)));
        return (
          <section key={g.id} className={i ? "mt-9" : undefined}>
            <div className="mb-2 flex items-baseline justify-between">
              <span className="text-[13px] text-muted">{g.name}</span>
              {left > 0 && <span className="text-[12.5px] tabular-nums text-muted">{left}</span>}
            </div>
            {items.length ? (
              <HabitList
                habits={items.map((x) => ({ id: x.id, name: x.text, done: Boolean(x.done) }))}
                trailing={(h) => {
                  const t = g.items.find((x) => x.id === h.id);
                  // Left over from an earlier day: say which.
                  return g.id === "today" && t?.date && t.date < today && !t.done ? <span className="shrink-0 pl-2 text-[12px] text-muted">from {DAY_NAMES[parseKey(t.date).getDay()]}</span> : null;
                }}
                onToggle={(id) => {
                  const ticked = Boolean(all.find((x) => x.id === id)?.done);
                  write(`todos/${id}/done`, ticked ? null : Date.now());
                  haptic(ticked ? 6 : 10);
                  if (soundsOn) (ticked ? playUntick : playTodo)();
                }}
              />
            ) : (
              <p className="border-y border-line py-[13px] text-center text-[15px] text-faint">–</p>
            )}
          </section>
        );
      })}

      {adding && (
        <Sheet label="To do" onClose={() => setAdding(false)}>
          <div className="mt-3">
            <TodoSettings />
          </div>
        </Sheet>
      )}
    </div>
  );
}
