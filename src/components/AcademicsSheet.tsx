"use client";

import { useState } from "react";
import { useHub } from "@/lib/hub/store";
import { beforeAndNow, upcomingExams } from "@/lib/hub/model";
import { formatLong } from "@/lib/dates";
import { SUBJECT_IDS, SUBJECT_META } from "@/lib/hub/subjects";
import type { SubjectId } from "@/lib/hub/types";
import Sheet from "./Sheet";
import SubjectMark from "./SubjectMark";
import GradeSheet from "./GradeSheet";
import ExamsSheet from "./ExamsSheet";
import { ArrowIcon } from "./Icons";

/** What sits behind the three slabs: grades (before and after 15 November) and exams. */
export default function AcademicsSheet({ onClose }: { onClose: () => void }) {
  const { data, today } = useHub();
  const exams = upcomingExams(data.settings, today).length;
  const [grade, setGrade] = useState<SubjectId | null>(null);
  const [showExams, setShowExams] = useState(false);

  return (
    <Sheet label={formatLong(today)} onClose={onClose}>
      <div className="mt-3 text-[13px] text-muted">Grades</div>
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

      {grade && <GradeSheet subject={grade} onClose={() => setGrade(null)} />}
      {showExams && <ExamsSheet onClose={() => setShowExams(false)} />}
    </Sheet>
  );
}
