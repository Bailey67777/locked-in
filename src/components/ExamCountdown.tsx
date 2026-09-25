"use client";

import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { formatLong, splitDuration } from "@/lib/dates";

/** Live countdown to the first A-level exam (date set in Settings). */
export default function ExamCountdown() {
  const { data } = useStore();
  const examDate = data.settings.examDate;
  const [now, setNow] = useState(0);

  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = window.setTimeout(tick, 0);
    const id = window.setInterval(tick, 1000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(id);
    };
  }, []);

  if (!examDate) {
    return (
      <section className="card p-4 md:p-5">
        <h2 className="text-lg font-extrabold text-ink">⏳ First A-level exam</h2>
        <p className="mt-1 text-sm font-semibold text-ink-muted">Set the date in Settings and the countdown starts here.</p>
      </section>
    );
  }

  const target = new Date(`${examDate}T09:00`).getTime();
  const past = now > 0 && target < now;
  const d = splitDuration(target - (now || target));

  return (
    <section className="card overflow-hidden" style={{ borderLeft: "8px solid #d95f18" }}>
      <div className="bg-sunset-100/40 p-4">
        <h2 className="text-lg font-extrabold leading-tight text-ink">⏳ {past ? "First A-level exam was" : "First A-level exam"}</h2>
        <div className="text-xs font-bold text-ink-muted">{formatLong(examDate)} {examDate.slice(0, 4)}</div>
        <div className="mt-3 grid grid-cols-4 gap-2">
          {(
            [
              [d.days, "days"],
              [d.hours, "hours"],
              [d.minutes, "mins"],
              [d.seconds, "secs"],
            ] as const
          ).map(([v, label]) => (
            <div key={label} className="rounded-2xl bg-white/85 px-1 py-2 text-center shadow-soft">
              <div className="text-2xl font-extrabold leading-none tabular-nums text-ink md:text-3xl">{now ? v : "–"}</div>
              <div className="mt-1 text-[10px] font-extrabold uppercase tracking-wider text-ink-muted">{label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
