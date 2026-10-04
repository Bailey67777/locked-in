"use client";

import { useRef, useState } from "react";
import { useBanners } from "@/lib/banners";
import { processBanner } from "@/lib/images";
import { SEASONS, SEASON_LABEL, type Season } from "@/lib/season";
import { cn } from "@/lib/cn";
import { CloseIcon, PlusIcon } from "./Icons";

/** Add or remove each season's banner photos from inside the app. */
export default function BannerManager({ current }: { current: Season }) {
  const [season, setSeason] = useState<Season>(current);
  const { list, ready, add, remove } = useBanners(season);
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pick = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    setError(null);
    try {
      for (const f of Array.from(files)) add(await processBanner(f));
    } catch {
      setError("Couldn't read that image. Try a JPG or PNG.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };

  return (
    <div className="mt-4 border-t border-black/[0.06] pt-4">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="font-serif text-[17px] leading-none text-ink">Banner photos</h3>
        <span className="card-sub">a different one each day</span>
      </div>
      <div className="mt-3 flex gap-1 rounded-full border border-white/70 bg-white/50 p-1">
        {SEASONS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSeason(s)}
            aria-pressed={season === s}
            className={cn("tap flex-1 rounded-full py-1.5 text-[12px] font-bold", season === s ? "bg-ink text-white" : "text-ink-muted hover:text-ink")}
          >
            {SEASON_LABEL[s]}
          </button>
        ))}
      </div>

      <input ref={input} type="file" accept="image/*" multiple className="hidden" onChange={(e) => pick(e.target.files)} />
      <div className="mt-3 grid grid-cols-3 gap-2">
        {list.map((b) => (
          <div key={b.id} className="relative aspect-[4/3] overflow-hidden rounded-xl bg-sand-100">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={b.data} alt="" className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => remove(b.id)}
              className="tap absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur"
              aria-label="Remove photo"
            >
              <CloseIcon width={12} height={12} />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={busy || !ready}
          className="tap flex aspect-[4/3] flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-ink/20 text-ink-muted hover:bg-white/60 disabled:opacity-50"
        >
          <PlusIcon width={18} height={18} />
          <span className="font-mono text-[10px] uppercase tracking-[0.1em]">{busy ? "Adding…" : "Add"}</span>
        </button>
      </div>
      {error && <p className="mt-2 text-[12px] font-bold text-sunset-600">{error}</p>}
      <p className="card-desc mt-2">
        {list.length === 0 ? `No ${SEASON_LABEL[season].toLowerCase()} photos yet, so the banner uses your default photo.` : `${list.length} ${SEASON_LABEL[season].toLowerCase()} photo${list.length === 1 ? "" : "s"}.`} Saved to your database, so they show on your phone and laptop.
      </p>
    </div>
  );
}
