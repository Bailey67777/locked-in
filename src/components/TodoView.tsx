"use client";

import { useEffect, useRef } from "react";
import { useHub } from "@/lib/hub/store";
import { todoLists } from "@/lib/hub/model";
import { haptic } from "@/lib/sounds";
import HabitList from "./HabitList";

/** Ticked things older than this are cleared out for good. */
const KEEP_DONE_MS = 30 * 86400000;

const LISTS: { id: "today" | "later"; name: string }[] = [
  { id: "today", name: "Today" },
  { id: "later", name: "Miscellaneous" },
];

/**
 * The to-do list: just the things to tick, like the habits. Today's, and a Miscellaneous list with no day. Things
 * are added in Settings, or on a day in the Calendar; one added for a later day turns up under Today when that day
 * comes, and anything not done stays there.
 */
export default function TodoView() {
  const { data, today, write } = useHub();
  const lists = todoLists(data.todos, today);

  // Clear out things ticked more than a month ago, once, when the list opens.
  const swept = useRef(false);
  useEffect(() => {
    if (swept.current) return;
    swept.current = true;
    const cutoff = Date.now() - KEEP_DONE_MS;
    for (const [id, t] of Object.entries(data.todos)) if (t.done && t.done < cutoff) write(`todos/${id}`, null);
  }, [data.todos, write]);

  return (
    <div className="fade-up">
      <header className="mb-7">
        <h1 className="text-[36px] font-bold leading-none tracking-[-0.04em]">To do</h1>
      </header>
      {LISTS.map((l, i) => {
        const items = lists[l.id];
        const left = items.filter((x) => !x.done).length;
        return (
          <section key={l.id} className={i ? "mt-9" : undefined}>
            <div className="mb-2 flex items-baseline justify-between">
              <span className="text-[13px] text-muted">{l.name}</span>
              {left > 0 && <span className="font-mono text-[12px] tabular-nums text-muted">{left}</span>}
            </div>
            {items.length ? (
              <HabitList habits={items.map((x) => ({ id: x.id, name: x.text, done: Boolean(x.done) }))} onToggle={(id) => {
                  const done = Boolean(items.find((x) => x.id === id)?.done);
                  write(`todos/${id}/done`, done ? null : Date.now());
                  haptic(done ? 6 : 10);
                }}
              />
            ) : (
              <p className="border-y border-line py-[13px] text-center text-[15px] text-faint">–</p>
            )}
          </section>
        );
      })}
    </div>
  );
}
