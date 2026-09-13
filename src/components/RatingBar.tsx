"use client";

import { useRef } from "react";
import { cn } from "@/lib/cn";

export type RatingTone = "ocean" | "teal" | "sunset";

const tones: Record<RatingTone, { on: string; dot: string }> = {
  ocean: { on: "bg-ocean-500", dot: "bg-ocean-500" },
  teal: { on: "bg-teal-500", dot: "bg-teal-500" },
  sunset: { on: "bg-sunset-500", dot: "bg-sunset-500" },
};

type Props = {
  label: string;
  hint?: string;
  value: number; // 0 = unset
  tone: RatingTone;
  onChange: (v: number) => void;
};

/** A 1–10 bar you can tap or drag with one thumb. */
export default function RatingBar({ label, hint, value, tone, onChange }: Props) {
  const track = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const t = tones[tone];

  const valueFromX = (clientX: number) => {
    const el = track.current;
    if (!el) return value;
    const rect = el.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, clientX - rect.left));
    return Math.max(1, Math.min(10, Math.ceil((x / rect.width) * 10)));
  };

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <div className="flex items-center gap-2">
          <span className={cn("h-2.5 w-2.5 rounded-full", t.dot)} />
          <span className="text-base font-extrabold text-ink">{label}</span>
          {hint && <span className="hidden text-xs font-semibold text-ink-muted sm:inline">{hint}</span>}
        </div>
        <div className="flex items-center gap-2">
          <span className="w-8 text-right text-lg font-extrabold tabular-nums text-ink">{value > 0 ? value : "–"}</span>
          {value > 0 && (
            <button type="button" onClick={() => onChange(0)} className="text-xs font-bold text-ink-muted hover:text-ink" aria-label={`Clear ${label} rating`}>
              clear
            </button>
          )}
        </div>
      </div>
      <div
        ref={track}
        role="slider"
        aria-label={label}
        aria-valuemin={1}
        aria-valuemax={10}
        aria-valuenow={value || undefined}
        tabIndex={0}
        className="grid h-11 grid-cols-10 gap-1 rounded-2xl"
        style={{ touchAction: "none" }}
        onPointerDown={(e) => {
          dragging.current = true;
          e.currentTarget.setPointerCapture(e.pointerId);
          onChange(valueFromX(e.clientX));
        }}
        onPointerMove={(e) => {
          if (dragging.current) onChange(valueFromX(e.clientX));
        }}
        onPointerUp={() => (dragging.current = false)}
        onPointerCancel={() => (dragging.current = false)}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight" || e.key === "ArrowUp") onChange(Math.min(10, (value || 0) + 1));
          if (e.key === "ArrowLeft" || e.key === "ArrowDown") onChange(Math.max(1, (value || 1) - 1));
        }}
      >
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
          <div
            key={n}
            className={cn(
              "flex items-end justify-center rounded-lg transition-colors",
              n <= value ? t.on : "bg-sand-100",
              n === value && "ring-2 ring-white ring-offset-1 ring-offset-sand-50",
            )}
          >
            <span className={cn("pb-1 text-[10px] font-bold", n <= value ? "text-white/80" : "text-ink-muted/60")}>{n}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
