"use client";

import type { DayHabit, Settings } from "@/lib/types";
import { habitLook } from "@/lib/model";
import { cn } from "@/lib/cn";

type Props = {
  habits: DayHabit[];
  settings: Settings;
  streaks?: Record<string, number>;
  onToggle: (id: string) => void;
};

export default function HabitChecklist({ habits, settings, streaks = {}, onToggle }: Props) {
  if (habits.length === 0) {
    return <p className="py-4 text-center text-sm font-semibold text-ink-muted">No habits yet. Add a few in Settings.</p>;
  }
  return (
    <ul className="flex flex-col gap-2">
      {habits.map((h) => {
        const look = habitLook(h.id, settings);
        const streak = streaks[h.id] ?? 0;
        return (
          <li key={h.id}>
            <button
              type="button"
              onClick={() => onToggle(h.id)}
              aria-pressed={h.done}
              className={cn("tap flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition-colors", !h.done && "bg-sand-50 hover:bg-sand-100")}
              style={h.done ? { backgroundColor: `${look.color}1c` } : undefined}
            >
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 transition-colors"
                style={{ borderColor: look.color, backgroundColor: h.done ? look.color : "#ffffff" }}
              >
                {!h.done && <span className="text-lg leading-none">{look.emoji}</span>}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-bold leading-snug text-ink">{h.name}</span>
                {look.time && <span className="text-[11px] font-bold text-ink-muted">{look.time}</span>}
              </span>
              {streak >= 2 && (
                <span className="shrink-0 rounded-full bg-white/80 px-2 py-0.5 text-xs font-extrabold text-sunset-600 shadow-soft" title={`${streak}-day streak`}>
                  🔥 {streak}
                </span>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
