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
    <div className="flex flex-col gap-2">
      {todos.length > 0 && (
        <ul className="-mx-1.5 flex flex-col">
          {todos.map((t) => (
            <li key={t.id} className="group flex items-center rounded-lg pr-0.5 hover:bg-sand-50">
              <button type="button" onClick={() => onToggle(t.id)} aria-pressed={t.done} className="tap flex min-h-[34px] min-w-0 flex-1 items-center gap-2.5 px-1.5 py-1 text-left">
                <span
                  className={cn(
                    "flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-md border-[1.5px] transition-colors",
                    t.done ? "border-teal-500 bg-teal-500 text-white" : "border-sand-300 bg-white text-transparent",
                  )}
                >
                  <CheckIcon width={11} height={11} strokeWidth={3.5} />
                </span>
                <span className={cn("fancy min-w-0 flex-1 truncate text-[15.5px]", t.done ? "text-ink-muted line-through decoration-ink-muted/40" : "text-ink")}>{t.text}</span>
              </button>
              {!t.done && onCarryOver && (
                <button type="button" onClick={() => onCarryOver(t.id)} className="btn-icon h-7 w-7 text-ink-muted" title="Move to tomorrow" aria-label="Move to tomorrow">
                  <ArrowRightIcon width={14} height={14} />
                </button>
              )}
              <button type="button" onClick={() => onDelete(t.id)} className="btn-icon h-7 w-7 text-ink-muted" title="Delete" aria-label="Delete">
                <CloseIcon width={14} height={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <form
        className="flex items-center gap-1.5"
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
