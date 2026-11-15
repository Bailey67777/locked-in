"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useStore } from "@/lib/store";
import { formatLong, keyFromDate, monthGrid, monthLabel, parseKey } from "@/lib/dates";
import { dayProgress } from "@/lib/model";
import { pctOn, startOf, topMissed } from "@/lib/stats";
import { haptic, playSound, playUntick } from "@/lib/sounds";
import { cn } from "@/lib/cn";
import { CloseIcon, MicIcon } from "./Icons";
import HabitList from "./HabitList";
import VoiceEntries, { useVoiceEntries } from "./VoiceEntries";
import { useHub } from "@/lib/hub/store";
import { minutesOn, total } from "@/lib/hub/model";
import { mins } from "@/lib/hub/time";
import { POSES, SUBJECT_IDS, SUBJECT_META } from "@/lib/hub/subjects";
import SubjectMark from "./SubjectMark";
import type { PoseId } from "@/lib/hub/types";
import PhotoTile from "./PhotoTile";
import PhotoViewer from "./PhotoViewer";
import { lockScroll } from "@/lib/scrollLock";

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

/** How dark a day's square is: nothing to count stays clear, 0% is a hint of grey, 100% is solid. */
const shade = (pct: number | null) => (pct === null ? 0 : pct === 0 ? 0.07 : 0.14 + (pct / 100) * 0.86);

