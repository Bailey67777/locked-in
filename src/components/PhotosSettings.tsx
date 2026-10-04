"use client";

import { useRef, useState } from "react";
import { useProfilePhoto } from "@/lib/banners";
import { processSquare } from "@/lib/images";
import type { Season } from "@/lib/season";
import BannerManager from "./BannerManager";
import Photo from "./Photo";

/** Settings → Photos: the profile picture and each season's banner photos. */
export default function PhotosSettings({ season }: { season: Season }) {
  const profile = useProfilePhoto();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      profile.save(await processSquare(file));
    } catch {
      setError("Couldn't read that image. Try a JPG or PNG.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };

  return (
    <section className="card p-4">
      <h2 className="card-title">Photos</h2>

      <div className="mt-4 flex items-center gap-4">
        <Photo src={!profile.ready ? [] : profile.data ? [profile.data] : "/photos/profile.jpg"} alt="Profile picture" variant="avatar" className="h-16 w-16 shrink-0 ring-2 ring-white/80" />
        <div className="min-w-0 flex-1">
          <div className="font-serif text-[17px] leading-none text-ink">Profile picture</div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <input ref={input} type="file" accept="image/*" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
            <button type="button" className="btn-primary px-4 py-2 text-[12.5px]" onClick={() => input.current?.click()} disabled={busy}>
              {busy ? "Saving…" : "Change"}
            </button>
            {profile.data && (
              <button type="button" className="btn-ghost text-[12.5px]" onClick={() => profile.save(null)}>
                Use default
              </button>
            )}
          </div>
          {error && <p className="mt-1.5 text-[12px] font-bold text-sunset-600">{error}</p>}
        </div>
      </div>

      <BannerManager current={season} />
    </section>
  );
}
