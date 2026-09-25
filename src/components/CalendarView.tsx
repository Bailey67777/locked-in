"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useStore } from "@/lib/store";
import { formatLong, monthGrid, monthLabel, parseKey } from "@/lib/dates";
import { dayHasEntry, dayProgress, hasJournal, hasRatings, tierById } from "@/lib/model";
import { processPhoto } from "@/lib/images";
import { cn } from "@/lib/cn";
import { CameraIcon, ChevronIcon, CloseIcon } from "./Icons";
import DayEditor from "./DayEditor";

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

export default function CalendarView() {
  const { today, data, getDay, setDayPhoto, getDayPhoto } = useStore();
  const t = parseKey(today);
  const [year, setYear] = useState(t.getFullYear());
  const [month, setMonth] = useState(t.getMonth());
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const [banner, setBanner] = useState<{ date: string; data: string } | null>(null);

  useEffect(() => {
    if (!selected) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setSelected(null);
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [selected]);

  // The bigger version of a day's photo, shown as a banner at the top of that day's record.
  const selectedThumb = selected ? data.days[selected]?.thumb : undefined;
  useEffect(() => {
    if (!selected || !selectedThumb) return;
    let cancelled = false;
    getDayPhoto(selected).then((d) => {
      if (!cancelled && d) setBanner({ date: selected, data: d });
    });
    return () => {
      cancelled = true;
    };
  }, [selected, selectedThumb, getDayPhoto]);

  const shift = (n: number) => {
    const d = new Date(year, month + n, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
  };

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setPhotoError(null);
    try {
      await setDayPhoto(today, await processPhoto(file));
    } catch {
      setPhotoError("Couldn't read that image. Try a JPG or PNG.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };

  const weeks = monthGrid(year, month);
  const isCurrentMonth = year === t.getFullYear() && month === t.getMonth();

  return (
    <div className="rise flex flex-col gap-4">
      <input ref={input} type="file" accept="image/*" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
      <section className="card p-4 md:p-5">
        <div className="mb-3 flex items-center justify-between">
          <button type="button" className="btn-icon" onClick={() => shift(-1)} aria-label="Previous month">
            <ChevronIcon dir="left" />
          </button>
          <div className="text-center">
            <h1 className="text-xl font-extrabold text-ink">{monthLabel(year, month)}</h1>
            {!isCurrentMonth && (
              <button
                type="button"
                className="text-xs font-bold text-ocean-600"
                onClick={() => {
                  setYear(t.getFullYear());
                  setMonth(t.getMonth());
                }}
              >
                back to today
              </button>
            )}
          </div>
          <button type="button" className="btn-icon" onClick={() => shift(1)} aria-label="Next month">
            <ChevronIcon dir="right" />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center">
          {WEEKDAYS.map((w) => (
            <div key={w} className="py-1 text-[11px] font-extrabold uppercase tracking-wider text-ink-muted">
              {w}
            </div>
          ))}
          {weeks.flat().map((key, i) => {
            if (!key) return <div key={`e${i}`} />;
            const stored = data.days[key];
            const isFuture = key > today;
            const isToday = key === today;
            const entry = dayHasEntry(stored);
            const pct = entry ? dayProgress(getDay(key)).pct : 0;
            const thumb = stored?.thumb;
            // Past days: plain blue when empty, deeper blue / teal as more got done.
            const shade = isFuture
              ? "text-ink-muted/70 hover:bg-sand-100"
              : !entry
                ? "bg-ocean-100/70 text-ocean-900"
                : pct >= 100
                  ? "bg-teal-500 text-white"
                  : pct >= 60
                    ? "bg-ocean-400 text-white"
                    : pct >= 25
                      ? "bg-ocean-200 text-ocean-900"
                      : "bg-ocean-100 text-ocean-900";
            return (
              <div key={key} className="relative">
                <button
                  type="button"
                  onClick={() => setSelected(key)}
                  className={cn(
                    "tap relative flex aspect-square w-full flex-col items-center justify-center overflow-hidden rounded-2xl text-sm font-bold transition-colors",
                    thumb ? "bg-sand-200" : shade,
                    isToday && "ring-2 ring-sunset-500 ring-offset-2 ring-offset-white",
                  )}
                  aria-label={formatLong(key)}
                >
                  {thumb ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={thumb} alt="" className="absolute inset-0 h-full w-full object-cover" />
                      <span className="absolute left-1 top-1 rounded-md bg-white/85 px-1 text-[11px] font-extrabold tabular-nums text-ink shadow-soft">{parseKey(key).getDate()}</span>
                      {entry && <span className={cn("absolute inset-x-0 bottom-0 h-1.5", pct >= 100 ? "bg-teal-500" : pct >= 60 ? "bg-ocean-400" : "bg-ocean-200")} />}
                    </>
                  ) : (
                    <>
                      <span className="tabular-nums">{parseKey(key).getDate()}</span>
                      {stored?.submitted && <span className="absolute right-0.5 top-0.5 text-[10px] leading-none">{tierById(stored.submitted.tier).emoji}</span>}
                      {(hasRatings(stored) || hasJournal(stored)) && <span className={cn("absolute bottom-1.5 h-1.5 w-1.5 rounded-full", pct >= 60 ? "bg-white/90" : "bg-sunset-500")} />}
                    </>
                  )}
                </button>
                {isToday && !thumb && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      input.current?.click();
                    }}
                    disabled={busy}
                    className="tap absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-white text-ocean-700 shadow-soft ring-1 ring-sand-200 disabled:opacity-60"
                    aria-label="Add today's photo"
                    title="Add today's photo"
                  >
                    <CameraIcon width={15} height={15} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
        {photoError && <p className="mt-2 text-xs font-bold text-sunset-600">{photoError}</p>}

        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-bold text-ink-muted">
          <span className="flex items-center gap-1.5"><i className="h-3 w-3 rounded bg-ocean-100" /> blank day</span>
          <span className="flex items-center gap-1.5"><i className="h-3 w-3 rounded bg-ocean-400" /> most done</span>
          <span className="flex items-center gap-1.5"><i className="h-3 w-3 rounded bg-teal-500" /> all done</span>
          <span className="flex items-center gap-1.5"><CameraIcon width={13} height={13} /> today&apos;s photo</span>
          <span className="flex items-center gap-1.5">🎸 😐 😬 💀 submitted</span>
        </div>
      </section>

      <p className="px-2 text-center text-sm font-semibold text-ink-muted">Tap the camera on today to add a photo; a day you miss stays blank. Tap any day to open it.</p>

      {selected &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-ocean-900/40 backdrop-blur-sm md:items-center md:p-6" onClick={() => setSelected(null)}>
            <div
              className="flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl bg-sand-50 shadow-lift md:max-h-[88vh] md:rounded-3xl"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-label={formatLong(selected)}
            >
              <div className="flex items-center justify-between border-b border-sand-200 bg-white/80 px-4 py-3 backdrop-blur">
                <div>
                  <div className="label">{selected === today ? "Today" : selected > today ? "Upcoming" : "Looking back"}</div>
                  <div className="text-lg font-extrabold text-ink">{formatLong(selected)}</div>
                </div>
                <button type="button" className="btn-icon" onClick={() => setSelected(null)} aria-label="Close">
                  <CloseIcon />
                </button>
              </div>
              <div className="overflow-y-auto p-4 pb-safe">
                {selectedThumb && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={banner?.date === selected ? banner.data : selectedThumb} alt={`Photo from ${selected}`} className="mb-4 block max-h-72 w-full rounded-3xl object-cover shadow-soft" />
                )}
                <DayEditor date={selected} compact />
                <div className="h-4" />
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
