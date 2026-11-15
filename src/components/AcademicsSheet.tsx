"use client";

import { useState } from "react";
import { useHub } from "@/lib/hub/store";
import { beforeAndNow, sessionsOn, upcomingExams } from "@/lib/hub/model";
import { clock, mins } from "@/lib/hub/time";
import { formatLong } from "@/lib/dates";
import { SUBJECT_IDS, SUBJECT_META } from "@/lib/hub/subjects";
import type { SubjectId } from "@/lib/hub/types";
import Sheet from "./Sheet";
import SubjectMark from "./SubjectMark";
import SessionSheet from "./SessionSheet";
import GradeSheet from "./GradeSheet";
import ExamsSheet from "./ExamsSheet";
import { ArrowIcon } from "./Icons";

/** Everything that isn't the three slabs: today's blocks (to fix or add time), grades and exams. */
export default function AcademicsSheet({ onClose }: { onClose: () => void }) {
  const { data, today } = useHub();
  const blocks = sessionsOn(today, data.sessions);
  const exams = upcomingExams(data.settings, today).length;
  const [session, setSession] = useState<string | null>(null);
  const [grade, setGrade] = useState<SubjectId | null>(null);
  const [showExams, setShowExams] = useState(false);

  return (
    <Sheet label={formatLong(today)} onClose={onClose}>
      <div className="mt-3 flex items-baseline justify-between">
        <span className="text-[13px] text-muted">Blocks</span>
        <button type="button" onClick={() => setSession("new")} className="-my-2 py-2 text-[13px] text-ink">
          Add time
        </button>
      </div>
      {blocks.length > 0 ? (
        <ul className="mt-2 divide-y divide-line border-y border-line">
          {blocks.map((b) => (
            <li key={b.id}>
              <button type="button" onClick={() => setSession(b.id)} className="tap flex w-full items-center gap-3.5 py-3 text-left">
                <SubjectMark subject={b.subject} height={18} />
                <span className="flex-1 text-[16px]">{SUBJECT_META[b.subject].name}</span>
                <span className="font-mono text-[12px] tabular-nums text-muted">
                  {clock(b.start)}–{clock(b.end)}
                </span>
                <span className="w-14 text-right font-mono text-[13px] tabular-nums">{mins((b.end - b.start) / 60000)}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 border-y border-line py-5 text-center text-[14px] text-muted">None today</p>
      )}

      <div className="mt-8 text-[13px] text-muted">Grades</div>
      <ul className="mt-2 divide-y divide-line border-y border-line">
        {SUBJECT_IDS.map((s) => {
          const { before, now: current } = beforeAndNow(s, data.grades, data.settings.shiftDate);
          return (
            <li key={s}>
              <button type="button" onClick={() => setGrade(s)} className="tap flex w-full items-center gap-3.5 py-3.5 text-left">
                <SubjectMark subject={s} />
                <span className="flex-1 text-[17px] font-medium tracking-[-0.015em]">{SUBJECT_META[s].name}</span>
                <span className="flex items-center gap-2 text-[17px] font-semibold tabular-nums">
                  {before && <span className="text-muted">{before.grade}</span>}
                  {before && <ArrowIcon width={14} height={14} className="text-faint" />}
                  {current ? <span>{current.grade}</span> : <span className="font-normal text-faint">–</span>}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <button type="button" onClick={() => setShowExams(true)} className="tap mt-8 flex h-14 w-full items-center justify-between rounded-2xl bg-surface px-5 text-left">
        <span className="text-[16px] font-medium">Exams</span>
        <span className="font-mono text-[12px] tabular-nums text-muted">{exams || "–"}</span>
      </button>

      {session && <SessionSheet id={session === "new" ? null : session} day={today} defaultSubject={data.timer?.subject ?? "maths"} onClose={() => setSession(null)} />}
      {grade && <GradeSheet subject={grade} onClose={() => setGrade(null)} />}
      {showExams && <ExamsSheet onClose={() => setShowExams(false)} />}
    </Sheet>
  );
}
