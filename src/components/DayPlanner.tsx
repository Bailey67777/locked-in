"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useStore } from "@/lib/store";
import { useEditBank } from "@/lib/edits";
import { addDays, formatLong } from "@/lib/dates";
import { habitItem, uid } from "@/lib/model";
import type { Todo } from "@/lib/types";
import { cn } from "@/lib/cn";
import { ChevronIcon, CloseIcon, PlusIcon } from "./Icons";
import { EMOJI_SUGGESTIONS, HABIT_COLORS } from "@/lib/defaults";
import { itemLook } from "./DayList";
import EditPicker from "./EditPicker";

const sameItem = (a: Todo, b: Todo) => (a.habitId ? a.habitId === b.habitId : !b.habitId && a.text.trim().toLowerCase() === b.text.trim().toLowerCase());

/**
 * Write a day's To Do: habits and anything else in one list, each with an optional edit that plays when it's ticked.
 * Everything saves as you go. A future day that is never written starts with all your habits.
 */
export default function DayPlanner({ date, onClose }: { date: string; onClose: () => void }) {
  const { data, today, getDay, updateDay } = useStore();
  const bank = useEditBank();
  const settings = data.settings;
  const stored = data.days[date];
  const written = date <= today || Boolean(stored?.list);
  // A future day nobody has written yet only shows what's really on it (e.g. something moved from another day).
  const items: Todo[] = written ? getDay(date).todos : (stored?.todos ?? []).filter((t) => !t.habitId);
  const source = addDays(date, -1);
  const sourceItems = getDay(source).todos;
  const sourceLabel = source === today ? "today's" : date === today ? "yesterday's" : `${formatLong(source)}'s`;
  const [text, setText] = useState("");
  const [picking, setPicking] = useState<string | null>(null);
  const [styling, setStyling] = useState<string | null>(null);
  const [customEmoji, setCustomEmoji] = useState("");
  const [confirmClear, setConfirmClear] = useState(false);
  const missingHabits = settings.habits.filter((h) => !items.some((t) => t.habitId === h.id));

  const write = (next: Todo[]) => updateDay(date, (d) => ({ ...d, list: true, todos: next }));

  const importFrom = () => {
    const extra = sourceItems
      .filter((s) => !items.some((t) => sameItem(t, s)))
      .map((s) => (s.habitId ? { ...s, ...habitItem({ id: s.habitId, name: s.text }) } : { ...s, id: uid(), done: false }));
    write([...items, ...extra]);
  };
  const addAllHabits = () => write([...items, ...missingHabits.map((h) => habitItem(h))]);
  const addText = () => {
    const t = text.trim();
    if (!t) return;
    write([...items, { id: uid(), text: t, done: false }]);
    setText("");
  };
  const patch = (id: string, changes: Partial<Todo>) => write(items.map((t) => (t.id === id ? { ...t, ...changes } : t)));
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    write(next);
  };

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !picking && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose, picking]);

  const pickingItem = picking ? items.find((t) => t.id === picking) : undefined;

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/30 backdrop-blur-sm md:items-center md:p-6"
      onClick={(e) => {
        e.stopPropagation();
        if (e.target === e.currentTarget && !picking) onClose();
      }}
    >
      <div className="flex max-h-[94dvh] w-full max-w-xl flex-col overflow-hidden rounded-t-3xl bg-sand-50 shadow-lift md:max-h-[90vh] md:rounded-3xl" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={`Write the To Do for ${formatLong(date)}`}>
        <div className="flex items-center justify-between border-b border-sand-200 bg-white/80 px-4 py-3 backdrop-blur">
          <div className="min-w-0">
            <div className="label">{date === today ? "Today's To Do" : date === addDays(today, 1) ? "Writing tomorrow" : "Writing"}</div>
            <div className="truncate font-serif text-[20px] leading-tight text-ink">{formatLong(date)}</div>
          </div>
          <button type="button" className="btn-primary px-4" onClick={onClose}>
            Done
          </button>
        </div>

        <div className="overflow-y-auto p-4 pb-safe">
          {!written && items.length === 0 && (
            <div className="mb-3 rounded-2xl bg-white/70 p-3.5">
              <p className="font-serif text-[17px] leading-snug text-ink">Not written yet. Start from:</p>
              <div className="mt-2.5 flex flex-col gap-1.5">
                <button type="button" className="btn-primary" onClick={importFrom} disabled={!sourceItems.length}>
                  ⤵ Import {sourceLabel} To Do
                </button>
                <button type="button" className="btn-ghost bg-white/80" onClick={addAllHabits} disabled={!missingHabits.length}>
                  ⭐ All my habits
                </button>
              </div>
              <p className="mt-2 text-[11.5px] text-ink-muted">Or just type below. If you never write it, the day starts with all your habits.</p>
            </div>
          )}

          {items.length > 0 && (
            <ul className="mb-3 divide-y divide-black/[0.06] overflow-hidden rounded-2xl bg-white/70">
              {items.map((t, i) => {
                const look = itemLook(t, settings);
                const edit = t.editId ? bank.byId[t.editId] : undefined;
                return (
                  <li key={t.id}>
                    <div className="flex items-center gap-2 py-2 pl-3 pr-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setStyling(styling === t.id ? null : t.id);
                        setCustomEmoji("");
                      }}
                      className={cn("tap flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full border-[1.5px] text-[14px]", styling === t.id && "ring-2 ring-ink ring-offset-1")}
                      style={{ borderColor: look.color, backgroundColor: `${look.color}12` }}
                      aria-label={`Change emoji and colour for ${look.name}`}
                      aria-expanded={styling === t.id}
                    >
                      {t.done ? "✓" : look.emoji}
                    </button>
                    {t.habitId ? (
                      <span className="min-w-0 flex-1">
                        <span className="fancy block truncate text-[15.5px] text-ink">{look.name}</span>
                        <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-muted">habit{look.time ? ` · ${look.time}` : ""}</span>
                      </span>
                    ) : (
                      <input
                        key={`${t.id}:${t.text}`}
                        defaultValue={t.text}
                        onBlur={(e) => {
                          const v = e.target.value.trim();
                          if (v && v !== t.text) patch(t.id, { text: v });
                        }}
                        onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                        className="fancy min-w-0 flex-1 rounded-lg bg-transparent px-1 py-1 text-[15.5px] text-ink focus:bg-white focus:outline-none"
                        aria-label="To-do text"
                      />
                    )}
                    <button
                      type="button"
                      onClick={() => setPicking(t.id)}
                      className={cn("tap flex h-8 shrink-0 items-center gap-1 rounded-full px-2 text-[11.5px] font-bold", edit ? "bg-ink text-white" : "bg-sand-100 text-ink-soft")}
                      title={edit ? `Plays "${edit.name}"` : "Add an edit"}
                      aria-label={edit ? `Edit: ${edit.name}. Change it` : "Add an edit"}
                    >
                      🎬{edit ? <span className="max-w-[4.5rem] truncate">{edit.name}</span> : <span>+</span>}
                    </button>
                    <span className="flex shrink-0 flex-col">
                      <button type="button" className="btn-icon h-5 w-7" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up">
                        <ChevronIcon dir="up" width={13} height={13} />
                      </button>
                      <button type="button" className="btn-icon h-5 w-7" onClick={() => move(i, 1)} disabled={i === items.length - 1} aria-label="Move down">
                        <ChevronIcon dir="down" width={13} height={13} />
                      </button>
                    </span>
                    <button type="button" className="btn-icon h-8 w-8 text-ink-muted" onClick={() => write(items.filter((x) => x.id !== t.id))} aria-label={`Remove ${look.name}`}>
                      <CloseIcon width={14} height={14} />
                    </button>
                    </div>
                    {styling === t.id && (
                      <div className="border-t border-black/[0.05] bg-sand-50/80 px-3 py-2.5">
                        <div className="flex flex-wrap gap-1">
                          {EMOJI_SUGGESTIONS.map((e) => (
                            <button key={e} type="button" onClick={() => patch(t.id, { emoji: e })} className={cn("tap h-8 w-8 rounded-lg text-[16px]", look.emoji === e ? "bg-ink/10 ring-1 ring-ink/40" : "hover:bg-white")} aria-label={`Use ${e}`}>
                              {e}
                            </button>
                          ))}
                        </div>
                        <form
                          className="mt-2 flex items-center gap-1.5"
                          onSubmit={(e) => {
                            e.preventDefault();
                            const v = customEmoji.trim();
                            if (v) patch(t.id, { emoji: v.slice(0, 8) });
                            setCustomEmoji("");
                          }}
                        >
                          <input value={customEmoji} onChange={(e) => setCustomEmoji(e.target.value)} placeholder="Or type any emoji" className="field w-36 py-1.5 text-[14px]" aria-label="Custom emoji" />
                          <button type="submit" className="btn-ghost bg-white/80 px-3 py-1.5 text-[12px]" disabled={!customEmoji.trim()}>
                            Use
                          </button>
                        </form>
                        <div className="mt-2.5 flex flex-wrap gap-1.5">
                          {HABIT_COLORS.map((c) => (
                            <button
                              key={c.hex}
                              type="button"
                              onClick={() => patch(t.id, { color: c.hex })}
                              className={cn("tap h-7 w-7 rounded-full border-2", look.color.toLowerCase() === c.hex.toLowerCase() ? "border-ink" : "border-white")}
                              style={{ backgroundColor: c.hex }}
                              aria-label={c.name}
                              title={c.name}
                            />
                          ))}
                        </div>
                        <div className="mt-2 flex items-center justify-between">
                          {t.emoji || t.color ? (
                            <button type="button" className="text-[12px] font-bold text-ink-muted underline" onClick={() => patch(t.id, { emoji: undefined, color: undefined })}>
                              {t.habitId ? "Back to the habit's own" : "Back to the default"}
                            </button>
                          ) : (
                            <span />
                          )}
                          <button type="button" className="btn-ghost bg-white/80 px-3 py-1.5 text-[12px]" onClick={() => setStyling(null)}>
                            Done
                          </button>
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          <form
            className="flex items-center gap-1.5"
            onSubmit={(e) => {
              e.preventDefault();
              addText();
            }}
          >
            <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Add to the list" className="field py-2 text-[14px]" enterKeyHint="done" autoComplete="off" />
            <button type="submit" className="btn-primary h-[38px] w-[38px] shrink-0 px-0" aria-label="Add" disabled={!text.trim()}>
              <PlusIcon width={18} height={18} />
            </button>
          </form>

          {missingHabits.length > 0 && (
            <div className="mt-3">
              <div className="label mb-1.5">Add a habit</div>
              <div className="flex flex-wrap gap-1.5">
                {missingHabits.map((h) => (
                  <button key={h.id} type="button" onClick={() => write([...items, habitItem(h)])} className="tap chip border border-white/70 py-1 text-[12px]">
                    {h.emoji} {h.name.length > 28 ? `${h.name.slice(0, 27)}…` : h.name}
                  </button>
                ))}
                {missingHabits.length > 1 && (
                  <button type="button" onClick={addAllHabits} className="tap chip bg-ink py-1 text-[12px] text-white">
                    + all
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-1.5 border-t border-black/[0.06] pt-3">
            {(written || items.length > 0) && sourceItems.length > 0 && (
              <button type="button" className="btn-ghost bg-white/70" onClick={importFrom}>
                ⤵ Import {sourceLabel} To Do
              </button>
            )}
            {items.length > 0 &&
              (confirmClear ? (
                <button
                  type="button"
                  className="btn-ghost bg-sunset-100 text-sunset-700"
                  onClick={() => {
                    setConfirmClear(false);
                    write([]);
                  }}
                >
                  Really clear the list?
                </button>
              ) : (
                <button type="button" className="btn-ghost text-sunset-600" onClick={() => setConfirmClear(true)}>
                  Clear list
                </button>
              ))}
          </div>
          <p className="mt-2 text-[11.5px] text-ink-muted">Saves as you go. Tap an emoji to change it and its colour. 🎬 picks an edit that plays when you tick that item.</p>
        </div>
      </div>
      {pickingItem && (
        <EditPicker current={pickingItem.editId} itemName={itemLook(pickingItem, settings).name} onPick={(editId) => patch(pickingItem.id, { editId })} onClose={() => setPicking(null)} />
      )}
    </div>,
    document.body,
  );
}
