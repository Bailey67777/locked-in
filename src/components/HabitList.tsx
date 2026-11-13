"use client";

import type { DayHabit } from "@/lib/types";
import { cn } from "@/lib/cn";
import { CheckIcon } from "./Icons";

type Props = {
  habits: DayHabit[];
  locked?: boolean;
  onToggle: (id: string) => void;
};

/** The day's habits: a circle and a name. */
export default function HabitList({ habits, locked = false, onToggle }: Props) {
  if (!habits.length) return <p className="py-10 text-center text-[14px] text-muted">No habits.</p>;
  return (
    <ul className="divide-y divide-line border-y border-line">
      {habits.map((h) => (
        <li key={h.id}>
          <button
            type="button"
            onClick={() => onToggle(h.id)}
            disabled={locked}
            aria-pressed={h.done}
            className="tap flex w-full items-center gap-4 py-[15px] text-left disabled:active:scale-100"
          >
            <span
              className={cn(
                "flex h-[25px] w-[25px] shrink-0 items-center justify-center rounded-full border-[1.75px] transition-colors duration-200",
                h.done ? "border-ink bg-ink text-bg" : "border-muted",
              )}
            >
              {h.done && <CheckIcon width={13} height={13} />}
            </span>
            <span className={cn("min-w-0 flex-1 truncate text-[19px] font-medium tracking-[-0.015em] transition-colors duration-200", h.done ? "text-muted" : "text-ink")}>{h.name}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
