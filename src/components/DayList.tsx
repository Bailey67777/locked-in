"use client";

import type { EditMeta, Settings, Todo } from "@/lib/types";
import { habitLook } from "@/lib/model";
import { AUTO_EMOJIS, HABIT_COLORS } from "@/lib/defaults";
import { cn } from "@/lib/cn";
import { ArrowRightIcon, CheckIcon, CloseIcon } from "./Icons";

const COLORS = HABIT_COLORS.filter((c) => c.name !== "Slate");

/** How an item looks: a habit uses its own emoji, colour and time; anything else gets an emoji and colour picked from its id. */
export function itemLook(t: Todo, settings: Settings): { emoji: string; color: string; time?: string; name: string } {
  if (t.habitId) {
    const look = habitLook(t.habitId, settings);
    return { emoji: look.emoji, color: look.color, time: look.time, name: settings.habits.find((h) => h.id === t.habitId)?.name ?? t.text };
  }
  let h = 7;
  for (let i = 0; i < t.id.length; i++) h = (h * 31 + t.id.charCodeAt(i)) >>> 0;
  return { emoji: AUTO_EMOJIS[h % AUTO_EMOJIS.length], color: COLORS[(h >>> 5) % COLORS.length].hex, name: t.text };
}

type Props = {
  items: Todo[];
  settings: Settings;
  streaks?: Record<string, number>;
  edits?: Record<string, EditMeta>;
  onToggle: (id: string) => void;
  onDelete?: (id: string) => void;
  onCarryOver?: (id: string) => void;
};

/** The day's To Do: habits and everything else in one list, in the order it was written. */
export default function DayList({ items, settings, streaks = {}, edits = {}, onToggle, onDelete, onCarryOver }: Props) {
  if (!items.length) return null;
  return (
    <ul className="-mx-4 divide-y divide-black/[0.06] border-y border-black/[0.06]">
      {items.map((t) => {
        const look = itemLook(t, settings);
        const streak = t.habitId ? (streaks[t.habitId] ?? 0) : 0;
        const edit = t.editId ? edits[t.editId] : undefined;
        return (
          <li
            key={t.id}
            className="flex items-center pr-2 transition-colors"
            style={t.done ? { background: `linear-gradient(90deg, ${look.color}5c, ${look.color}38 70%, ${look.color}26)` } : undefined}
          >
            <button type="button" onClick={() => onToggle(t.id)} aria-pressed={t.done} className="tap flex min-w-0 flex-1 items-center gap-3 py-3 pl-4 text-left">
              {look.time && <span className={cn("w-10 shrink-0 font-mono text-[11.5px] tabular-nums", t.done ? "text-ink" : "text-ink-muted")}>{look.time}</span>}
              <span
                className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full border-[1.5px] transition-colors"
                style={{ borderColor: t.done ? "#ffffff" : look.color, backgroundColor: t.done ? "#ffffff" : `${look.color}12` }}
              >
                {t.done ? <CheckIcon width={15} height={15} style={{ color: look.color }} strokeWidth={3.2} /> : <span className="text-[15px] leading-none">{look.emoji}</span>}
              </span>
              <span className="fancy min-w-0 flex-1 truncate text-[16.5px] text-ink">{look.name}</span>
              {edit && !t.done && (
                <span className="shrink-0 text-[13px]" title={`Plays "${edit.name}" when ticked`} aria-label="Has an edit">
                  🎬
                </span>
              )}
              {streak >= 2 && (
                <span className="shrink-0 font-mono text-[11px] tabular-nums text-ink-soft" title={`${streak}-day streak`}>
                  🔥{streak}
                </span>
              )}
            </button>
            {!t.done && !t.habitId && onCarryOver && (
              <button type="button" onClick={() => onCarryOver(t.id)} className="btn-icon h-8 w-8 text-ink-muted" title="Move to tomorrow" aria-label="Move to tomorrow">
                <ArrowRightIcon width={14} height={14} />
              </button>
            )}
            {onDelete && (
              <button type="button" onClick={() => onDelete(t.id)} className="btn-icon h-8 w-8 text-ink-muted" title="Remove from this day" aria-label={`Remove ${look.name}`}>
                <CloseIcon width={14} height={14} />
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
