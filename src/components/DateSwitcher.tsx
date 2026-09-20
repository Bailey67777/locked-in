"use client";

import { addDays, formatLong } from "@/lib/dates";
import { ChevronIcon } from "./Icons";

/** ‹ Tuesday 15 September › with a jump back to today. */
export default function DateSwitcher({ date, today, onChange }: { date: string; today: string; onChange: (d: string) => void }) {
  return (
    <div className="card flex items-center justify-between px-2 py-2">
      <button type="button" className="btn-icon" onClick={() => onChange(addDays(date, -1))} aria-label="Previous day">
        <ChevronIcon dir="left" />
      </button>
      <div className="text-center">
        <div className="text-base font-extrabold text-ink">{date === today ? "Today" : date === addDays(today, 1) ? "Tomorrow" : date === addDays(today, -1) ? "Yesterday" : formatLong(date)}</div>
        {date === today || date === addDays(today, 1) || date === addDays(today, -1) ? (
          <div className="text-xs font-bold text-ink-muted">{formatLong(date)}</div>
        ) : (
          <button type="button" className="text-xs font-bold text-ocean-600" onClick={() => onChange(today)}>
            back to today
          </button>
        )}
      </div>
      <button type="button" className="btn-icon" onClick={() => onChange(addDays(date, 1))} aria-label="Next day">
        <ChevronIcon dir="right" />
      </button>
    </div>
  );
}
