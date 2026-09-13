"use client";

import { useEffect, useRef, useState } from "react";
import { axisTick, formatShort } from "@/lib/dates";
import { cn } from "@/lib/cn";

export type Series = { key: "day" | "health" | "happy"; label: string; color: string; values: (number | null)[] };

type Props = { dates: string[]; series: Series[] };

const PAD = { l: 28, r: 14, t: 12, b: 26 };
const H = 220;

/** Line chart of the three ratings. One axis (1–10), gaps where a day wasn't rated, hover crosshair. */
export default function RatingsChart({ dates, series }: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => setWidth(entries[0].contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const n = dates.length;
  const innerW = Math.max(0, width - PAD.l - PAD.r);
  const innerH = H - PAD.t - PAD.b;
  const x = (i: number) => PAD.l + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW);
  const y = (v: number) => PAD.t + innerH - ((v - 1) / 9) * innerH;

  const hasAny = series.some((s) => s.values.some((v) => v !== null));

  const pathFor = (values: (number | null)[]) => {
    let d = "";
    let pen = false;
    values.forEach((v, i) => {
      if (v === null) {
        pen = false;
        return;
      }
      d += `${pen ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)} `;
      pen = true;
    });
    return d;
  };

  const tickEvery = n > 14 ? Math.ceil(n / 6) : n > 7 ? 2 : 1;
  const ticks: { i: number; label: string }[] = [];
  let prevTick: string | null = null;
  dates.forEach((d, i) => {
    const last = i === n - 1;
    if (i % tickEvery !== 0 && !last) return;
    if (last && ticks.length && i - ticks[ticks.length - 1].i < Math.max(1, tickEvery - 1)) ticks.pop();
    ticks.push({ i, label: axisTick(d, prevTick) });
    prevTick = d;
  });

  const onMove = (clientX: number) => {
    const el = wrap.current;
    if (!el || n === 0) return;
    const rect = el.getBoundingClientRect();
    const px = clientX - rect.left - PAD.l;
    const idx = Math.round((px / Math.max(1, innerW)) * (n - 1));
    setHover(Math.max(0, Math.min(n - 1, idx)));
  };

  return (
    <div>
      <div
        ref={wrap}
        className="relative w-full select-none"
        style={{ height: H, touchAction: "pan-y" }}
        onPointerMove={(e) => onMove(e.clientX)}
        onPointerDown={(e) => onMove(e.clientX)}
        onPointerLeave={() => setHover(null)}
      >
        {width > 0 && (
          <svg width={width} height={H} className="block">
            {[2, 4, 6, 8, 10].map((v) => (
              <g key={v}>
                <line x1={PAD.l} x2={width - PAD.r} y1={y(v)} y2={y(v)} stroke="#ecdcc1" strokeWidth={1} />
                <text x={PAD.l - 8} y={y(v) + 4} textAnchor="end" fontSize={11} fontWeight={700} fill="#7a8b99">
                  {v}
                </text>
              </g>
            ))}
            <line x1={PAD.l} x2={width - PAD.r} y1={y(1)} y2={y(1)} stroke="#dcc39a" strokeWidth={1} />
            {ticks.map(({ i, label }) => (
              <text key={dates[i]} x={x(i)} y={H - 8} textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"} fontSize={11} fontWeight={700} fill="#7a8b99">
                {label}
              </text>
            ))}
            {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={PAD.t} y2={PAD.t + innerH} stroke="#7a8b99" strokeWidth={1} strokeDasharray="3 3" />}
            {series.map((s) => (
              <g key={s.key}>
                <path d={pathFor(s.values)} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
                {s.values.map((v, i) => {
                  if (v === null) return null;
                  const isolated = (i === 0 || s.values[i - 1] === null) && (i === n - 1 || s.values[i + 1] === null);
                  const show = isolated || i === hover || n <= 10;
                  if (!show) return null;
                  return <circle key={i} cx={x(i)} cy={y(v)} r={i === hover ? 5 : 4} fill={s.color} stroke="#ffffff" strokeWidth={2} />;
                })}
              </g>
            ))}
            {!hasAny && (
              <text x={width / 2} y={H / 2} textAnchor="middle" fontSize={13} fontWeight={700} fill="#7a8b99">
                Rate a few days and the lines will appear here.
              </text>
            )}
          </svg>
        )}
        {hover !== null && hasAny && (
          <div
            className="pointer-events-none absolute top-2 z-10 rounded-xl border border-sand-200 bg-white/95 px-3 py-2 text-xs shadow-soft"
            style={{ left: Math.min(Math.max(0, x(hover) - 60), Math.max(0, width - 130)) }}
          >
            <div className="mb-1 font-extrabold text-ink">{formatShort(dates[hover])}</div>
            {series.map((s) => (
              <div key={s.key} className="flex items-center justify-between gap-3 font-bold text-ink-soft">
                <span className="flex items-center gap-1.5">
                  <i className="inline-block h-2 w-2 rounded-full" style={{ background: s.color }} />
                  {s.label}
                </span>
                <span className="tabular-nums text-ink">{s.values[hover] ?? "–"}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 px-1">
        {series.map((s) => (
          <span key={s.key} className="flex items-center gap-1.5 text-xs font-bold text-ink-soft">
            <i className="inline-block h-0.5 w-4 rounded" style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
      </div>

      <details className="mt-3">
        <summary className="cursor-pointer text-xs font-bold text-ocean-700">Show as table</summary>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-ink-muted">
                <th className="py-1 pr-3 font-extrabold">Date</th>
                {series.map((s) => (
                  <th key={s.key} className="py-1 pr-3 font-extrabold">{s.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dates.map((d, i) => (
                <tr key={d} className={cn("border-t border-sand-100", i === hover && "bg-sand-50")}>
                  <td className="py-1 pr-3 font-bold text-ink">{formatShort(d)}</td>
                  {series.map((s) => (
                    <td key={s.key} className="py-1 pr-3 tabular-nums text-ink-soft">{s.values[i] ?? "–"}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
