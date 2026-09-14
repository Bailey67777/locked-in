"use client";

import { useMemo } from "react";
import { useStore } from "@/lib/store";
import { formatLong, greetingFor } from "@/lib/dates";
import { dayStreak } from "@/lib/stats";
import DayEditor from "./DayEditor";
import Photo from "./Photo";

export default function TodayView() {
  const { today, data } = useStore();
  const greeting = greetingFor(new Date());
  const streak = useMemo(() => dayStreak(data.days, data.settings, today), [data, today]);

  return (
    <div className="rise flex flex-col gap-4">
      <header className="flex items-center gap-4 px-1">
        <Photo src="/photos/profile.jpg" alt="Profile" variant="avatar" className="h-14 w-14 shrink-0 shadow-soft" />
        <div className="min-w-0 flex-1">
          <div className="label">{formatLong(today)}</div>
          <h1 className="text-2xl font-extrabold leading-tight text-ink md:text-3xl">
            {greeting}, {data.settings.name}.
          </h1>
        </div>
        {streak.current >= 1 && (
          <div className="shrink-0 rounded-full bg-white/80 px-3 py-1.5 text-sm font-extrabold text-sunset-600 shadow-soft" title="Days in a row with every habit done">
            🔥 {streak.current} <span className="text-[10px] font-extrabold uppercase tracking-wider text-ink-muted">day{streak.current === 1 ? "" : "s"}</span>
          </div>
        )}
      </header>

      <Photo src="/photos/hero.jpg" alt="Your banner" className="h-40 w-full md:h-56" />

      <DayEditor date={today} />
    </div>
  );
}
