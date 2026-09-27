"use client";

import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { owedVideos } from "@/lib/model";
import RewardVideo from "./RewardVideo";

/**
 * If any submitted day's tier video hasn't been watched to the end, play it now, full screen,
 * before anything else. Oldest first. Lives in the app shell so it fires on every open, on any tab.
 */
export default function VideoGate() {
  const { data, loaded, updateDay } = useStore();
  const [dismissed, setDismissed] = useState<string[]>([]);
  const owed = useMemo(() => owedVideos(data.days).filter((d) => !dismissed.includes(d.date)), [data.days, dismissed]);
  const first = owed[0];
  if (!loaded || !first || !first.submitted) return null;
  const sub = first.submitted;
  const done = () => updateDay(first.date, (d) => ({ ...d, submitted: d.submitted ? { ...d.submitted, watched: true } : d.submitted }));
  return <RewardVideo key={first.date} date={first.date} tier={sub.tier} pct={sub.pct} keystoneMissed={sub.keystoneMissed} required onWatched={done} onClose={() => setDismissed((x) => [...x, first.date])} />;
}
