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
  // Same picture as public/icons/icon.svg: sun, grass, someone standing by the lake.
  return (
    <svg viewBox="0 0 512 512" width="28" height="28" {...p}>
      <defs>
        <linearGradient id="lg-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#bfe3f7" />
          <stop offset="0.7" stopColor="#e9f3fa" />
          <stop offset="1" stopColor="#f6ead2" />
        </linearGradient>
        <linearGradient id="lg-lake" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#4aa7dc" />
          <stop offset="1" stopColor="#1a6fd1" />
        </linearGradient>
        <linearGradient id="lg-grass" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7cc242" />
          <stop offset="1" stopColor="#4e9a2a" />
        </linearGradient>
        <clipPath id="lg-clip">
          <rect width="512" height="512" rx="112" />
        </clipPath>
      </defs>
      <g clipPath="url(#lg-clip)">
        <rect width="512" height="512" fill="url(#lg-sky)" />
        <g stroke="#f6a623" strokeWidth="14" strokeLinecap="round">
          <line x1="128" y1="40" x2="128" y2="10" /><line x1="128" y1="246" x2="128" y2="216" />
          <line x1="25" y1="128" x2="-5" y2="128" /><line x1="231" y1="128" x2="261" y2="128" />
          <line x1="55" y1="55" x2="34" y2="34" /><line x1="201" y1="201" x2="222" y2="222" />
          <line x1="55" y1="201" x2="34" y2="222" /><line x1="201" y1="55" x2="222" y2="34" />
        </g>
        <circle cx="128" cy="128" r="70" fill="#ffd54a" stroke="#f6a623" strokeWidth="10" />
        <ellipse cx="420" cy="330" rx="260" ry="90" fill="#9ad06a" />
        <path d="M0 340 C 90 318, 180 318, 270 340 S 440 362, 512 340 L512 512 L0 512 Z" fill="url(#lg-grass)" />
        <ellipse cx="380" cy="415" rx="150" ry="62" fill="url(#lg-lake)" />
        <path d="M262 405 C 300 396, 340 396, 380 405 S 460 414, 500 405" fill="none" stroke="#dff1fb" strokeWidth="7" strokeLinecap="round" opacity="0.9" />
        <g stroke="#1b2a36" strokeWidth="12" strokeLinecap="round" fill="none">
          <circle cx="160" cy="310" r="28" fill="#fbf7f0" />
          <line x1="160" y1="338" x2="160" y2="420" />
          <line x1="160" y1="360" x2="118" y2="392" />
          <line x1="160" y1="360" x2="206" y2="330" />
          <line x1="160" y1="420" x2="130" y2="476" />
          <line x1="160" y1="420" x2="192" y2="476" />
        </g>
      </g>
    </svg>
  );
}
