"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useHub } from "@/lib/hub/store";
import { type TodoWithId, todoLists, uid } from "@/lib/hub/model";
import { addDays } from "@/lib/dates";
import { haptic } from "@/lib/sounds";
import { cn } from "@/lib/cn";
import { CheckIcon, CloseIcon, PlusIcon } from "./Icons";

type ListId = "today" | "tomorrow" | "later";

const LISTS: { id: ListId; name: string }[] = [
  { id: "today", name: "Today" },
  { id: "tomorrow", name: "Tomorrow" },
  { id: "later", name: "For a while" },
];

/** Ticked things older than this are cleared out for good. */
const KEEP_DONE_MS = 30 * 86400000;

function Row({ item, list, open, onOpen }: { item: TodoWithId; list: ListId; open: boolean; onOpen: (id: string | null) => void }) {
  const { today, write } = useHub();
  const done = Boolean(item.done);

  const move = (to: ListId) => {
    write(`todos/${item.id}`, { text: item.text, at: item.at, ...(to === "later" ? { when: "later" } : { when: "day", date: to === "today" ? today : addDays(today, 1) }) });
    onOpen(null);
  };

  return (
    <li>
      <div className="flex items-center">
        <button
          type="button"
          onClick={() => {
            write(`todos/${item.id}/done`, done ? null : Date.now());
            haptic(done ? 6 : 10);
          }}
          aria-pressed={done}
          aria-label={done ? `Untick ${item.text}` : `Tick ${item.text}`}
          className="tap -ml-1 flex h-12 w-10 shrink-0 items-center justify-center"
        >
          <span className={cn("flex h-[22px] w-[22px] items-center justify-center rounded-full border-[1.75px] transition-colors duration-200", done ? "border-ink bg-ink text-bg" : "border-muted")}>{done && <CheckIcon width={12} height={12} />}</span>
        </button>
        {open ? (
          <input
            defaultValue={item.text}
            autoFocus
            enterKeyHint="done"
            onBlur={(e) => {
              const t = e.target.value.trim();
              if (t && t !== item.text) write(`todos/${item.id}/text`, t);
            }}
            onKeyDown={(e) => e.key === "Enter" && onOpen(null)}
            className="min-w-0 flex-1 bg-transparent py-3 pl-1 text-[17px] font-medium tracking-[-0.015em] text-ink focus:outline-none"
            aria-label="Edit"
          />
        ) : (
          <button type="button" onClick={() => onOpen(item.id)} className={cn("min-w-0 flex-1 py-3 pl-1 text-left text-[17px] font-medium leading-snug tracking-[-0.015em] transition-colors duration-200", done ? "text-muted" : "text-ink")}>
            {item.text}
          </button>
        )}
      </div>
      {open && (
        <div className="flex items-center gap-1.5 pb-3 pl-10">
          {LISTS.filter((l) => l.id !== list).map((l) => (
            // onMouseDown: keep the tap from being swallowed by the text box losing focus first.
            <button key={l.id} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => move(l.id)} className="h-8 rounded-full bg-surface px-3 text-[13px] text-ink-2">
              {l.name}
            </button>
          ))}
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              write(`todos/${item.id}`, null);
              onOpen(null);
            }}
            className="ml-auto h-8 px-2 text-[13px] text-muted"
          >
            Delete
          </button>
        </div>
      )}
    </li>
  );
}

function Add({ list }: { list: ListId }) {
  const { today, write } = useHub();
  const [text, setText] = useState("");
  const input = useRef<HTMLInputElement>(null);

  const add = () => {
    const t = text.trim();
    if (!t) return;
    write(`todos/${uid()}`, { text: t, at: Date.now(), ...(list === "later" ? { when: "later" } : { when: "day", date: list === "today" ? today : addDays(today, 1) }) });
    setText("");
    haptic(8);
  };

  return (
    <form
      className="flex items-center"
      onSubmit={(e) => {
        e.preventDefault();
        add();
        input.current?.focus();
      }}
    >
      <span className="-ml-1 flex h-12 w-10 shrink-0 items-center justify-center text-faint">
        <PlusIcon width={18} height={18} />
      </span>
      <input ref={input} value={text} onChange={(e) => setText(e.target.value)} onBlur={add} placeholder="Add" enterKeyHint="done" className="min-w-0 flex-1 bg-transparent py-3 pl-1 text-[17px] font-medium tracking-[-0.015em] text-ink placeholder:font-normal placeholder:text-faint focus:outline-none" aria-label={`Add to ${list}`} />
    </form>
  );
}

/** The to-do list: today, tomorrow, and things for a while. Tomorrow's become today's by themselves; unfinished ones stay. */
export default function TodoView({ onClose }: { onClose: () => void }) {
  const { data, today, write } = useHub();
  const lists = todoLists(data.todos, today);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  // Clear out things ticked more than a month ago, once, when the list opens.
  const swept = useRef(false);
  useEffect(() => {
    if (swept.current) return;
    swept.current = true;
    const cutoff = Date.now() - KEEP_DONE_MS;
    for (const [id, t] of Object.entries(data.todos)) if (t.done && t.done < cutoff) write(`todos/${id}`, null);
  }, [data.todos, write]);

  return createPortal(
    <div className="fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-bg" role="dialog" aria-modal="true" aria-label="To do">
      <div className="fade-up mx-auto w-full max-w-[520px] px-5 pb-[calc(48px+env(safe-area-inset-bottom,0px))]">
        <div className="pt-safe" />
        <header className="mb-7 flex items-center justify-between gap-4 pt-7">
          <h1 className="text-[36px] font-bold leading-none tracking-[-0.04em]">To do</h1>
          <button type="button" onClick={onClose} className="tap flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-[1.5px] border-ink text-ink" aria-label="Close">
            <CloseIcon />
          </button>
        </header>

        {LISTS.map((l, i) => {
          const items = lists[l.id];
          const left = items.filter((i) => !i.done).length;
          return (
            <section key={l.id} className={i ? "mt-9" : undefined}>
              <div className="flex items-baseline justify-between">
                <span className="text-[13px] text-muted">{l.name}</span>
                {left > 0 && <span className="font-mono text-[12px] tabular-nums text-muted">{left}</span>}
              </div>
              <ul className="mt-2 divide-y divide-line border-y border-line">
                {items.map((item) => (
                  <Row key={item.id} item={item} list={l.id} open={open === item.id} onOpen={setOpen} />
                ))}
                <li>
                  <Add list={l.id} />
                </li>
              </ul>
            </section>
          );
        })}
      </div>
    </div>,
    document.body,
  );
}
