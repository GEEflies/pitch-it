"use client";

import Link from "next/link";
import { useId, useMemo, useState, type PointerEvent } from "react";
import { Icon } from "@/components/app/icons";
import {
  PROGRESS_RANGES,
  defaultProgressRange,
  pointsInRange,
  progressChange,
  type ProgressPoint,
  type ProgressRangeKey,
  type ProgressSeries,
} from "@/lib/dashboard/overview";

/*
  Plošný graf jednej série (podiel z rozboru v čase). Krížový kurzor s tooltipom,
  tabuľkový pohľad pre čítačky, jedna os. `now` prichádza zo servera, aby server
  aj klient vybrali rovnaké body.
*/

const W = 320;
const H = 132;
const PAD = { top: 12, right: 10, bottom: 8, left: 6 };

/** Hladká krivka cez body (Catmull-Rom → kubické Bézierove úseky). */
function smoothPath(xy: Array<[number, number]>): string {
  if (xy.length === 1) return `M${xy[0][0]},${xy[0][1]}`;
  let d = `M${xy[0][0]},${xy[0][1]}`;
  for (let i = 0; i < xy.length - 1; i++) {
    const p0 = xy[i - 1] ?? xy[i];
    const p1 = xy[i];
    const p2 = xy[i + 1];
    const p3 = xy[i + 2] ?? p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0]},${c1[1]} ${c2[0]},${c2[1]} ${p2[0]},${p2[1]}`;
  }
  return d;
}

function Chart({ points, metricLabel }: { points: ProgressPoint[]; metricLabel: string }) {
  const id = useId();
  const [active, setActive] = useState<number | null>(null);
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const values = points.map((point) => point.value);
  const lo = Math.max(0, Math.floor((Math.min(...values) - 10) / 10) * 10);
  const hi = Math.min(100, Math.ceil((Math.max(...values) + 5) / 10) * 10);
  const x = (index: number) => PAD.left + (points.length === 1 ? plotW / 2 : (index / (points.length - 1)) * plotW);
  const y = (value: number) => PAD.top + plotH - ((value - lo) / (hi - lo || 1)) * plotH;
  const xy = points.map((point, index) => [x(index), y(point.value)] as [number, number]);
  const line = smoothPath(xy);
  const area = `${line} L${xy[xy.length - 1][0]},${PAD.top + plotH} L${xy[0][0]},${PAD.top + plotH} Z`;
  const last = xy[xy.length - 1];

  const onPointer = (event: PointerEvent<SVGRectElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = (event.clientX - rect.left) / rect.width;
    setActive(Math.max(0, Math.min(points.length - 1, Math.round(ratio * (points.length - 1)))));
  };

  const tip = active !== null ? points[active] : null;
  const tipX = active !== null ? (xy[active][0] / W) * 100 : 0;

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full overflow-visible" role="img" aria-labelledby={`${id}-desc`}>
        <defs>
          <linearGradient id={`${id}-fill`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#7d51fe" stopOpacity="0.34" />
            <stop offset="100%" stopColor="#7d51fe" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {/* Jemná mriežka: zvislé linky v bodoch, os X */}
        {xy.map(([px], index) => (
          <line key={points[index].id} x1={px} x2={px} y1={PAD.top} y2={PAD.top + plotH} stroke="var(--color-chart-grid)" strokeWidth="1" />
        ))}
        <line x1={PAD.left} x2={PAD.left} y1={PAD.top - 4} y2={PAD.top + plotH} stroke="var(--color-chart-axis)" strokeWidth="1" />
        <line x1={PAD.left} x2={W - PAD.right} y1={PAD.top + plotH} y2={PAD.top + plotH} stroke="var(--color-chart-axis)" strokeWidth="1" />
        <path d={area} fill={`url(#${id}-fill)`} />
        <path d={line} fill="none" stroke="var(--color-chart-violet)" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" />
        {xy.slice(0, -1).map(([px, py], index) => (
          <line key={`t${points[index].id}`} x1={px} x2={px} y1={py - 4.5} y2={py + 4.5} stroke="var(--color-chart-violet)" strokeWidth="1.5" strokeLinecap="round" />
        ))}
        {active !== null ? (
          <line x1={xy[active][0]} x2={xy[active][0]} y1={PAD.top} y2={PAD.top + plotH} stroke="var(--color-mute)" strokeOpacity="0.5" strokeDasharray="3 3" />
        ) : null}
        <circle cx={last[0]} cy={last[1]} r="9" fill="var(--color-signal)" fillOpacity="0.18" />
        <circle cx={last[0]} cy={last[1]} r="5" fill="#f4ffe0" stroke="var(--color-signal)" strokeWidth="2.5" />
        {active !== null && active !== points.length - 1 ? (
          <circle cx={xy[active][0]} cy={xy[active][1]} r="4.5" fill="var(--color-chart-violet)" stroke="var(--color-panel)" strokeWidth="2" />
        ) : null}
        <rect
          x={PAD.left}
          y={0}
          width={plotW}
          height={H}
          fill="transparent"
          onPointerMove={onPointer}
          onPointerDown={onPointer}
          onPointerLeave={() => setActive(null)}
        />
      </svg>
      {tip ? (
        <div
          className="pointer-events-none absolute -top-2 z-10 -translate-x-1/2 -translate-y-full rounded-lg border border-line-strong bg-panel-2 px-2.5 py-1.5 text-center whitespace-nowrap shadow-lg"
          style={{ left: `${Math.min(86, Math.max(14, tipX))}%` }}
        >
          <p className="text-[13px] font-semibold text-paper tabular-nums">{tip.value} %</p>
          <p className="text-[11.5px] text-mute">
            {tip.label} · {tip.detail}
          </p>
        </div>
      ) : null}
      <p id={`${id}-desc`} className="sr-only">
        {metricLabel} v čase: {points.map((point) => `${point.label} ${point.value} %`).join(", ")}.
      </p>
    </div>
  );
}

