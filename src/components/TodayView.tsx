"use client";

import { useMemo } from "react";
import { useStore } from "@/lib/store";
import { useBanners, useProfilePhoto } from "@/lib/banners";
import { formatLong, greetingFor, keyFromDate } from "@/lib/dates";
import { dayStreak } from "@/lib/stats";
import { pickForDay } from "@/lib/model";
import type { SeasonPhotos } from "@/lib/season";
import DayEditor from "./DayEditor";
import Photo from "./Photo";

export default function TodayView({ seasonPhotos }: { seasonPhotos: SeasonPhotos }) {
  const { today, data, season } = useStore();
  const greeting = greetingFor(new Date());
  const streak = useMemo(() => dayStreak(data.days, data.settings, today), [data, today]);
  const banners = useBanners(season);
  const profile = useProfilePhoto();

  // Photos added in the app come first (one added today shows today), then this season's photos in the repo,
  // a different one each day, then hero.jpg.
  const banner = useMemo(() => {
    if (!banners.ready) return [];
    const list = banners.list;
    const fresh = [...list].reverse().find((b) => keyFromDate(new Date(b.at)) === today);
    const uploaded = fresh ?? pickForDay(list, today);
    if (uploaded) return [uploaded.data];
    const repo = pickForDay(seasonPhotos[season], today);
    return repo ? [repo, "/photos/hero.jpg"] : ["/photos/hero.jpg"];
  }, [banners.ready, banners.list, seasonPhotos, season, today]);

  return (
    <div className="rise flex flex-col gap-3">
      <header className="flex items-end justify-between gap-4 px-1 pb-1">
        <div className="min-w-0">
          <div className="label">{formatLong(today)}</div>
          <h1 className="mt-1.5 font-serif text-[34px] leading-[0.95] text-ink">
            {greeting}, <span className="italic">{data.settings.name}</span>
          </h1>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {streak.current >= 1 && (
            <span className="chip font-mono shadow-soft" title="Days in a row with every habit done">
              🔥 <span className="tabular-nums text-ink">{streak.current}</span>
            </span>
          )}
          <Photo src={!profile.ready ? [] : profile.data ? [profile.data] : "/photos/profile.jpg"} alt="Profile" variant="avatar" className="h-10 w-10 ring-2 ring-white/80" />
        </div>
      </header>

      <Photo src={banner} alt="Banner" className="h-40 w-full shadow-soft md:h-48" />

      <DayEditor date={today} />
    </div>
  );
}
