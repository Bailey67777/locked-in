"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { formatBytes, formatClock } from "@/lib/model";
import { VideoIcon } from "./Icons";
import VlogPlayer from "./VlogPlayer";

/** The vlog for one day: record it, watch it, redo it or delete it. Shown at the top of a day opened from the calendar. */
export default function VlogCard({ date, onRecord }: { date: string; onRecord: () => void }) {
  const { data, today, vlogPending, removeVlog } = useStore();
  const [playing, setPlaying] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const meta = data.days[date]?.vlog;
  const pending = vlogPending[date];
  if (date > today && !meta && !pending) return null;

  const status = pending
    ? pending.state === "waiting"
      ? "Saved on this device. It uploads when you're back online."
      : `Uploading… ${pending.uploaded} of ${pending.total} parts`
    : meta
      ? `${formatClock(meta.dur)} · ${formatBytes(meta.bytes)}`
      : date === today
        ? "Not filmed yet"
        : "None for this day";

  return (
    <section className="card mb-3 p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="card-title">Vlog</h2>
        <span className="card-sub">{status}</span>
      </div>
      {pending && pending.state === "uploading" && (
        <div className="mt-3 h-[2px] w-full overflow-hidden rounded-full bg-black/[0.06]" aria-hidden="true">
          <div className="grad-fill h-full rounded-full transition-[width] duration-300" style={{ width: `${Math.round((pending.uploaded / Math.max(1, pending.total)) * 100)}%` }} />
        </div>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {meta || pending ? (
          <>
            <button type="button" className="btn-primary flex-1" onClick={() => setPlaying(true)}>
              ▶ Watch
            </button>
            <button type="button" className="btn-ghost" onClick={onRecord}>
              Redo
            </button>
            {confirming ? (
              <button
                type="button"
                className="btn-ghost bg-sunset-100 text-sunset-700"
                onClick={() => {
                  setConfirming(false);
                  void removeVlog(date);
                }}
              >
                Really delete?
              </button>
            ) : (
              <button type="button" className="btn-ghost text-sunset-600" onClick={() => setConfirming(true)}>
                Delete
              </button>
            )}
          </>
        ) : (
          <button type="button" className="btn-primary flex-1" onClick={onRecord}>
            <VideoIcon width={16} height={16} /> Record {date === today ? "today's" : "a"} vlog
          </button>
        )}
      </div>
      {playing && <VlogPlayer date={date} onClose={() => setPlaying(false)} />}
    </section>
  );
}
