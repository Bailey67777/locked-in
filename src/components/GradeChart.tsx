"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { GradePoint, Subject } from "@/lib/types";
import { GRADE_LABELS, SUBJECTS, SUBJECT_COLOR, SUBJECT_LABEL } from "@/lib/model";
import { addDays, daysBetween, formatDayMonth, formatLong } from "@/lib/dates";
import { cn } from "@/lib/cn";

type Props = { grades: Record<Subject, Record<string, GradePoint>>; examDate?: string };

const PAD = { l: 30, r: 14, t: 12, b: 26 };
const H = 260;

function gradeLabel(g: number): string {
  const i = Math.max(0, Math.min(6, Math.round(g)));
  return GRADE_LABELS[i];
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

/** Grade trajectory: one line per A-level, Claude's estimate each night, with a dashed trend towards the exam. */
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
    return <p className="rounded-2xl bg-sand-50 px-4 py-6 text-center text-sm font-semibold text-ink-muted">Your graph starts once Claude has something to go on.</p>;
  }

  const start = allDates.reduce((a, b) => (a < b ? a : b));
  const lastData = allDates.reduce((a, b) => (a > b ? a : b));
  const end = examDate && examDate > lastData ? examDate : addDays(lastData, 30);
  const span = Math.max(1, daysBetween(start, end));
  const innerW = Math.max(0, width - PAD.l - PAD.r);
  const innerH = H - PAD.t - PAD.b;
  const x = (date: string) => PAD.l + (daysBetween(start, date) / span) * innerW;
  const y = (g: number) => PAD.t + innerH - (Math.max(0, Math.min(6, g)) / 6) * innerH;

  const tickDates: string[] = [];
  const tickEvery = span <= 45 ? 7 : span <= 120 ? 14 : span <= 400 ? 60 : 120;
  for (let d = 0; d <= span; d += tickEvery) tickDates.push(addDays(start, d));
  if (tickDates[tickDates.length - 1] !== end) tickDates.push(end);

  const pickedPoint = picked ? grades[picked.subject][picked.date] : null;

  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-1.5">
        {SUBJECTS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setHidden((h) => ({ ...h, [s]: !h[s] }))}
            aria-pressed={!hidden[s]}
            className={cn("tap flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-extrabold", hidden[s] ? "bg-sand-100 text-ink-muted line-through" : "bg-white text-ink shadow-soft")}
          >
            <i className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: SUBJECT_COLOR[s] }} />
            {SUBJECT_LABEL[s]}
          </button>
        ))}
      </div>
      <div ref={wrap} className="relative w-full select-none" style={{ height: H }}>
        {width > 0 && (
          <svg width={width} height={H} className="block">
            {GRADE_LABELS.map((label, g) => (
              <g key={label}>
                <line x1={PAD.l} x2={width - PAD.r} y1={y(g)} y2={y(g)} stroke={g === 0 ? "#dcc39a" : "#ecdcc1"} strokeWidth={1} />
                <text x={PAD.l - 8} y={y(g) + 4} textAnchor="end" fontSize={11} fontWeight={800} fill="#7a8b99">
                  {label}
                </text>
              </g>
            ))}
            {tickDates.map((d, i) => (
              <text key={d} x={x(d)} y={H - 8} textAnchor={i === 0 ? "start" : i === tickDates.length - 1 ? "end" : "middle"} fontSize={10} fontWeight={700} fill="#7a8b99">
                {formatDayMonth(d)}
              </text>
            ))}
            {examDate && examDate >= start && examDate <= end && (
              <g>
                <line x1={x(examDate)} x2={x(examDate)} y1={PAD.t} y2={PAD.t + innerH} stroke="#d95f18" strokeWidth={1.5} strokeDasharray="4 3" />
                <text x={x(examDate) - 4} y={PAD.t + 10} textAnchor="end" fontSize={10} fontWeight={800} fill="#d95f18">
                  exam
                </text>
              </g>
            )}
            {series.map(({ subject, points }) => {
              if (hidden[subject] || points.length === 0) return null;
              const color = SUBJECT_COLOR[subject];
              const path = points.map((p, i) => `${i ? "L" : "M"}${x(p.date).toFixed(1)} ${y(p.grade).toFixed(1)}`).join(" ");
              const recent = points.slice(-14).map((p) => ({ x: daysBetween(start, p.date), y: p.grade }));
              const fit = regression(recent);
              const last = points[points.length - 1];
              let trend: string | null = null;
              if (fit) {
                const x0 = daysBetween(start, last.date);
                const x1 = span;
                const y0 = Math.max(0, Math.min(6, fit.m * x0 + fit.c));
                const y1 = Math.max(0, Math.min(6, fit.m * x1 + fit.c));
                trend = `M${x(last.date).toFixed(1)} ${y(y0).toFixed(1)} L${x(end).toFixed(1)} ${y(y1).toFixed(1)}`;
              }
              return (
                <g key={subject}>
                  {trend && <path d={trend} fill="none" stroke={color} strokeWidth={1.5} strokeDasharray="5 4" opacity={0.45} />}
                  <path d={path} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
                  {points.map((p) => {
                    const active = picked?.subject === subject && picked.date === p.date;
                    return (
                      <circle
                        key={p.date}
                        cx={x(p.date)}
                        cy={y(p.grade)}
                        r={active ? 6 : 4}
                        fill={color}
                        stroke="#fff"
                        strokeWidth={2}
                        style={{ cursor: "pointer" }}
                        onClick={() => setPicked(active ? null : { subject, date: p.date })}
                      >
                        <title>{`${SUBJECT_LABEL[subject]} · ${formatDayMonth(p.date)} · ${gradeLabel(p.grade)} (${p.grade})`}</title>
                      </circle>
                    );
                  })}
                </g>
              );
            })}
          </svg>
        )}
      </div>
      {picked && pickedPoint && (
        <div className="pop-in mt-2 rounded-2xl bg-sand-50 px-3 py-2.5" style={{ borderLeft: `5px solid ${SUBJECT_COLOR[picked.subject]}` }}>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-sm font-extrabold text-ink">
              {SUBJECT_LABEL[picked.subject]} · {gradeLabel(pickedPoint.grade)} <span className="text-xs font-bold text-ink-muted">({pickedPoint.grade.toFixed(1)})</span>
            </span>
            <span className="text-xs font-bold text-ink-muted">{formatLong(picked.date)}</span>
          </div>
          <p className="mt-1 text-sm font-semibold text-ink-soft">{pickedPoint.reason || "No reason recorded."}</p>
        </div>
      )}
      <p className="mt-2 text-[11px] font-semibold text-ink-muted">Solid line: Claude&apos;s estimate each night. Dashed: where the last two weeks are heading. Tap a point for the reason.</p>
    </div>
  );
}
