import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement>;
const base = { fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

export function HabitsIcon(p: P) {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" {...base} {...p}>
      <circle cx="5.5" cy="6.5" r="1.6" />
      <circle cx="5.5" cy="12" r="1.6" />
      <circle cx="5.5" cy="17.5" r="1.6" />
      <path d="M10 6.5h10M10 12h10M10 17.5h10" />
    </svg>
  );
}

export function CalendarIcon(p: P) {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" {...base} {...p}>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
      <path d="M3.5 9.5h17M8 3v4M16 3v4" />
    </svg>
  );
}

export function StatsIcon(p: P) {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" {...base} {...p}>
      <path d="M5 20V12M10 20V5M15 20v-9M20 20v-5" />
    </svg>
  );
}

export function SettingsIcon(p: P) {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" {...base} {...p}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h0a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

export function CheckIcon(p: P) {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" {...base} strokeWidth={2.4} {...p}>
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}

export function ChevronIcon({ dir = "right", ...p }: P & { dir?: "left" | "right" | "up" | "down" }) {
  const r = { right: 0, down: 90, left: 180, up: 270 }[dir];
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" {...base} {...p} style={{ transform: `rotate(${r}deg)`, ...p.style }}>
      <path d="M9 5l7 7-7 7" />
    </svg>
  );
}

export function CloseIcon(p: P) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" {...base} {...p}>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

export function PlusIcon(p: P) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" {...base} {...p}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
