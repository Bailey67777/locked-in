"use client";

import { useState } from "react";
import { useHub } from "@/lib/hub/store";
import { dayTitle } from "@/lib/hub/time";
import Sheet from "./Sheet";

/** The day's weight in kilograms. */
export default function WeightSheet({ date, onClose }: { date: string; onClose: () => void }) {
  const { data, today, write } = useHub();
  const saved = data.weights[date];
  const [value, setValue] = useState(saved ? String(saved) : "");
  const kg = Number(value.replace(",", "."));
  const ok = Number.isFinite(kg) && kg >= 20 && kg <= 300;

  return (
    <Sheet label={dayTitle(date, today)} onClose={onClose}>
      <h2 className="mt-1 text-[28px] font-bold leading-tight tracking-[-0.035em]">Weight</h2>
      <form
        className="mt-5"
        onSubmit={(e) => {
          e.preventDefault();
          if (!ok) return;
          write(`weights/${date}`, Math.round(kg * 10) / 10);
          onClose();
        }}
      >
        <label className="flex h-16 items-center gap-3 rounded-2xl border border-line bg-surface px-4">
          <input value={value} onChange={(e) => setValue(e.target.value)} inputMode="decimal" autoFocus placeholder="0.0" className="min-w-0 flex-1 bg-transparent text-[28px] font-bold tracking-[-0.03em] tabular-nums text-ink placeholder:text-faint focus:outline-none" aria-label="Weight in kilograms" />
          <span className="text-[15px] text-muted">kg</span>
        </label>
        <div className="mt-3 flex gap-2">
          {saved !== undefined && (
            <button
              type="button"
              className="btn-quiet h-12 px-5"
              onClick={() => {
                write(`weights/${date}`, null);
                onClose();
              }}
            >
              Remove
            </button>
          )}
          <button type="submit" className="btn flex-1" disabled={!ok}>
            Save
          </button>
        </div>
      </form>
    </Sheet>
  );
}
