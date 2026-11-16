"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useHub } from "@/lib/hub/store";
import { lessonsFor, unseenRating } from "@/lib/hub/model";
import { useCalendarDay } from "@/lib/hub/calendar";
import { useWeather, weatherWord } from "@/lib/hub/weather";
import { sleepLength, useWhoopSync } from "@/lib/hub/whoop";
import { SUBJECT_META } from "@/lib/hub/subjects";
import { dayTitle } from "@/lib/hub/time";
import { addDays, formatLong } from "@/lib/dates";
import { lockScroll } from "@/lib/scrollLock";
import type { Rating } from "@/lib/hub/types";

const COUNT_MS = 1400;
/** The card waits for the morning: opening the app after midnight, before bed, doesn't use it up. */
const FROM_HOUR = 4;

/** The number, counting up to the rating once. */
function Score({ value }: { value: number }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const id = window.setTimeout(() => setShown(value), 0);
      return () => window.clearTimeout(id);
    }
    let raf = 0;
    const from = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - from) / COUNT_MS);
      setShown(value * (1 - Math.pow(1 - t, 3))); // fast, then settling
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    // Timers and frames stop when the app is in the background: land on the real number regardless.
    const land = window.setTimeout(() => setShown(value), COUNT_MS + 200);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(land);
    };
  }, [value]);
  return <>{shown.toFixed(2)}</>;
}

function Row({ name, children }: { name: string; children: React.ReactNode }) {
  return (
    <li className="flex items-baseline justify-between gap-4 py-[13px]">
      <span className="text-[17px] font-medium tracking-[-0.015em]">{name}</span>
      <span className="text-right font-mono text-[13px] tabular-nums text-ink-2">{children}</span>
    </li>
  );
}

function Card({ rated, onClose }: { rated: { date: string; rating: Rating } | null; onClose: () => void }) {
  const { data, today } = useHub();
  const settings = data.settings;
  const { events, error } = useCalendarDay(settings.calendarUrl, today);
  const waiting = Boolean(settings.calendarUrl) && events === null && !error;
  const lessons = lessonsFor(today, settings.calendarUrl && events === null && error ? { ...settings, calendarUrl: "" } : settings, events);
  const weather = useWeather(today);
  const whoop = data.whoop[today];

  useEffect(() => lockScroll(), []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => (e.key === "Escape" || e.key === "Enter") && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return createPortal(
    <div className="fade-in fixed inset-0 z-[80] overflow-y-auto bg-bg text-ink" role="dialog" aria-modal="true" aria-label="This morning" onClick={onClose}>
      <div className="mx-auto flex min-h-full w-full max-w-[520px] flex-col justify-center px-6 py-10">
        <div className="pt-safe" />
        <div className="label text-center">{formatLong(today)}</div>

        {rated && (
          <div className="mt-9 text-center">
            <div className="text-[13px] text-muted">{dayTitle(rated.date, today)}</div>
            <div className="mt-2 text-[104px] font-bold leading-none tracking-[-0.06em] tabular-nums">
              <Score value={rated.rating.score} />
            </div>
            <div className="mt-3 text-[15px] text-muted">out of 10</div>
          </div>
        )}

        <ul className="mt-10 divide-y divide-line border-y border-line">
          {whoop?.sleep !== undefined && <Row name="Sleep">{`${whoop.sleep}%${whoop.asleep ? ` · ${sleepLength(whoop.asleep)}` : ""}`}</Row>}
          {whoop?.recovery !== undefined && <Row name="Recovery">{`${whoop.recovery}%`}</Row>}
          <Row name="Weather">{weather ? `${weatherWord(weather.code)} · ${weather.high}° / ${weather.low}°${weather.code < 51 && weather.rain >= 40 ? ` · ${weather.rain}% rain` : ""}` : "–"}</Row>
        </ul>

        <div className="label mt-9">Lessons</div>
        <ul className="mt-2 divide-y divide-line border-y border-line">
          {lessons.length ? (
            lessons.map((l) => (
              <Row key={l.key} name={SUBJECT_META[l.subject].name}>
                {l.start ? `${l.start}${l.end && l.end !== l.start ? `–${l.end}` : ""}` : ""}
              </Row>
            ))
          ) : (
            <li className="py-[13px] text-center text-[15px] text-faint">{waiting ? "…" : "–"}</li>
          )}
        </ul>
        <button type="button" onClick={onClose} className="sr-only">
          Close
        </button>
        <div className="pb-safe" />
      </div>
    </div>,
    document.body,
  );
}

/**
 * The morning card: the first time the app is opened each day it shows yesterday's rating from Claude (out of ten),
 * last night's sleep and this morning's recovery from the WHOOP, today's weather, and today's lessons. A tap
 * anywhere puts it away, on every device, until tomorrow. A rating that arrives later is shown the same way.
 */
export default function Morning() {
  const { data, today, now, fresh, write } = useHub();
  useWhoopSync();
  // Only once the cloud's copy is in: this device's copy may not know it was already put away elsewhere.
  const unseen = fresh ? unseenRating(data.ratings, today) : null;
  const due = fresh && Boolean(today) && data.morning !== today && new Date(now).getHours() >= FROM_HOUR;
  if (!unseen && !due) return null;

  const yesterday = addDays(today, -1);
  const rated = unseen ?? (data.ratings[yesterday] ? { date: yesterday, rating: data.ratings[yesterday] } : null);

  const close = () => {
    const at = Date.now();
    if (data.morning !== today && new Date(now).getHours() >= FROM_HOUR) write("morning", today);
    // Ratings that were never opened are put away with it: only the newest is ever shown.
    for (const [date, r] of Object.entries(data.ratings)) if (!r.seen && date <= today) write(`ratings/${date}/seen`, at);
  };

  return <Card rated={rated} onClose={close} />;
}
