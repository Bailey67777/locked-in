"use client";

import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { TIERS, dayProgress } from "@/lib/model";
import { formatLong } from "@/lib/dates";
import { haptic, playAllDone, playSound, playSubmit, playUntick } from "@/lib/sounds";
import { prewarmEdits, useEditBank } from "@/lib/edits";
import { MicIcon } from "./Icons";
import HabitList from "./HabitList";
import EditPlayer from "./EditPlayer";
import JournalSheet from "./JournalSheet";
import { useVoiceEntries } from "./VoiceEntries";

/** Today: ten habits, a bar, a submit button, and the journal. */
export default function HabitsView() {
  const { today, data, getDay, updateDay } = useStore();
  const settings = data.settings;
  const bank = useEditBank();
  const day = getDay(today);
  const { done, total, pct } = dayProgress(day);
  const sub = day.submitted;
  const [playing, setPlaying] = useState<{ editId: string; title: string } | null>(null);
  const [journal, setJournal] = useState(false);
  const recordings = useVoiceEntries(today).length;

  // Edits on habits still to tick load in the background, so ticking plays them straight away.
  const editSig = sub
    ? ""
    : day.habits
        .filter((h) => !h.done)
        .map((h) => settings.habits.find((x) => x.id === h.id)?.editId)
        .filter((id): id is string => Boolean(id && bank.byId[id]))
        .join(",");
  useEffect(() => {
    if (editSig) prewarmEdits(editSig.split(",").map((id) => bank.byId[id]));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when the set of edits changes
  }, [editSig]);

  const toggle = (id: string) => {
    if (sub) return;
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

  const submit = () => {
    const tier = (TIERS.find((t) => pct >= t.min) ?? TIERS[TIERS.length - 1]).id;
    updateDay(today, (d) => ({ ...d, submitted: { at: Date.now(), pct, tier, keystoneMissed: !d.habits[0]?.done } }));
    haptic([12, 50, 12]);
    if (settings.soundsOn) playSubmit();
  };

  const reopen = () =>
    updateDay(today, (d) => {
      const next = { ...d };
      delete next.submitted;
      return next;
    });

  return (
    <>
      <div className="fade-up">
        <header className="mb-7 flex items-end justify-between gap-4">
          <div>
            <div className="label">{formatLong(today)}</div>
            <h1 className="mt-2 text-[34px] font-semibold leading-none tracking-[-0.035em]">Habits</h1>
          </div>
          <button type="button" onClick={() => setJournal(true)} className="tap relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface text-ink" aria-label={`Journal${recordings ? `, ${recordings} today` : ""}`}>
            <MicIcon />
            {recordings > 0 && <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-ink px-1 font-mono text-[10px] text-bg">{recordings}</span>}
          </button>
        </header>

        <div className={sub ? "opacity-60" : undefined}>
          <HabitList habits={day.habits} locked={Boolean(sub)} onToggle={toggle} />
        </div>
      </div>

      {/* Outside the animated block: a transformed parent would carry this fixed bar along with it. */}
      <div className="fixed inset-x-0 bottom-[calc(57px+env(safe-area-inset-bottom,0px))] z-30">
        <div className="h-6 bg-gradient-to-t from-bg to-transparent" aria-hidden="true" />
        <div className="mx-auto w-full max-w-[520px] bg-bg px-5 pb-4 pt-1">
          <div className="flex items-baseline justify-between font-mono text-[12px] tabular-nums">
            <span className="text-muted">
              {done}/{total}
            </span>
            <span className="text-ink">{pct}%</span>
          </div>
          <div className="mt-2 h-[3px] w-full overflow-hidden rounded-full bg-track" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Today's progress">
            <div className="h-full rounded-full bg-ink transition-[width] duration-500 ease-out" style={{ width: `${pct}%` }} />
          </div>
          {sub ? (
            <div className="mt-4 flex h-12 items-center justify-between">
              <span className="text-[15px] font-medium">Submitted · {sub.pct}%</span>
              <button type="button" className="btn-quiet -mr-3 text-muted" onClick={reopen}>
                Reopen
              </button>
            </div>
          ) : (
            <button type="button" className="btn mt-4 w-full" onClick={submit} disabled={total === 0}>
              Submit day
            </button>
          )}
        </div>
      </div>

      {playing && <EditPlayer editId={playing.editId} title={playing.title} onClose={() => setPlaying(null)} />}
      {journal && <JournalSheet date={today} onClose={() => setJournal(false)} />}
    </>
  );
}