/** A slash corner to corner, like crossing a day out on a paper calendar. */
function Slash({ light }: { light: boolean }) {
  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 40 40" preserveAspectRatio="none" aria-hidden="true">
      <line x1="7" y1="33" x2="33" y2="7" stroke={light ? "var(--bg)" : "var(--ink)"} strokeWidth="1.6" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function DaySheet({ date, onClose }: { date: string; onClose: () => void }) {
  const { today, data, getDay, updateDay } = useStore();
  const settings = data.settings;
  const day = getDay(date);
  const counts = date >= startOf(settings);
  const progress = dayProgress(day);
  const entries = useVoiceEntries(date);
  const hub = useHub();
  const photos = hub.data.photos[date] ?? {};
  const hasPhotos = Object.keys(photos).length > 0;
  const bySubject = minutesOn(date, hub.data.sessions, hub.data.timer, hub.now);
  const studied = total(bySubject);
  const rating = hub.data.ratings[date];
  const said = Object.values(hub.data.days[date]?.logs ?? {}).filter((l) => l.text.trim());
  const goy = hub.data.goy[date];
  const [photo, setPhoto] = useState<PoseId | null>(null);

  useEffect(() => {
    const unlock = lockScroll();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !photo && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      unlock();
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose, photo]);

  const toggle = (id: string) => {
    const turningOn = !day.habits.find((h) => h.id === id)?.done;
    updateDay(date, (d) => ({ ...d, habits: d.habits.map((h) => (h.id === id ? { ...h, done: !h.done } : h)) }));
    haptic(turningOn ? 10 : 6);
    if (!settings.soundsOn) return;
    if (turningOn) playSound(settings.habits.find((h) => h.id === id)?.sound);
    else playUntick();
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40"
      onClick={(e) => {
        e.stopPropagation();
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="sheet-up flex max-h-[88dvh] w-full max-w-[520px] flex-col rounded-t-[22px] bg-bg px-5 pt-5" role="dialog" aria-modal="true" aria-label={formatLong(date)}>
        <div className="flex items-start justify-between">
          <div>
            <div className="label">{date === today ? "Today" : counts ? "Looking back" : "Before the start"}</div>
            <div className="mt-1.5 text-[22px] font-semibold tracking-[-0.03em]">{formatLong(date)}</div>
          </div>
          <button type="button" className="tap -mr-2 flex h-9 w-9 items-center justify-center rounded-full text-ink-2" onClick={onClose} aria-label="Close">
            <CloseIcon />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto pb-safe">
          {rating && (
            <div className="mt-4 flex items-baseline justify-between">
              <span className="label">Rating</span>
              <span className="text-[30px] font-bold leading-none tracking-[-0.04em] tabular-nums">{rating.score.toFixed(2)}</span>
            </div>
          )}
          {counts && (
            <>
              <div className="mt-3 flex items-baseline justify-between font-mono text-[12px] tabular-nums">
                <span className="text-muted">
                  {progress.done}/{progress.total}
                </span>
                <span>{progress.pct}%</span>
              </div>
              <div className="mt-2 h-[3px] w-full overflow-hidden rounded-full bg-track">
                <div className="h-full rounded-full bg-ink transition-[width] duration-500" style={{ width: `${progress.pct}%` }} />
              </div>
              <div className="mt-4">
                <HabitList habits={day.habits} onToggle={toggle} />
              </div>
            </>
          )}
          {entries.length > 0 && (
            <div className="mt-6">
              <div className="label mb-1 flex items-center gap-1.5">
                <MicIcon width={12} height={12} /> Journal
              </div>
              <VoiceEntries date={date} entries={entries} />
            </div>
          )}
          {studied >= 1 && (
            <div className="mt-6">
              <div className="flex items-baseline justify-between">
                <span className="label">Studied</span>
                <span className="font-mono text-[13px] tabular-nums">{mins(studied)}</span>
              </div>
              <div className="mt-2 flex h-[4px] w-full overflow-hidden rounded-full bg-track" aria-hidden="true">
                {SUBJECT_IDS.map((s) => (bySubject[s] > 0 ? <div key={s} className="h-full" style={{ width: `${(bySubject[s] / studied) * 100}%`, background: SUBJECT_META[s].color }} /> : null))}
              </div>
            </div>
          )}
          {said.length > 0 && (
            <div className="mt-6">
              <div className="label mb-2">Lessons</div>
              <ul className="space-y-3">
                {said.map((l, i) => (
                  <li key={i} className="flex gap-3">
                    <SubjectMark subject={l.subject} height={18} />
                    <div className="min-w-0">
                      <div className="text-[15px] font-medium leading-tight">{SUBJECT_META[l.subject].name}</div>
                      <p className="mt-1 text-[14px] leading-snug text-ink-2">{l.text}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {goy && (
            <div className="mt-6 flex items-baseline justify-between gap-4">
              <span className="label shrink-0">Goy eaten</span>
              <span className="min-w-0 truncate text-[14px]">{goy}</span>
            </div>
          )}
          {hasPhotos && (
            <div className="mt-6">
              <div className="label mb-2">Photos</div>
              <div className="grid grid-cols-5 gap-1.5">
                {POSES.map((p) => (
                  <PhotoTile key={p.id} meta={photos[p.id]} label="" className="rounded-[10px]" onClick={photos[p.id] ? () => setPhoto(p.id) : undefined} />
                ))}
              </div>
            </div>
          )}
          <div className="h-6" />
        </div>
      </div>
      {photo && <PhotoViewer date={date} pose={photo} onClose={() => setPhoto(null)} />}
    </div>,
    document.body,
  );
}

/** Months from the start month on: at least three, more as time goes by. */
function monthsFrom(start: string, today: string): { year: number; month: number }[] {
  const s = parseKey(start);
  const t = parseKey(today);
  const span = Math.max(3, (t.getFullYear() - s.getFullYear()) * 12 + (t.getMonth() - s.getMonth()) + 2);
  return Array.from({ length: span }, (_, i) => {
    const d = new Date(s.getFullYear(), s.getMonth() + i, 1);
    return { year: d.getFullYear(), month: d.getMonth() };
  });
}

export default function CalendarView() {
  const { today, data } = useStore();
  const settings = data.settings;
  const start = startOf(settings);
  const [open, setOpen] = useState<string | null>(null);
  const top = settings.habits[0];
  const hub = useHub();
  // Which days have photos, and which have any study on them (worked out once, not once per square).
  const marks = useMemo(() => {
    const studied = new Set<string>();
    for (const s of Object.values(hub.data.sessions)) {
      for (let t = s.start; t <= s.end; t += 12 * 3600_000) studied.add(keyFromDate(new Date(t)));
      studied.add(keyFromDate(new Date(s.end)));
    }
    return { studied, photos: hub.data.photos };
  }, [hub.data.sessions, hub.data.photos]);

  return (
    <div className="fade-up flex flex-col gap-10">
      {monthsFrom(start, today).map(({ year, month }) => (
        <section key={`${year}-${month}`}>
          <h2 className="mb-4 text-[28px] font-bold leading-none tracking-[-0.035em]">{monthLabel(year, month)}</h2>
          <div className="grid grid-cols-7 gap-1.5">
            {WEEKDAYS.map((w, i) => (
              <div key={i} className="pb-1 text-center font-mono text-[11px] text-muted">
                {w}
              </div>
            ))}
            {monthGrid(year, month)
              .flat()
              .map((key, i) => {
                // Nothing before the start: those squares are simply empty.
                if (!key || key < start) return <div key={key ?? `e${i}`} />;
                const future = key > today;
                const hasVoice = Boolean(data.days[key]?.voice && Object.keys(data.days[key].voice!).length);
                const hasPhotos = Boolean(marks.photos[key]);
                const hasStudy = marks.studied.has(key);
                const pct = pctOn(data.days, settings, key, today);
                const a = shade(pct);
                const missed = topMissed(data.days, settings, key, today);
                return (
                  <button
                    key={key}
                    type="button"
                    disabled={future}
                    onClick={() => setOpen(key)}
                    className={cn("tap relative flex aspect-square items-center justify-center overflow-hidden rounded-[10px] text-[14px] tabular-nums disabled:active:scale-100", key === today && "ring-[1.5px] ring-ink ring-offset-2 ring-offset-bg")}
                    aria-label={`${formatLong(key)}${pct !== null ? `, ${pct}%` : ""}${missed && top ? `, ${top.name} missed` : ""}`}
                  >
                    <span className="absolute inset-0 bg-ink" style={{ opacity: a }} aria-hidden="true" />
                    {missed && <Slash light={a > 0.55} />}
                    <span className={cn("relative", a > 0.55 ? "text-bg" : future ? "text-faint" : "text-ink")}>{parseKey(key).getDate()}</span>
                    {/* Along the bottom: a dash for a day with study, a square for photos, a dot for a journal entry. */}
                    {(hasStudy || hasPhotos || hasVoice) && (
                      <span className="absolute bottom-[5px] flex items-center gap-[3px]" aria-hidden="true">
                        {hasStudy && <span className={cn("h-[2px] w-[7px] rounded-full", a > 0.55 ? "bg-bg" : "bg-ink")} />}
                        {hasPhotos && <span className={cn("h-[3px] w-[3px]", a > 0.55 ? "bg-bg" : "bg-ink")} />}
                        {hasVoice && <span className={cn("h-[3px] w-[3px] rounded-full", a > 0.55 ? "bg-bg" : "bg-ink")} />}
                      </span>
                    )}
                  </button>
                );
              })}
          </div>
        </section>
      ))}

      {open && <DaySheet date={open} onClose={() => setOpen(null)} />}
    </div>
  );
}
