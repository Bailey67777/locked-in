"use client";

import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { dayProgress } from "@/lib/model";
import { haptic, playAllDone, playSound, playUntick } from "@/lib/sounds";
import { prewarmEdits, useEditBank } from "@/lib/edits";
import { MicIcon } from "./Icons";
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
  const [playing, setPlaying] = useState<{ editId: string; title: string } | null>(null);
  const [journal, setJournal] = useState(false);
  const recordings = useVoiceEntries(today).length;

  // Edits on habits still to tick load in the background, so ticking plays them straight away.
  const editSig = day.habits
        .filter((h) => !h.done)
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
    const edit = def?.editId ? bank.byId[def.editId] : undefined;
    if (edit) return setPlaying({ editId: edit.id, title: def?.name ?? target.name });
    if (!settings.soundsOn) return;
    playSound(def?.sound);
    if (done + 1 === total) playAllDone();
  };

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
        <HabitList habits={day.habits} onToggle={toggle} fill />
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

      {playing && <EditPlayer editId={playing.editId} title={playing.title} onClose={() => setPlaying(null)} />}
      {journal && <JournalSheet date={today} onClose={() => setJournal(false)} />}
    </div>
  );
}
