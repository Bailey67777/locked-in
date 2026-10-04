"use client";

import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { owedVideos } from "@/lib/model";
import RewardVideo from "./RewardVideo";

/**
 * When a submitted day earned the reward video (80%+) and it hasn't played yet, play it now.
 * Lives in the app shell so it fires right after submitting, or on the next open if it couldn't load.
 */
export default function VideoGate() {
  const { data, loaded, updateDay } = useStore();
  const [dismissed, setDismissed] = useState<string[]>([]);
  const owed = useMemo(() => owedVideos(data.days).filter((d) => !dismissed.includes(d.date)), [data.days, dismissed]);
  const first = owed[0];
  if (!loaded || !first || !first.submitted) return null;
  const done = () => updateDay(first.date, (d) => ({ ...d, submitted: d.submitted ? { ...d.submitted, watched: true } : d.submitted }));
  return <RewardVideo key={first.date} date={first.date} pct={first.submitted.pct} onWatched={done} onClose={() => setDismissed((x) => [...x, first.date])} />;
}
