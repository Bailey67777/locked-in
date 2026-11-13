"use client";

import type { DayHabit, Settings } from "@/lib/types";
import { cn } from "@/lib/cn";
import { CheckIcon } from "./Icons";

type Props = {
  habits: DayHabit[];
  settings: Settings;
  locked?: boolean;
  onToggle: (id: string) => void;
};

/** The day's habits: a circle, a name, and the time if it has one. */
export default function HabitList({ habits, settings, locked = false, onToggle }: Props) {
  if (!habits.length) return <p className="py-10 text-center text-[14px] text-muted">No habits yet. Add up to ten in Settings.</p>;
  return (
    <ul className="divide-y divide-line border-y border-line">
      {habits.map((h) => {
        const time = settings.habits.find((x) => x.id === h.id)?.time;
        return (
          <li key={h.id}>
            <button
              type="button"
              onClick={() => onToggle(h.id)}
              disabled={locked}
              aria-pressed={h.done}
              className="tap flex w-full items-center gap-4 py-[13px] text-left disabled:active:scale-100"
            >
              <span
                className={cn(
                  "flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border-[1.5px] transition-colors duration-200",
                  h.done ? "border-ink bg-ink text-bg" : "border-faint",
                )}
              >
                {h.done && <CheckIcon width={12} height={12} />}
              </span>
              <span className={cn("min-w-0 flex-1 truncate text-[17px] tracking-[-0.012em] transition-colors duration-200", h.done ? "text-muted" : "text-ink")}>{h.name}</span>
              {time && <span className="shrink-0 font-mono text-[12px] tabular-nums text-muted">{time}</span>}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
