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
    return <p className="py-3 text-center text-[13px] text-ink-muted">No habits yet. Add a few in Settings.</p>;
  }
  return (
    <ul className="-mx-4 divide-y divide-black/[0.06] border-t border-black/[0.06]">
      {habits.map((h) => {
        const look = habitLook(h.id, settings);
        const streak = streaks[h.id] ?? 0;
        return (
          <li key={h.id}>
            <button
              type="button"
              onClick={() => onToggle(h.id)}
              aria-pressed={h.done}
              className="tap relative flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-white/50"
              style={h.done ? { background: `linear-gradient(90deg, ${look.color}5c, ${look.color}38 70%, ${look.color}26)` } : undefined}
            >
              {h.done && <span className="absolute inset-y-0 left-0 w-1" style={{ background: look.color }} aria-hidden="true" />}
              <span className={cn("w-10 shrink-0 font-mono text-[11.5px] tabular-nums", h.done ? "text-ink" : "text-ink-muted")}>{look.time ?? "—"}</span>
              <span
                className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full border-[1.5px] transition-colors"
                style={{ borderColor: h.done ? "#ffffff" : look.color, backgroundColor: h.done ? "#ffffff" : `${look.color}12` }}
              >
                {h.done ? <CheckIcon width={15} height={15} style={{ color: look.color }} strokeWidth={3.2} /> : <span className="text-[15px] leading-none">{look.emoji}</span>}
              </span>
              <span className="min-w-0 flex-1">
                <span className="fancy block truncate text-[16.5px] text-ink">{h.name}</span>
              </span>
              {streak >= 2 && (
                <span className="shrink-0 font-mono text-[11px] tabular-nums text-ink-soft" title={`${streak}-day streak`}>
                  🔥{streak}
                </span>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
