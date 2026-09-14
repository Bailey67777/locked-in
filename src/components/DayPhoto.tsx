"use client";

import { useEffect, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { processPhoto } from "@/lib/images";
import { CloseIcon } from "./Icons";

/** A photo attached to one day. The thumbnail shows on the calendar; the bigger version loads here on demand. */
export default function DayPhoto({ date }: { date: string }) {
  const { getDay, getDayPhoto, setDayPhoto, removeDayPhoto } = useStore();
  const day = getDay(date);
  const [photo, setPhoto] = useState<{ date: string; data: string | null } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const hasThumb = Boolean(day.thumb);

  useEffect(() => {
    if (!hasThumb) return;
    let cancelled = false;
    getDayPhoto(date).then((data) => {
      if (!cancelled) setPhoto({ date, data });
    });
    return () => {
      cancelled = true;
    };
  }, [date, hasThumb, getDayPhoto, day.updatedAt]);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const processed = await processPhoto(file);
      await setDayPhoto(date, processed);
      setPhoto({ date, data: processed.medium });
    } catch {
      setError("Couldn't read that image. Try a JPG or PNG.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };

  const shown = hasThumb ? (photo?.date === date ? photo.data : null) ?? day.thumb : null;

  return (
    <section className="card p-4 md:p-5">
      <div className="mb-3 flex items-baseline justify-between">
        <div>
          <h2 className="text-lg font-extrabold text-ink">Photo of the day</h2>
          <p className="text-sm font-semibold text-ink-muted">Shows on the calendar. A face, a view, a plate, anything.</p>
        </div>
      </div>
      <input ref={input} type="file" accept="image/*" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
      {shown ? (
        <div className="relative overflow-hidden rounded-2xl bg-sand-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={shown} alt={`Photo from ${date}`} className="block max-h-96 w-full object-cover" />
          <div className="absolute right-2 top-2 flex gap-1">
            <button type="button" className="tap rounded-full bg-white/90 px-3 py-1.5 text-xs font-extrabold text-ink shadow-soft" onClick={() => input.current?.click()} disabled={busy}>
              Replace
            </button>
            <button type="button" className="tap flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-ink shadow-soft" onClick={() => removeDayPhoto(date)} aria-label="Remove photo">
              <CloseIcon width={16} height={16} />
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={busy}
          className="tap flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-sand-300 bg-sand-50 px-4 py-6 text-sm font-extrabold text-ocean-700 hover:bg-sand-100 disabled:opacity-60"
        >
          {busy ? "Saving…" : "📷 Add a photo"}
        </button>
      )}
      {error && <p className="mt-2 text-xs font-bold text-sunset-600">{error}</p>}
    </section>
  );
}
