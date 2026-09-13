"use client";

import { useState } from "react";
import type { Todo } from "@/lib/types";
import { cn } from "@/lib/cn";
import { ArrowRightIcon, CheckIcon, CloseIcon, PlusIcon } from "./Icons";

type Props = {
  todos: Todo[];
  onAdd: (text: string) => void;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onCarryOver?: (id: string) => void;
};

export default function TodoList({ todos, onAdd, onToggle, onDelete, onCarryOver }: Props) {
  const [text, setText] = useState("");

  const submit = () => {
    const t = text.trim();
    if (!t) return;
    onAdd(t);
    setText("");
  };

  return (
    <div className="flex flex-col gap-3">
      {todos.length === 0 ? (
        <p className="py-2 text-center text-sm font-semibold text-ink-muted">Nothing on the list. Add one thing that matters today.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {todos.map((t) => (
            <li key={t.id} className={cn("flex items-center gap-2 rounded-2xl px-2 py-1.5", t.done ? "bg-teal-100/60" : "bg-sand-50")}>
              <button
                type="button"
                onClick={() => onToggle(t.id)}
                aria-pressed={t.done}
                className="tap flex min-h-11 flex-1 items-center gap-3 text-left"
              >
                <span
                  className={cn(
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2",
                    t.done ? "border-teal-500 bg-teal-500 text-white" : "border-sand-300 bg-white text-transparent",
                  )}
                >
                  <CheckIcon width={14} height={14} />
                </span>
                <span className={cn("text-[15px] font-semibold", t.done ? "text-ink-muted line-through" : "text-ink")}>{t.text}</span>
              </button>
              {!t.done && onCarryOver && (
                <button type="button" onClick={() => onCarryOver(t.id)} className="btn-icon h-9 w-9" title="Move to tomorrow" aria-label="Move to tomorrow">
                  <ArrowRightIcon />
                </button>
              )}
              <button type="button" onClick={() => onDelete(t.id)} className="btn-icon h-9 w-9" title="Delete" aria-label="Delete">
                <CloseIcon width={18} height={18} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="e.g. finish Physics homework"
          className="field"
          enterKeyHint="done"
          autoComplete="off"
        />
        <button type="submit" className="btn-primary px-4" aria-label="Add to-do" disabled={!text.trim()}>
          <PlusIcon />
        </button>
      </form>
    </div>
  );
}
