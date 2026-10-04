"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";

type Props = {
  /** One path, or several to try in order (the first that exists is shown). */
  src: string | string[];
  alt: string;
  className?: string;
  variant?: "hero" | "avatar";
  /** Small text shown over the bottom-left of a hero. */
  caption?: string;
};

/**
 * Shows your own photo if the file exists in /public/photos, otherwise a calm placeholder in the season's colours.
 * Swap the picture by dropping a file at one of the `src` paths — no code changes needed.
 */
export default function Photo({ src, alt, className, variant = "hero", caption }: Props) {
  const list = Array.isArray(src) ? src : [src];
  const key = list.join("|");
  const [state, setState] = useState<{ key: string; index: number; ok: boolean }>({ key, index: 0, ok: false });
  // A new list (e.g. the season changed) starts again from the top.
  const current = state.key === key ? state : { key, index: 0, ok: false };
  const missing = current.index >= list.length;
  const isAvatar = variant === "avatar";

  const idx = current.index;
  const same = (s: typeof state) => (s.key === key ? s.index : 0) === idx;
  const fail = () => setState((s) => (same(s) ? { key, index: idx + 1, ok: false } : s));
  const ok = () => setState((s) => (same(s) && !(s.key === key && s.ok) ? { key, index: idx, ok: true } : s));

  return (
    <div
      className={cn("relative overflow-hidden", isAvatar ? "rounded-full" : "rounded-3xl", className)}
      style={{ background: "linear-gradient(160deg, var(--color-ocean-100), var(--color-sand-100) 55%, var(--color-sunset-100))" }}
    >
      {!missing && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={list[current.index]}
          src={list[current.index]}
          alt={alt}
          // Small images can finish loading before React attaches onLoad (especially from the service-worker
          // cache), so also check the already-complete state the moment the element mounts.
          ref={(el) => {
            if (el && el.complete && !current.ok) {
              if (el.naturalWidth > 0) ok();
              else if (el.currentSrc) fail();
            }
          }}
          onLoad={ok}
          onError={fail}
          className={cn("absolute inset-0 h-full w-full object-cover transition-opacity duration-700", current.ok ? "opacity-100" : "opacity-0")}
        />
      )}
      {missing && !isAvatar && (
        <svg viewBox="0 0 200 120" className="absolute inset-x-0 bottom-0 h-2/3 w-full" preserveAspectRatio="none" aria-hidden="true">
          <path d="M0 70 C 40 52, 80 52, 120 68 S 180 82, 200 66 L200 120 L0 120 Z" style={{ fill: "var(--color-ocean-200)" }} opacity="0.6" />
          <path d="M0 92 C 40 78, 90 80, 130 92 S 185 102, 200 94 L200 120 L0 120 Z" style={{ fill: "var(--color-ocean-400)" }} opacity="0.45" />
        </svg>
      )}
      {missing && isAvatar && <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold uppercase tracking-wider text-ocean-800/70">You</span>}
      {!isAvatar && caption && (
        <span className="absolute bottom-2.5 left-2.5 rounded-full bg-black/35 px-2.5 py-1 text-[11px] font-bold text-white backdrop-blur-md">{caption}</span>
      )}
    </div>
  );
}
