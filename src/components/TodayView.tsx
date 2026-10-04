"use client";

import { useMemo } from "react";
import { useStore } from "@/lib/store";
import { formatLong, greetingFor } from "@/lib/dates";
import { dayStreak } from "@/lib/stats";
import { pickForDay } from "@/lib/model";
import type { SeasonPhotos } from "@/lib/season";
import DayEditor from "./DayEditor";
import Photo from "./Photo";

export default function TodayView({ seasonPhotos }: { seasonPhotos: SeasonPhotos }) {
  const { today, data, season } = useStore();
  const greeting = greetingFor(new Date());
  const streak = useMemo(() => dayStreak(data.days, data.settings, today), [data, today]);
  // A different photo from this season's folder each day; hero.jpg when the folder is empty.
  const photo = pickForDay(seasonPhotos[season], today);

  return (
    <div className="rise flex flex-col gap-3">
      <header className="flex items-end justify-between gap-4 px-1 pb-1">
        <div className="min-w-0">
          <div className="label">{formatLong(today)}</div>
          <h1 className="mt-1.5 font-serif text-[40px] leading-[0.95] tracking-[-0.015em] text-ink">
            {greeting}, <span className="italic">{data.settings.name}</span>
          </h1>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {streak.current >= 1 && (
            <span className="chip shadow-soft" title="Days in a row with every habit done">
              🔥 <span className="tabular-nums text-ink">{streak.current}</span>
            </span>
          )}
          <Photo src="/photos/profile.jpg" alt="Profile" variant="avatar" className="h-10 w-10 ring-2 ring-white/80" />
        </div>
      </header>

      <Photo src={photo ? [photo, "/photos/hero.jpg"] : "/photos/hero.jpg"} alt="Banner" className="h-40 w-full shadow-soft md:h-48" />

      <DayEditor date={today} />
    </div>
  );
}
