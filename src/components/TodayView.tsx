"use client";

import { useMemo } from "react";
import { useStore } from "@/lib/store";
import { formatLong, greetingFor } from "@/lib/dates";
import { dayStreak } from "@/lib/stats";
import { SEASON_EMOJI, SEASON_LABEL, heroCandidates } from "@/lib/season";
import DayEditor from "./DayEditor";
import Photo from "./Photo";

export default function TodayView() {
  const { today, data, season, seasonChoice } = useStore();
  const greeting = greetingFor(new Date());
  const streak = useMemo(() => dayStreak(data.days, data.settings, today), [data, today]);
  // Month photos only follow the real calendar; previewing another season in Settings uses that season's photo.
  const month = seasonChoice === "auto" ? new Date(`${today}T12:00`).getMonth() : null;

  return (
    <div className="rise flex flex-col gap-3">
      <header className="flex items-end justify-between gap-4 px-1 pb-1">
        <div className="min-w-0">
          <div className="label">{formatLong(today)}</div>
          <h1 className="mt-0.5 font-serif text-[34px] leading-[1.05] tracking-[-0.01em] text-ink">
            {greeting}, <span className="italic">{data.settings.name}</span>
          </h1>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {streak.current >= 1 && (
            <span className="chip bg-white/80 shadow-soft" title="Days in a row with every habit done">
              🔥 <span className="tabular-nums text-ink">{streak.current}</span>
            </span>
          )}
          <Photo src="/photos/profile.jpg" alt="Profile" variant="avatar" className="h-10 w-10 ring-2 ring-white" />
        </div>
      </header>

      <Photo src={heroCandidates(season, month)} alt="Banner" caption={`${SEASON_EMOJI[season]} ${SEASON_LABEL[season]} · Bristol`} className="h-36 w-full md:h-44" />

      <DayEditor date={today} />
    </div>
  );
}
