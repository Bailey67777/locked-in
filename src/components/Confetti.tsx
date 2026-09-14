"use client";

const COLORS = ["#1a6fd1", "#1f9a8a", "#d95f18", "#ef8a3c", "#f6b26b", "#6b4fbb", "#d9435f", "#5b8c00"];

/** A quick burst of paper when the day is complete. Pure CSS, removed by the parent after ~2.5s. */
export default function Confetti() {
  const pieces = Array.from({ length: 36 }, (_, i) => ({
    left: `${(i * 37) % 100}%`,
    delay: `${(i % 9) * 0.06}s`,
    dur: `${1.6 + ((i * 13) % 7) * 0.12}s`,
    color: COLORS[i % COLORS.length],
    rot: `${(i * 53) % 360}deg`,
    w: 6 + (i % 3) * 3,
    h: 10 + (i % 4) * 3,
  }));
  return (
    <div className="pointer-events-none fixed inset-0 z-[60] overflow-hidden" aria-hidden="true">
      {pieces.map((p, i) => (
        <span
          key={i}
          className="confetti-piece"
          style={{ left: p.left, animationDelay: p.delay, animationDuration: p.dur, backgroundColor: p.color, width: p.w, height: p.h, transform: `rotate(${p.rot})` }}
        />
      ))}
    </div>
  );
}
