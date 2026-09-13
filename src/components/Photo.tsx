"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";

type Props = {
  src: string;
  alt: string;
  className?: string;
  variant?: "hero" | "avatar";
};

/**
 * Shows your own photo if the file exists in /public/photos, otherwise a calm wave placeholder.
 * Swap the picture by dropping a file at the `src` path — no code changes needed.
 */
export default function Photo({ src, alt, className, variant = "hero" }: Props) {
  const [state, setState] = useState<"loading" | "ok" | "missing">("loading");
  const isAvatar = variant === "avatar";

  return (
    <div
      className={cn(
        "relative overflow-hidden bg-gradient-to-b from-ocean-100 via-sand-100 to-ocean-200",
        isAvatar ? "rounded-full" : "rounded-3xl",
        className,
      )}
    >
      {state !== "missing" && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt}
          onLoad={() => setState("ok")}
          onError={() => setState("missing")}
          className={cn(
            "absolute inset-0 h-full w-full object-cover transition-opacity duration-500",
            state === "ok" ? "opacity-100" : "opacity-0",
          )}
        />
      )}
      {state === "missing" && (
        <div className={cn("absolute inset-0 flex flex-col items-center text-ocean-800", isAvatar ? "justify-center" : "justify-start pt-[8%]")}>
          <svg viewBox="0 0 200 120" className={cn("absolute inset-x-0 bottom-0 w-full", isAvatar ? "h-1/2" : "h-2/3")} preserveAspectRatio="none" aria-hidden="true">
            <path d="M0 60 C 30 40, 60 40, 90 60 S 150 80, 180 60 S 200 50, 200 55 L200 120 L0 120 Z" fill="#7dbde0" opacity="0.55" />
            <path d="M0 80 C 30 60, 60 60, 90 80 S 150 100, 180 80 S 200 70, 200 75 L200 120 L0 120 Z" fill="#1a6fd1" opacity="0.5" />
            <path d="M0 100 C 30 85, 60 85, 90 100 S 150 115, 180 100 L200 100 L200 120 L0 120 Z" fill="#134a7f" opacity="0.55" />
          </svg>
          {!isAvatar && <div className="absolute right-[12%] top-[16%] h-10 w-10 rounded-full bg-sunset-300/90 shadow-[0_0_30px_10px_rgba(246,178,107,0.45)]" />}
          {isAvatar ? (
            <span className="relative text-[10px] font-extrabold uppercase tracking-wider text-ocean-800/80">You</span>
          ) : (
            <div className="relative z-10 flex items-center gap-2 rounded-full bg-white/80 px-3 py-1.5 shadow-soft backdrop-blur">
              <span className="text-xs font-extrabold text-ocean-800">Add your photo</span>
              <span className="hidden text-[11px] font-semibold text-ink-muted sm:inline">· {src.replace(/^\//, "public/")}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
