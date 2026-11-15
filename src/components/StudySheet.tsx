"use client";

import { useTimer } from "@/lib/hub/timer";
import { SUBJECT_IDS, SUBJECT_META } from "@/lib/hub/subjects";
import { unlockAudio } from "@/lib/hub/chimes";
import Sheet from "./Sheet";
import SubjectMark from "./SubjectMark";

/** Pick what you're studying: the timer starts (or switches to it) straight away. */
export default function StudySheet({ onClose }: { onClose: () => void }) {
  const { timer, start } = useTimer();
  return (
    <Sheet label={timer ? "Switch to" : "Study"} onClose={onClose}>
      <div className="mt-3 space-y-2">
        {SUBJECT_IDS.filter((s) => s !== timer?.subject).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => {
              unlockAudio();
              start(s);
              onClose();
            }}
            className="tap flex h-[62px] w-full items-center gap-3.5 rounded-2xl bg-surface px-5 text-left"
          >
            <SubjectMark subject={s} height={22} />
            <span className="text-[17px] font-medium tracking-[-0.015em]">{SUBJECT_META[s].name}</span>
          </button>
        ))}
      </div>
    </Sheet>
  );
}
