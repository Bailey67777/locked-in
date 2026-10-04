"use client";

import { useState } from "react";
import type { Todo } from "@/lib/types";
import { AUTO_EMOJIS, HABIT_COLORS } from "@/lib/defaults";
import { ArrowRightIcon, CheckIcon, CloseIcon, PlusIcon } from "./Icons";

type Props = {
  todos: Todo[];
  onAdd: (text: string) => void;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onCarryOver?: (id: string) => void;
};

const COLORS = HABIT_COLORS.filter((c) => c.name !== "Slate");

/** Each to-do gets an emoji and colour picked from its id, so they never change once it's added. */
function lookFor(id: string): { emoji: string; color: string } {
  let h = 7;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return { emoji: AUTO_EMOJIS[h % AUTO_EMOJIS.length], color: COLORS[(h >>> 5) % COLORS.length].hex };
}

export default function TodoList({ todos, onAdd, onToggle, onDelete, onCarryOver }: Props) {
  const [text, setText] = useState("");

  const submit = () => {
    const t = text.trim();
    if (!t) return;
    onAdd(t);
    setText("");
  };

  return (
    <div className="flex flex-col">
      {todos.length > 0 && (
        <ul className="-mx-4 divide-y divide-black/[0.06] border-y border-black/[0.06]">
          {todos.map((t) => {
            const look = lookFor(t.id);
            return (
              <li
                key={t.id}
                className="flex items-center pr-2 transition-colors"
                style={t.done ? { background: `linear-gradient(90deg, ${look.color}5c, ${look.color}38 70%, ${look.color}26)` } : undefined}
              >
                <button type="button" onClick={() => onToggle(t.id)} aria-pressed={t.done} className="tap flex min-w-0 flex-1 items-center gap-3 py-3 pl-4 text-left">
                  <span
                    className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full border-[1.5px] transition-colors"
                    style={{ borderColor: t.done ? "#ffffff" : look.color, backgroundColor: t.done ? "#ffffff" : `${look.color}12` }}
                  >
                    {t.done ? <CheckIcon width={15} height={15} style={{ color: look.color }} strokeWidth={3.2} /> : <span className="text-[15px] leading-none">{look.emoji}</span>}
                  </span>
                  <span className="fancy min-w-0 flex-1 truncate text-[16.5px] text-ink">{t.text}</span>
                </button>
                {!t.done && onCarryOver && (
                  <button type="button" onClick={() => onCarryOver(t.id)} className="btn-icon h-8 w-8 text-ink-muted" title="Move to tomorrow" aria-label="Move to tomorrow">
                    <ArrowRightIcon width={14} height={14} />
                  </button>
                )}
                <button type="button" onClick={() => onDelete(t.id)} className="btn-icon h-8 w-8 text-ink-muted" title="Delete" aria-label="Delete">
                  <CloseIcon width={14} height={14} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <form
        className="flex items-center gap-1.5 py-3"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Add a to-do" className="field py-2 text-[14px]" enterKeyHint="done" autoComplete="off" />
        <button type="submit" className="btn-primary h-[38px] w-[38px] shrink-0 px-0" aria-label="Add to-do" disabled={!text.trim()}>
          <PlusIcon width={18} height={18} />
        </button>
      </form>
    </div>
  );
}
