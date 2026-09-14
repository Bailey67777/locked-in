"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";

type Props = {
  src: string;
  alt: string;
  className?: string;
  variant?: "hero" | "avatar" | "wall";
};

/**
 * Shows your own photo if the file exists in /public/photos, otherwise a calm wave placeholder.
 * Swap the picture by dropping a file at the `src` path — no code changes needed.
 */
export default function Photo({ src, alt, className, variant = "hero" }: Props) {
  const [state, setState] = useState<"loading" | "ok" | "missing">("loading");
  const isAvatar = variant === "avatar";
  const isWall = variant === "wall";

  return (
    <div
      className={cn(
        "relative overflow-hidden bg-gradient-to-b from-ocean-100 via-sand-100 to-ocean-200",
        isAvatar ? "rounded-full" : isWall ? "rounded-xl" : "rounded-3xl",
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
        <div className={cn("absolute inset-0 flex flex-col items-center text-ocean-800", isAvatar || isWall ? "justify-center" : "justify-start pt-[8%]")}>
          <svg viewBox="0 0 200 120" className={cn("absolute inset-x-0 bottom-0 w-full", isAvatar ? "h-1/2" : "h-2/3")} preserveAspectRatio="none" aria-hidden="true">
            <path d="M0 60 C 30 40, 60 40, 90 60 S 150 80, 180 60 S 200 50, 200 55 L200 120 L0 120 Z" fill="#7dbde0" opacity="0.55" />
            <path d="M0 80 C 30 60, 60 60, 90 80 S 150 100, 180 80 S 200 70, 200 75 L200 120 L0 120 Z" fill="#1a6fd1" opacity="0.5" />
            <path d="M0 100 C 30 85, 60 85, 90 100 S 150 115, 180 100 L200 100 L200 120 L0 120 Z" fill="#134a7f" opacity="0.55" />
          </svg>
          {!isAvatar && <div className={cn("absolute rounded-full bg-sunset-300/90 shadow-[0_0_30px_10px_rgba(246,178,107,0.45)]", isWall ? "right-[12%] top-[12%] h-6 w-6" : "right-[12%] top-[16%] h-10 w-10")} />}
          {isAvatar ? (
            <span className="relative text-[10px] font-extrabold uppercase tracking-wider text-ocean-800/80">You</span>
          ) : isWall ? (
            <div className="relative z-10 rounded-full bg-white/85 px-2.5 py-1 text-center shadow-soft backdrop-blur">
              <div className="text-[11px] font-extrabold text-ocean-800">Add a photo</div>
              <div className="text-[9px] font-semibold text-ink-muted">{src.replace(/^\//, "public/")}</div>
            </div>
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
