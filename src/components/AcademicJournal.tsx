"use client";

import { useStore } from "@/lib/store";
import type { AcademicJournal as AJ } from "@/lib/types";
import Journal from "./Journal";

const BOXES: { key: keyof AJ; label: string; hint: string }[] = [
  { key: "econ", label: "Economics", hint: "AQA" },
  { key: "maths", label: "Maths", hint: "incl. Further Maths · Edexcel" },
  { key: "physics", label: "Physics", hint: "AQA" },
];

/** End-of-day active recall, one box per subject. Not encrypted: the nightly Claude task reads this. */
export default function AcademicJournal({ date }: { date: string }) {
  const { getDay, updateDay } = useStore();
  const day = getDay(date);
  const academic = day.academic ?? { econ: "", maths: "", physics: "" };

  const save = (key: keyof AJ, text: string) =>
    updateDay(date, (d) => {
      const next: AJ = { econ: "", maths: "", physics: "", ...(d.academic ?? {}), [key]: text };
      return { ...d, academic: next.econ || next.maths || next.physics ? next : undefined };
    });

  return (
    <section className="card p-4 md:p-5">
      <h2 className="text-lg font-extrabold text-ink">Academic journal</h2>
      <p className="mb-3 text-sm font-semibold text-ink-muted">Books closed. What did each lesson cover today? Claude reads this each night to set tomorrow&apos;s questions.</p>
      <div className="flex flex-col gap-3">
        {BOXES.map((b) => (
          <div key={b.key}>
            <div className="mb-1 flex items-baseline gap-2">
              <span className="text-sm font-extrabold text-ink">{b.label}</span>
              <span className="text-[11px] font-bold text-ink-muted">{b.hint}</span>
            </div>
            <Journal key={`${b.key}-${date}`} value={academic[b.key]} rows={3} onSave={(t) => save(b.key, t)} placeholder="What did you cover today? Write it from memory." />
          </div>
        ))}
      </div>
    </section>
  );
}