export function ProgressCard({ series, now, emptyHref }: { series: ProgressSeries; now: string; emptyHref: string }) {
  const nowDate = useMemo(() => new Date(now), [now]);
  const [range, setRange] = useState<ProgressRangeKey>(() => defaultProgressRange(series.points, nowDate));
  const selectId = useId();
  const points = pointsInRange(series.points, range, nowDate);
  const change = progressChange(points);
  const caption = series.family === "delivery" ? "jasne pokrytých častí pitchu" : "zodpovedaných otázok";

  return (
    <section aria-labelledby="progress-title" className="dash-card px-[18px] pt-[18px] pb-5">
      <div className="flex items-center justify-between gap-3">
        <h2 id="progress-title" className="text-[18px] font-bold tracking-[-0.01em] text-paper">
          Tvoj pokrok
        </h2>
        <div className="relative flex items-center">
          <label htmlFor={selectId} className="sr-only">
            Obdobie
          </label>
          <select
            id={selectId}
            value={range}
            onChange={(event) => setRange(event.target.value as ProgressRangeKey)}
            className="appearance-none rounded-md bg-transparent py-1 pr-6 pl-1 text-right text-[12.5px] text-mute outline-offset-2 hover:text-paper"
          >
            {PROGRESS_RANGES.map((option) => (
              <option key={option.key} value={option.key} className="bg-panel text-paper">
                {option.label}
              </option>
            ))}
          </select>
          <Icon name="chevronDown" className="pointer-events-none absolute right-0 size-4 text-mute" />
        </div>
      </div>

      {points.length >= 2 ? (
        <>
          <div className="mt-6">
            <Chart points={points} metricLabel={series.metricLabel} />
          </div>
          {change !== null ? (
            <div className="mt-6">
              <p
                className={`flex items-center gap-2.5 text-[20px] leading-none font-bold tabular-nums ${
                  change > 0 ? "text-accent" : change < 0 ? "text-coral" : "text-paper"
                }`}
              >
                <Icon name={change > 0 ? "arrowUp" : change < 0 ? "arrowDown" : "arrowRight"} className="size-[18px]" strokeWidth={2.2} />
                {change > 0 ? "+" : change < 0 ? "−" : ""}
                {Math.abs(change)}&nbsp;%
              </p>
              <p className="mt-2 text-[13px] text-mute">
                {change > 0 ? "viac" : change < 0 ? "menej" : "rovnako"} {caption} ako na začiatku obdobia
              </p>
            </div>
          ) : null}
        </>
      ) : (
        <div className="mt-5 rounded-xl border border-dashed border-line-strong px-4 py-6">
          <p className="text-[14px] font-medium text-paper">Na graf treba aspoň dva tréningy</p>
          <p className="mt-1 text-[13px] leading-relaxed text-mute">
            {series.points.length === 0
              ? "Po každom tréningu tu uvidíš, koľko otázok si zodpovedal priamo."
              : "Vyber dlhšie obdobie alebo absolvuj ďalší tréning rovnakého typu."}
          </p>
          {series.points.length === 0 ? (
            <Link href={emptyHref} className="mt-3 inline-flex text-[13px] font-semibold text-accent hover:text-paper">
              Začať tréning →
            </Link>
          ) : null}
        </div>
      )}
    </section>
  );
}
