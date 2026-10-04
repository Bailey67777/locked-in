"use client";

import type { DayHabit, Settings } from "@/lib/types";
import { habitLook } from "@/lib/model";
import { cn } from "@/lib/cn";
import { CheckIcon } from "./Icons";

type Props = {
  habits: DayHabit[];
  settings: Settings;
  streaks?: Record<string, number>;
  onToggle: (id: string) => void;
};

export default function HabitChecklist({ habits, settings, streaks = {}, onToggle }: Props) {
  if (habits.length === 0) {
    return <p className="py-3 text-center text-[13px] font-semibold text-ink-muted">No habits yet. Add a few in Settings.</p>;
  }
  return (
    <ul className="-mx-1.5 flex flex-col">
      {habits.map((h) => {
        const look = habitLook(h.id, settings);
        const streak = streaks[h.id] ?? 0;
        return (
          <li key={h.id}>
            <button
              type="button"
              onClick={() => onToggle(h.id)}
              aria-pressed={h.done}
              className="tap flex min-h-[34px] w-full items-center gap-2.5 rounded-lg px-1.5 py-1 text-left transition-colors hover:bg-sand-50"
            >
              <span
                className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-[1.5px] transition-colors"
                style={{ borderColor: look.color, backgroundColor: h.done ? look.color : "transparent" }}
              >
                {h.done && <CheckIcon width={11} height={11} className="text-white" strokeWidth={3.5} />}
              </span>
              <span className="w-4 shrink-0 text-center text-[13px] leading-none">{look.emoji}</span>
              <span className={cn("min-w-0 flex-1 truncate text-[13.5px] font-semibold transition-colors", h.done ? "text-ink-muted line-through decoration-ink-muted/40" : "text-ink")}>{h.name}</span>
              {streak >= 2 && (
                <span className="shrink-0 text-[10.5px] font-bold tabular-nums text-sunset-600" title={`${streak}-day streak`}>
                  🔥{streak}
                </span>
              )}
              {look.time && <span className="w-9 shrink-0 text-right text-[11px] font-semibold tabular-nums text-ink-muted">{look.time}</span>}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
