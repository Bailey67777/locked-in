"use client";

import { useHub } from "@/lib/hub/store";
import { uid } from "@/lib/hub/model";
import { WEEKDAYS } from "@/lib/hub/time";
import { SUBJECT_IDS, SUBJECT_META } from "@/lib/hub/subjects";
import type { SubjectId, TimetableLesson } from "@/lib/hub/types";
import { cn } from "@/lib/cn";
import Sheet from "./Sheet";
import { CloseIcon, PlusIcon } from "./Icons";

const plus = (hhmm: string, mins: number) => {
  const [h, m] = hhmm.split(":").map(Number);
  const t = Math.min(23 * 60 + 59, h * 60 + m + mins);
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
};

/** One weekday's lessons: subject, start and end. Saves as you go. */
export default function TimetableSheet({ day, onClose }: { day: number; onClose: () => void }) {
  const { data, write } = useHub();
  const lessons = data.settings.timetable[String(day)] ?? [];
  const save = (next: TimetableLesson[]) => write(`settings/timetable/${day}`, next.length ? [...next].sort((a, b) => a.start.localeCompare(b.start)) : null);
  const patch = (id: string, changes: Partial<TimetableLesson>) => save(lessons.map((l) => (l.id === id ? { ...l, ...changes } : l)));

  const add = () => {
    const last = lessons[lessons.length - 1];
    const start = last ? last.end : "08:30";
    const used = new Set(lessons.map((l) => l.subject));
    const subject: SubjectId = SUBJECT_IDS.find((s) => !used.has(s)) ?? "maths";
    save([...lessons, { id: uid(), subject, start, end: plus(start, 60) }]);
  };

  return (
    <Sheet label="Timetable" onClose={onClose}>
      <h2 className="mt-1 text-[28px] font-bold leading-tight tracking-[-0.035em]">{WEEKDAYS[day]}</h2>

      {lessons.length > 0 && (
        <ul className="mt-4 space-y-2">
          {lessons.map((l) => (
            <li key={l.id} className="rounded-2xl bg-surface p-2">
              <div className="flex items-center gap-1">
                {SUBJECT_IDS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    aria-pressed={l.subject === s}
                    onClick={() => patch(l.id, { subject: s })}
                    className={cn("tap flex h-9 flex-1 items-center justify-center gap-2 rounded-xl text-[13px] font-medium transition-colors", l.subject === s ? "text-ink" : "text-muted")}
                    style={l.subject === s ? { boxShadow: `inset 0 0 0 1.5px ${SUBJECT_META[s].color}` } : undefined}
                  >
                    {SUBJECT_META[s].name}
                  </button>
                ))}
                <button type="button" onClick={() => save(lessons.filter((x) => x.id !== l.id))} className="tap flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-faint hover:text-ink" aria-label="Remove lesson">
                  <CloseIcon width={14} height={14} />
                </button>
              </div>
              <div className="mt-1 flex items-center gap-2 px-2 pb-1 font-mono text-[15px] tabular-nums">
                <input type="time" value={l.start} onChange={(e) => e.target.value && patch(l.id, { start: e.target.value, end: l.end < e.target.value ? plus(e.target.value, 60) : l.end })} className="bg-transparent text-ink focus:outline-none" aria-label="Start" />
                <span className="text-muted">–</span>
                <input type="time" value={l.end} onChange={(e) => e.target.value && patch(l.id, { end: e.target.value })} className="bg-transparent text-ink focus:outline-none" aria-label="End" />
              </div>
            </li>
          ))}
        </ul>
      )}

      <button type="button" onClick={add} className="btn-quiet -ml-3 mt-3 text-muted">
        <PlusIcon width={16} height={16} />
        Add lesson
      </button>
    </Sheet>
  );
}
