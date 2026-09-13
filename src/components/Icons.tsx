import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement>;
const base = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" } as const;

export function SunIcon(p: P) {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" {...base} {...p}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

export function CalendarIcon(p: P) {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" {...base} {...p}>
      <rect x="3" y="5" width="18" height="16" rx="3" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </svg>
  );
}

export function TrendIcon(p: P) {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" {...base} {...p}>
      <path d="M3 17l5-6 4 4 5-7 4 3" />
      <path d="M3 21h18" />
    </svg>
  );
}

export function SettingsIcon(p: P) {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" {...base} {...p}>
      <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
      <circle cx="16" cy="7" r="2.5" />
      <circle cx="10" cy="17" r="2.5" />
    </svg>
  );
}

export function CheckIcon(p: P) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" {...base} strokeWidth={3} {...p}>
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}

export function PlusIcon(p: P) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" {...base} {...p}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function CloseIcon(p: P) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" {...base} {...p}>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

export function ChevronIcon({ dir = "right", ...p }: P & { dir?: "left" | "right" | "up" | "down" }) {
  const rot = { right: 0, down: 90, left: 180, up: 270 }[dir];
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" {...base} style={{ transform: `rotate(${rot}deg)` }} {...p}>
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

export function ArrowRightIcon(p: P) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" {...base} {...p}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

export function TrashIcon(p: P) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" {...base} {...p}>
      <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
    </svg>
  );
}

export function WaveMark(p: P) {
  return (
    <svg viewBox="0 0 64 64" width="28" height="28" {...p}>
      <defs>
        <linearGradient id="wm-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fbe3c4" />
          <stop offset="0.6" stopColor="#f6b26b" />
          <stop offset="1" stopColor="#1a6fd1" />
        </linearGradient>
        <linearGradient id="wm-sea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3f9bd0" />
          <stop offset="1" stopColor="#0b2a47" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill="url(#wm-sky)" />
      <circle cx="32" cy="28" r="11" fill="#fff4d6" />
      <path d="M0 38 C 8 34, 16 34, 24 38 S 40 42, 48 38 S 60 34, 64 38 L64 64 L0 64 Z" fill="url(#wm-sea)" />
      <path d="M0 44 C 8 40, 16 40, 24 44 S 40 48, 48 44 S 60 40, 64 44" fill="none" stroke="#fbf7f0" strokeWidth="2.5" strokeLinecap="round" opacity="0.8" />
    </svg>
  );
}
