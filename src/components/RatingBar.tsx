"use client";

import { useRef } from "react";
import { cn } from "@/lib/cn";

export type RatingTone = "ocean" | "teal" | "sunset";

const tones: Record<RatingTone, string> = { ocean: "bg-ocean-500", teal: "bg-teal-500", sunset: "bg-sunset-500" };

type Props = {
  label: string;
  value: number; // 0 = unset
  tone: RatingTone;
  onChange: (v: number) => void;
};

/** A slim 1–10 bar you can tap or drag with one thumb. Tap the number to clear it. */
export default function RatingBar({ label, value, tone, onChange }: Props) {
  const track = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const valueFromX = (clientX: number) => {
    const el = track.current;
    if (!el) return value;
    const rect = el.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, clientX - rect.left));
    return Math.max(1, Math.min(10, Math.ceil((x / rect.width) * 10)));
  };

  return (
    <div className="flex items-center gap-3">
      <span className="w-[72px] shrink-0 text-[12.5px] font-bold text-ink-soft">{label}</span>
      <div
        ref={track}
        role="slider"
        aria-label={label}
        aria-valuemin={1}
        aria-valuemax={10}
        aria-valuenow={value || undefined}
        tabIndex={0}
        className="grid h-[22px] flex-1 cursor-pointer grid-cols-10 gap-[3px]"
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
          if (e.key === "Backspace" || e.key === "Delete") onChange(0);
        }}
      >
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
          <div key={n} className={cn("rounded-[5px] transition-colors", n <= value ? tones[tone] : "bg-sand-100")} style={n <= value ? { opacity: 0.45 + (n / 10) * 0.55 } : undefined} />
        ))}
      </div>
      <button
        type="button"
        onClick={() => value > 0 && onChange(0)}
        className="w-7 shrink-0 text-right text-[14px] font-extrabold tabular-nums text-ink"
        aria-label={value > 0 ? `Clear ${label} rating` : `${label} not rated`}
        title={value > 0 ? "Tap to clear" : undefined}
      >
        {value > 0 ? value : <span className="text-ink-muted/60">–</span>}
      </button>
    </div>
  );
}
