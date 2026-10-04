"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { GradePoint, Subject } from "@/lib/types";
import { GRADE_LABELS, SUBJECTS, SUBJECT_COLOR, SUBJECT_LABEL } from "@/lib/model";
import { addDays, daysBetween, formatDayMonth, formatLong } from "@/lib/dates";
import { cn } from "@/lib/cn";

type Props = { grades: Record<Subject, Record<string, GradePoint>>; examDate?: string };

const PAD = { l: 26, r: 12, t: 12, b: 22 };
const H = 230;
const GRID = "var(--color-sand-200)";
const AXIS_TEXT = "var(--color-ink-muted)";

function gradeLabel(g: number): string {
  return GRADE_LABELS[Math.max(0, Math.min(6, Math.round(g)))];
}

/** Least-squares line over points (x = days since start, y = grade). */
function regression(pts: { x: number; y: number }[]): { m: number; c: number } | null {
  if (pts.length < 2) return null;
  const n = pts.length;
  const mx = pts.reduce((a, p) => a + p.x, 0) / n;
  const my = pts.reduce((a, p) => a + p.y, 0) / n;
  let num = 0;
  let den = 0;
  for (const p of pts) {
    num += (p.x - mx) * (p.y - my);
    den += (p.x - mx) ** 2;
  }
  if (den === 0) return null;
  const m = num / den;
  return { m, c: my - m * mx };
}

