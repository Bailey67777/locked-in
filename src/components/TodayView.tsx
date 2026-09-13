"use client";

import { useStore } from "@/lib/store";
import { formatLong, greetingFor } from "@/lib/dates";
import { oneLinerFor } from "@/lib/defaults";
import DayEditor from "./DayEditor";
import Photo from "./Photo";

export default function TodayView() {
  const { today, data } = useStore();
  const greeting = greetingFor(new Date());

  return (
    <div className="rise flex flex-col gap-4">
      <header className="flex items-center gap-4 px-1">
        <Photo src="/photos/profile.jpg" alt="Profile" variant="avatar" className="h-14 w-14 shrink-0 shadow-soft" />
        <div className="min-w-0 flex-1">
          <div className="label">{formatLong(today)}</div>
          <h1 className="truncate text-2xl font-extrabold leading-tight text-ink md:text-3xl">
            {greeting}, {data.settings.name}.
          </h1>
        </div>
      </header>

      <div className="relative">
        <Photo src="/photos/hero.jpg" alt="Your banner" className="h-40 w-full md:h-56" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 rounded-b-3xl bg-gradient-to-t from-ocean-900/70 to-transparent px-5 pb-4 pt-10">
          <p className="text-base font-extrabold text-white drop-shadow md:text-lg">{oneLinerFor(today)}</p>
        </div>
      </div>

      <DayEditor date={today} />
    </div>
  );
}
