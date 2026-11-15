"use client";

import { useState } from "react";
import { useHub } from "@/lib/hub/store";
import { uid } from "@/lib/hub/model";
import { addDays, formatDayMonth } from "@/lib/dates";
import { cn } from "@/lib/cn";
import { CloseIcon } from "./Icons";

type When = "today" | "tomorrow" | "later";
const WHEN: { id: When; name: string }[] = [
  { id: "today", name: "Today" },
  { id: "tomorrow", name: "Tomorrow" },
  { id: "later", name: "Miscellaneous" },
];

/** Where to-dos are written and removed (the To do page itself is only for ticking). */
export default function TodoSettings() {
  const { data, today, write } = useHub();
  const [text, setText] = useState("");
  const [when, setWhen] = useState<When>("today");
  const tomorrow = addDays(today, 1);

  const add = () => {
    const t = text.trim();
    if (!t) return;
    write(`todos/${uid()}`, { text: t, at: Date.now(), ...(when === "later" ? { when: "later" } : { when: "day", date: when === "today" ? today : tomorrow }) });
    setText("");
  };

  // Everything not ticked yet: dated ones first, in date order, then the miscellaneous ones.
  const open = Object.entries(data.todos)
    .filter(([, t]) => !t.done)
    .map(([id, t]) => ({ id, ...t, day: t.when === "later" ? "9999" : (t.date ?? today) }))
    .sort((a, b) => a.day.localeCompare(b.day) || a.at - b.at);
  const label = (t: (typeof open)[number]) => (t.when === "later" ? "Misc" : t.day <= today ? "Today" : t.day === tomorrow ? "Tomorrow" : formatDayMonth(t.day));

  return (
    <div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <div className="flex gap-2">
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Add a to-do" enterKeyHint="done" className="field min-w-0 flex-1" aria-label="New to-do" />
          <button type="submit" className="btn h-auto px-5" disabled={!text.trim()}>
            Add
          </button>
        </div>
        <div className="mt-2 grid grid-cols-3 gap-1 rounded-2xl bg-surface p-1">
          {WHEN.map((w) => (
            <button key={w.id} type="button" aria-pressed={when === w.id} onClick={() => setWhen(w.id)} className={cn("h-10 rounded-xl text-[13.5px] transition-colors", when === w.id ? "bg-ink text-bg" : "text-ink-2")}>
              {w.name}
            </button>
          ))}
        </div>
      </form>
      {open.length > 0 && (
        <ul className="mt-3 divide-y divide-line border-y border-line">
          {open.map((t) => (
            <li key={t.id} className="flex items-center gap-3 py-2.5">
              <span className="min-w-0 flex-1 truncate text-[16px]">{t.text}</span>
              <span className="shrink-0 font-mono text-[11.5px] text-muted">{label(t)}</span>
              <button type="button" onClick={() => write(`todos/${t.id}`, null)} className="tap -mr-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-faint hover:text-ink" aria-label={`Remove ${t.text}`}>
                <CloseIcon width={14} height={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
