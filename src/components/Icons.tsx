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

export function MicIcon(p: P) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" {...base} {...p}>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" />
    </svg>
  );
}

export function PlayIcon(p: P) {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" stroke="none" {...p}>
      <path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z" />
    </svg>
  );
}

export function PauseIcon(p: P) {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" stroke="none" {...p}>
      <rect x="6.5" y="5" width="4" height="14" rx="1" />
      <rect x="13.5" y="5" width="4" height="14" rx="1" />
    </svg>
  );
}

export function AcademicsIcon(p: P) {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" {...base} {...p}>
      <path d="M2.5 9 12 4.5 21.5 9 12 13.5z" />
      <path d="M6.5 11v4.75c0 1.5 2.5 3 5.5 3s5.5-1.5 5.5-3V11M21.5 9v5.5" />
    </svg>
  );
}

export function HealthIcon(p: P) {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" {...base} {...p}>
      <path d="M12 20.25S3.75 15.4 3.75 9.4A4.4 4.4 0 0 1 12 7.2a4.4 4.4 0 0 1 8.25 2.2c0 6-8.25 10.85-8.25 10.85z" />
    </svg>
  );
}

export function TodoIcon(p: P) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" {...base} {...p}>
      <path d="M4 6.75l1.75 1.75L9 5.25M4 15.75l1.75 1.75L9 14.25M13 7h7M13 16h7" />
    </svg>
  );
}

export function EyeIcon(p: P) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" {...base} {...p}>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
      <circle cx="12" cy="12" r="2.75" />
    </svg>
  );
}

export function ArrowIcon(p: P) {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" {...base} {...p}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

export function CameraIcon(p: P) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" {...base} {...p}>
      <path d="M3.5 8.5a2 2 0 0 1 2-2h2l1.4-2h6.2l1.4 2h2a2 2 0 0 1 2 2v8.75a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z" />
      <circle cx="12" cy="12.75" r="3.5" />
    </svg>
  );
}

export function LockIcon(p: P) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" {...base} {...p}>
      <rect x="5" y="10.5" width="14" height="10" rx="2.5" />
      <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
    </svg>
  );
}

export function SwapIcon(p: P) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" {...base} {...p}>
      <path d="M4 8h14M14.5 4.5 18 8l-3.500 3.500M20 16H6M9.500 12.500 6 16l3.500 3.500" />
    </svg>
  );
}

export function TrashIcon(p: P) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" {...base} {...p}>
      <path d="M4.5 7h15M9.500 7V4.750h5V7M6.500 7l.9 12.250h9.200L17.500 7" />
    </svg>
  );
}

export function MoreIcon(p: P) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" stroke="none" {...p}>
      <circle cx="5.5" cy="12" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="18.5" cy="12" r="1.6" />
    </svg>
  );
}

export function WallIcon(p: P) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" {...base} {...p}>
      <rect x="3.5" y="5" width="17" height="14" rx="1.5" />
      <path d="M3.5 9.67h17M3.5 14.33h17M12 5v4.67M8 9.67v4.66M16 9.67v4.66M12 14.33V19" />
    </svg>
  );
}

export function LibraryIcon(p: P) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" {...base} {...p}>
      <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" />
      <circle cx="8.75" cy="9.5" r="1.5" />
      <path d="m4 16.5 4.5-4 3.5 3 3-2.5 5 4.25" />
    </svg>
  );
}

export function FlipIcon(p: P) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" {...base} {...p}>
      <path d="M4.5 10a7.75 7.75 0 0 1 14-3.5M19.5 14a7.75 7.75 0 0 1-14 3.5" />
      <path d="M18.75 3v3.75H15M5.25 21v-3.75H9" />
    </svg>
  );
}

export function ReplanIcon(p: P) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" {...base} {...p}>
      <path d="M20 12a8 8 0 1 1-2.500-5.800" />
      <path d="M20 3.500V8h-4.500" />
      <path d="M12 8.500V12l2.500 1.750" />
    </svg>
  );
}

export function PlanIcon(p: P) {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" {...base} {...p}>
      <path d="M7 3.500v17" />
      <rect x="4.500" y="5.500" width="5" height="5" rx="1.500" fill="var(--bg)" />
      <rect x="4.500" y="14" width="5" height="5" rx="1.500" fill="var(--bg)" />
      <path d="M13 8h7M13 16.500h5" />
    </svg>
  );
}
