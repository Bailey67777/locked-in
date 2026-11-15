"use client";

import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { dayProgress } from "@/lib/model";
import { haptic, playAllDone, playSound, playUntick } from "@/lib/sounds";
import { prewarmEdits, useEditBank } from "@/lib/edits";
import { MicIcon, PlayIcon } from "./Icons";
import HabitList from "./HabitList";
import EditPlayer from "./EditPlayer";
import JournalSheet from "./JournalSheet";
import { useVoiceEntries } from "./VoiceEntries";

/** Today: ten habits, a bar, and the journal. */
export default function HabitsView() {
  const { today, data, getDay, updateDay } = useStore();
  const settings = data.settings;
  const bank = useEditBank();
  const day = getDay(today);
  const { done, total, pct } = dayProgress(day);
  const [playing, setPlaying] = useState<{ editId: string; title: string; habitId: string } | null>(null);
  const [journal, setJournal] = useState(false);
  const recordings = useVoiceEntries(today).length;

  // Edits not yet watched today load in the background, so the play button starts them straight away.
  const editSig = day.habits
        .filter((h) => !day.watched?.[h.id])
        .map((h) => settings.habits.find((x) => x.id === h.id)?.editId)
        .filter((id): id is string => Boolean(id && bank.byId[id]))
        .join(",");
  useEffect(() => {
    if (editSig) prewarmEdits(editSig.split(",").map((id) => bank.byId[id]));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when the set of edits changes
  }, [editSig]);

  const toggle = (id: string) => {
    const target = day.habits.find((h) => h.id === id);
    if (!target) return;
    const turningOn = !target.done;
    updateDay(today, (d) => ({ ...d, habits: d.habits.map((h) => (h.id === id ? { ...h, done: !h.done } : h)) }));
    haptic(turningOn ? 10 : 6);
    if (!turningOn) {
      if (settings.soundsOn) playUntick();
      return;
    }
    const def = settings.habits.find((h) => h.id === id);
    if (!settings.soundsOn) return;
    playSound(def?.sound);
    if (done + 1 === total) playAllDone();
  };

  // A ticked habit with an edit gets a play button; it goes once the edit has been watched (or when the day ends).
  const editFor = (id: string) => {
    const def = settings.habits.find((h) => h.id === id);
    return def?.editId ? bank.byId[def.editId] : undefined;
  };
  const watch = (id: string, name: string) => {
    const edit = editFor(id);
    if (!edit) return;
    setPlaying({ editId: edit.id, title: name, habitId: id });
  };
  // Used up only once it actually starts playing, so a failed download leaves the button there to try again.
  const watched = (id: string) => {
    if (!getDay(today).watched?.[id]) updateDay(today, (d) => ({ ...d, watched: { ...(d.watched ?? {}), [id]: true } }));
  };
  const playButton = (h: { id: string; name: string; done: boolean }) =>
    h.done && !day.watched?.[h.id] && editFor(h.id) ? (
      <button type="button" onClick={() => watch(h.id, h.name)} className="tap ml-3 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-[1.5px] border-ink text-ink" aria-label={`Play the edit for ${h.name}`}>
        <PlayIcon width={12} height={12} className="translate-x-[1px]" />
      </button>
    ) : null;

  // The screen above the bottom icons is cut into twelve equal slices: one for the title, ten for the habits (all
  // fourteen share them, evenly), one for the bar. On a very short screen it stops shrinking and scrolls instead.
  return (
    <div className="fade-up flex flex-1 flex-col" style={{ minHeight: 100 + day.habits.length * 38 }}>
      {/* The title row sits a little below the middle of its slice (3 parts space above, 1 below), closer to the habits. */}
      <header className="flex min-h-[50px] flex-col" style={{ flex: "1 1 0" }}>
        <div style={{ flex: "3 1 0" }} />
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-[36px] font-bold leading-none tracking-[-0.04em]">Habits</h1>
          <button type="button" onClick={() => setJournal(true)} className="tap relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-[1.5px] border-ink text-ink" aria-label={`Journal${recordings ? `, ${recordings} today` : ""}`}>
            <MicIcon />
          </button>
        </div>
        <div style={{ flex: "1 1 0" }} />
      </header>

      <div className="flex flex-col" style={{ flex: "10 1 0" }}>
        <HabitList habits={day.habits} onToggle={toggle} trailing={playButton} fill />
      </div>

      <div className="flex min-h-[50px] flex-col justify-center" style={{ flex: "1 1 0" }}>
        <div className="flex items-baseline justify-between font-mono text-[13px] tabular-nums">
          <span className="text-muted">
            {done}/{total}
          </span>
          <span className="text-ink">{pct}%</span>
        </div>
        <div className="mt-2 h-[4px] w-full overflow-hidden rounded-full bg-track" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Today's progress">
          <div className="h-full rounded-full bg-ink transition-[width] duration-500 ease-out" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {playing && <EditPlayer editId={playing.editId} title={playing.title} onClose={() => setPlaying(null)} onStarted={() => watched(playing.habitId)} />}
      {journal && <JournalSheet date={today} onClose={() => setJournal(false)} />}
    </div>
  );
}
