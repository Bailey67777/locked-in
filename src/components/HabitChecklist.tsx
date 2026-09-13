"use client";

import type { DayHabit } from "@/lib/types";
import { cn } from "@/lib/cn";
import { CheckIcon } from "./Icons";

export default function HabitChecklist({ habits, onToggle }: { habits: DayHabit[]; onToggle: (id: string) => void }) {
  if (habits.length === 0) {
    return <p className="py-4 text-center text-sm font-semibold text-ink-muted">No habits yet. Add a few in Settings.</p>;
  }
  return (
    <ul className="flex flex-col gap-2">
      {habits.map((h, i) => (
        <li key={h.id}>
          <button
            type="button"
            onClick={() => onToggle(h.id)}
            aria-pressed={h.done}
            className={cn(
              "tap flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition-colors",
              h.done ? "bg-teal-100/70" : "bg-sand-50 hover:bg-sand-100",
            )}
          >
            <span
              className={cn(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                h.done ? "border-teal-500 bg-teal-500 text-white" : "border-sand-300 bg-white text-transparent",
              )}
            >
              <CheckIcon />
            </span>
            <span className={cn("flex-1 text-[15px] font-bold leading-snug", h.done ? "text-teal-700" : "text-ink")}>{h.name}</span>
            <span className="text-xs font-extrabold text-ink-muted/60">{i + 1}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