/** Grade trajectory: one line per A-level from Claude's nightly estimates, with a dashed projection towards the exam. */
export default function GradeChart({ grades, examDate }: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [hidden, setHidden] = useState<Partial<Record<Subject, boolean>>>({});
  const [picked, setPicked] = useState<{ subject: Subject; date: string } | null>(null);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => setWidth(entries[0].contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const series = useMemo(
    () =>
      SUBJECTS.map((subject) => ({
        subject,
        points: Object.entries(grades[subject])
          .map(([date, p]) => ({ date, ...p }))
          .sort((a, b) => a.date.localeCompare(b.date)),
      })),
    [grades],
  );

  const allDates = series.flatMap((s) => s.points.map((p) => p.date));
  if (allDates.length === 0) {
    return (
      <p className="rounded-xl bg-sand-50 px-3 py-4 text-center text-[12.5px] font-semibold text-ink-muted">
        No estimates yet. Log study on Today with marks or scores (e.g. “Paper 1, 58/80”) and Claude starts plotting each night.
      </p>
    );
  }

  const start = allDates.reduce((a, b) => (a < b ? a : b));
  const lastData = allDates.reduce((a, b) => (a > b ? a : b));
  // Look ahead a little past the data; reach to the exam only once it's close, so early weeks aren't squashed into one corner.
  const lookAhead = Math.min(60, Math.max(21, Math.round(daysBetween(start, lastData) * 0.4)));
  const end = examDate && examDate > lastData && daysBetween(lastData, examDate) <= 120 ? examDate : addDays(lastData, lookAhead);
  const span = Math.max(1, daysBetween(start, end));
  const innerW = Math.max(0, width - PAD.l - PAD.r);
  const innerH = H - PAD.t - PAD.b;
  const x = (date: string) => PAD.l + (daysBetween(start, date) / span) * innerW;
  const y = (g: number) => PAD.t + innerH - (Math.max(0, Math.min(6, g)) / 6) * innerH;

  // Date ticks: spaced by the span, and never closer than ~56px to the final (exam) label.
  const tickEvery = span <= 45 ? 7 : span <= 120 ? 14 : span <= 400 ? 60 : 120;
  const tickDates: string[] = [];
  for (let d = 0; d <= span; d += tickEvery) tickDates.push(addDays(start, d));
  const minGapDays = innerW > 0 ? (56 / innerW) * span : 0;
  while (tickDates.length > 1 && daysBetween(tickDates[tickDates.length - 1], end) < minGapDays) tickDates.pop();
  if (tickDates[tickDates.length - 1] !== end) tickDates.push(end);

  const pickedPoint = picked ? grades[picked.subject][picked.date] : null;
  const latest = series.map((s) => ({ subject: s.subject, last: s.points[s.points.length - 1] })).filter((s) => s.last);

  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-1">
        {SUBJECTS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setHidden((h) => ({ ...h, [s]: !h[s] }))}
            aria-pressed={!hidden[s]}
            className={cn("tap flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11.5px] font-semibold", hidden[s] ? "border-transparent bg-sand-100 text-ink-muted line-through" : "border-black/[0.06] bg-white text-ink-soft")}
          >
            <i className="inline-block h-[2px] w-3 rounded" style={{ background: SUBJECT_COLOR[s] }} />
            {SUBJECT_LABEL[s]}
          </button>
        ))}
      </div>
      <div ref={wrap} className="relative w-full select-none" style={{ height: H }}>
        {width > 0 && (
          <svg width={width} height={H} className="block">
            {GRADE_LABELS.map((label, g) => (
              <g key={label}>
                <line x1={PAD.l} x2={width - PAD.r} y1={y(g)} y2={y(g)} strokeWidth={1} style={{ stroke: GRID }} />
                <text x={PAD.l - 8} y={y(g) + 3.5} textAnchor="end" fontSize={10} fontWeight={500} style={{ fill: AXIS_TEXT }}>
                  {label}
                </text>
              </g>
            ))}
            {tickDates.map((d, i) => (
              <text key={d} x={x(d)} y={H - 6} textAnchor={i === 0 ? "start" : i === tickDates.length - 1 ? "end" : "middle"} fontSize={10} fontWeight={500} style={{ fill: AXIS_TEXT }}>
                {formatDayMonth(d)}
              </text>
            ))}
            {examDate && examDate >= start && examDate <= end && (
              <g>
                <line x1={x(examDate)} x2={x(examDate)} y1={PAD.t} y2={PAD.t + innerH} strokeWidth={1} style={{ stroke: "var(--color-ink-muted)" }} opacity={0.5} />
                <text x={x(examDate) - 4} y={PAD.t + 9} textAnchor="end" fontSize={10} fontWeight={600} style={{ fill: AXIS_TEXT }}>
                  exam
                </text>
              </g>
            )}
            {series.map(({ subject, points }) => {
              if (hidden[subject] || points.length === 0) return null;
              const color = SUBJECT_COLOR[subject];
              const path = points.map((p, i) => `${i ? "L" : "M"}${x(p.date).toFixed(1)} ${y(p.grade).toFixed(1)}`).join(" ");
              const fit = regression(points.slice(-14).map((p) => ({ x: daysBetween(start, p.date), y: p.grade })));
              const last = points[points.length - 1];
              let trend: string | null = null;
              if (fit) {
                const y0 = Math.max(0, Math.min(6, fit.m * daysBetween(start, last.date) + fit.c));
                const y1 = Math.max(0, Math.min(6, fit.m * span + fit.c));
                trend = `M${x(last.date).toFixed(1)} ${y(y0).toFixed(1)} L${x(end).toFixed(1)} ${y(y1).toFixed(1)}`;
              }
              return (
                <g key={subject}>
                  {trend && <path d={trend} fill="none" stroke={color} strokeWidth={1.5} strokeDasharray="4 4" opacity={0.5} />}
                  <path d={path} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
                  {points.map((p) => {
                    const active = picked?.subject === subject && picked.date === p.date;
                    return (
                      <g key={p.date} style={{ cursor: "pointer" }} onClick={() => setPicked(active ? null : { subject, date: p.date })}>
                        <circle cx={x(p.date)} cy={y(p.grade)} r={12} fill="transparent" />
                        <circle cx={x(p.date)} cy={y(p.grade)} r={active ? 5.5 : 4} fill={color} stroke="#ffffff" strokeWidth={2} />
                        <title>{`${SUBJECT_LABEL[subject]} · ${formatDayMonth(p.date)} · ${gradeLabel(p.grade)} (${p.grade})`}</title>
                      </g>
                    );
                  })}
                </g>
              );
            })}
          </svg>
        )}
      </div>
      {picked && pickedPoint && (
        <div className="pop-in mt-2 rounded-xl border border-black/[0.06] bg-sand-50 px-3 py-2.5">
          <div className="flex items-baseline justify-between gap-2">
            <span className="flex items-center gap-1.5 text-[13px] font-bold text-ink">
              <i className="h-2 w-2 rounded-full" style={{ background: SUBJECT_COLOR[picked.subject] }} />
              {SUBJECT_LABEL[picked.subject]} · {gradeLabel(pickedPoint.grade)} <span className="text-[11.5px] font-semibold text-ink-muted">({pickedPoint.grade.toFixed(1)})</span>
            </span>
            <span className="text-[11px] font-semibold text-ink-muted">{formatLong(picked.date)}</span>
          </div>
          <p className="mt-1 text-[12.5px] font-medium leading-snug text-ink-soft">{pickedPoint.reason || "No reason recorded."}</p>
        </div>
      )}
      <details className="mt-2">
        <summary className="cursor-pointer text-[11.5px] font-bold text-ink-muted hover:text-ink">Latest estimates</summary>
        <table className="mt-2 w-full text-left text-[11.5px]">
          <tbody>
            {latest.map(({ subject, last }) => (
              <tr key={subject} className="border-t border-sand-100">
                <td className="py-1 pr-3 font-semibold text-ink">{SUBJECT_LABEL[subject]}</td>
                <td className="py-1 pr-3 font-bold tabular-nums text-ink">{gradeLabel(last.grade)} ({last.grade.toFixed(1)})</td>
                <td className="py-1 text-ink-muted">{formatDayMonth(last.date)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
      <p className="mt-2 text-[11px] font-medium text-ink-muted">Solid: Claude&apos;s estimate each night. Dashed: where the last two weeks point. Tap a point for the reason.</p>
    </div>
  );
}
