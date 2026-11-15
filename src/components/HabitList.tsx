"use client";

import type { ReactNode } from "react";
import type { DayHabit } from "@/lib/types";
import { cn } from "@/lib/cn";
import { CheckIcon } from "./Icons";

type Props = {
  habits: DayHabit[];
  locked?: boolean;
  /** Stretch the rows to share the height they're given (the Habits page fills the screen). */
  fill?: boolean;
  onToggle: (id: string) => void;
  /** Something on the right of a row (the play button for an edit). */
  trailing?: (h: DayHabit) => ReactNode;
};

/** The day's habits: a circle and a name. */
export default function HabitList({ habits, locked = false, fill = false, onToggle, trailing }: Props) {
  if (!habits.length) return <p className="py-10 text-center text-[14px] text-muted">No habits.</p>;
  return (
    // When filling, the lines are drawn as shadows so they take up no space and every row is exactly the same height.
    <ul className={cn(fill ? "flex flex-1 flex-col" : "divide-y divide-line border-y border-line")}>
      {habits.map((h, i) => (
        <li key={h.id} className={cn("flex items-center", fill && "min-h-[38px] flex-1")} style={fill ? { boxShadow: `inset 0 1px 0 var(--line)${i === habits.length - 1 ? ", inset 0 -1px 0 var(--line)" : ""}` } : undefined}>
          <button
            type="button"
            onClick={() => onToggle(h.id)}
            disabled={locked}
            aria-pressed={h.done}
            className={cn("tap flex w-full items-center gap-3.5 text-left disabled:active:scale-100", fill ? "py-1" : "py-[13px]")}
          >
            <span
              className={cn(
                "flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border-[1.75px] transition-colors duration-200",
                h.done ? "border-ink bg-ink text-bg" : "border-muted",
              )}
            >
              {h.done && <CheckIcon width={12} height={12} />}
            </span>
            <span className={cn("min-w-0 flex-1 truncate text-[17px] font-medium tracking-[-0.015em] transition-colors duration-200", h.done ? "text-muted" : "text-ink")}>{h.name}</span>
          </button>
          {trailing?.(h)}
        </li>
      ))}
    </ul>
  );
}
