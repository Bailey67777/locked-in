"use client";

import type { PhotoMeta } from "@/lib/hub/types";
import { usePhotoUrl, useVault } from "@/lib/hub/useVault";
import { cn } from "@/lib/cn";
import { LockIcon } from "./Icons";

/** One progress photo as a 3:4 tile: the picture, or the pose's name while it's empty. */
export default function PhotoTile({ meta, label, onClick, className, full = false }: { meta: PhotoMeta | undefined; label: string; onClick?: () => void; className?: string; full?: boolean }) {
  const { state } = useVault();
  const { url, error } = usePhotoUrl(meta, full ? "full" : "thumb");
  const body = meta ? (
    url ? (
      // eslint-disable-next-line @next/next/no-img-element -- a decrypted picture held in memory, not a file the server can optimise
      <img src={url} alt={label} className="fade-in h-full w-full object-cover" draggable={false} />
    ) : state === "locked" ? (
      <LockIcon className="text-faint" />
    ) : error ? (
      <span className="px-2 text-center text-[11px] leading-tight text-muted">{error}</span>
    ) : (
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-faint" />
    )
  ) : (
    <span className="px-1 text-center text-[12.5px] text-muted">{label}</span>
  );
  const base = cn("relative flex aspect-[3/4] w-full items-center justify-center overflow-hidden rounded-[14px] bg-surface", className);
  return onClick ? (
    <button type="button" onClick={onClick} className={cn("tap", base)} aria-label={meta ? label : `Add ${label}`}>
      {body}
    </button>
  ) : (
    <div className={base}>{body}</div>
  );
}
