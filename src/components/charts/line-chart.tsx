"use client";

import { useId, useState, type PointerEvent } from "react";
import { formatNumber } from "@/lib/format";

/*
  Malý čiarový graf jednej metriky v čase (small multiple v histórii).
  Voliteľné orientačné pásmo, koncový bod s hodnotou, krížový kurzor s tooltipom
  a tabuľkový pohľad. Jedna os, jedna séria.
*/

export type LinePoint = { key: string; xLabel: string; value: number; detail: string };

const WIDTH = 360;
const HEIGHT = 150;
const PAD = { top: 14, right: 40, bottom: 22, left: 34 };

function niceScale(min: number, max: number): [number, number] {
  if (min === max) return [Math.max(0, min - 1), max + 1];
  const span = max - min;
  const step = 10 ** Math.floor(Math.log10(span));
  return [Math.max(0, Math.floor(min / step) * step), Math.ceil(max / step) * step];
}

export function LineChart({
  title,
  description,
  points,
  unit,
  band,
  digits = 0,
}: {
  title: string;
  description?: string;
  points: LinePoint[];
  unit: string;
  band?: { low: number; high: number; label: string };
  /** Počet desatinných miest (funkcia sa do klientskeho komponentu posielať nedá). */
  digits?: number;
}) {
  const format = (value: number) => formatNumber(value, digits);
  const id = useId();
  const [active, setActive] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);

  const values = points.map((point) => point.value);
  const [lo, hi] = niceScale(
    Math.min(...values, band?.low ?? Infinity),
    Math.max(...values, band?.high ?? -Infinity),
  );
  const plotWidth = WIDTH - PAD.left - PAD.right;
  const plotHeight = HEIGHT - PAD.top - PAD.bottom;
  const x = (index: number) => PAD.left + (points.length === 1 ? plotWidth / 2 : (index / (points.length - 1)) * plotWidth);
  const y = (value: number) => PAD.top + plotHeight - ((value - lo) / (hi - lo || 1)) * plotHeight;
  const path = points.map((point, index) => `${index === 0 ? "M" : "L"}${x(index)},${y(point.value)}`).join(" ");
  const last = points.length - 1;

  const onPointer = (event: PointerEvent<SVGRectElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const relative = ((event.clientX - rect.left) / rect.width) * plotWidth;
    const index = points.length === 1 ? 0 : Math.round((relative / plotWidth) * (points.length - 1));
    setActive(Math.max(0, Math.min(points.length - 1, index)));
  };

  return (
    <figure aria-labelledby={`${id}-title`} className="rounded-[14px] border border-line bg-panel/60 p-4">
      <figcaption>
        <div className="flex items-baseline justify-between gap-3">
          <span id={`${id}-title`} className="text-[15px] font-semibold text-paper">
            {title}
          </span>
          <button type="button" className="text-[13px] text-mute underline-offset-4 hover:text-paper hover:underline" onClick={() => setShowTable((value) => !value)}>
            {showTable ? "Graf" : "Tabuľka"}
          </button>
        </div>
        {description ? <p className="mt-0.5 text-[13px] text-faint">{description}</p> : null}
      </figcaption>

      {showTable ? (
        <table className="mt-3 w-full text-left text-[13.5px]">
          <tbody className="divide-y divide-line/60">
            {points.map((point) => (
              <tr key={point.key}>
                <td className="py-1.5 text-mute">{point.xLabel}</td>
                <td className="py-1.5 text-right tabular-nums text-paper">
                  {format(point.value)} {unit}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="relative mt-2">
          <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full" role="img" aria-label={`${title}: ${points.map((point) => `${point.xLabel} ${format(point.value)} ${unit}`).join(", ")}`}>
            {band ? (
              <rect
                x={PAD.left}
                width={plotWidth}
                y={y(Math.min(hi, band.high))}
                height={Math.max(0, y(Math.max(lo, band.low)) - y(Math.min(hi, band.high)))}
                fill="var(--color-chart-1)"
                opacity={0.1}
              />
            ) : null}
            {[lo, hi].map((tick) => (
              <g key={tick}>
                <line x1={PAD.left} x2={PAD.left + plotWidth} y1={y(tick)} y2={y(tick)} stroke="var(--color-chart-grid)" strokeWidth={1} />
                <text x={PAD.left - 6} y={y(tick)} dy="0.32em" textAnchor="end" className="fill-faint text-[10.5px] tabular-nums">
                  {format(tick)}
                </text>
              </g>
            ))}
            <text x={PAD.left} y={HEIGHT - 6} className="fill-faint text-[10.5px]">
              {points[0]?.xLabel}
            </text>
            {points.length > 1 ? (
              <text x={PAD.left + plotWidth} y={HEIGHT - 6} textAnchor="end" className="fill-faint text-[10.5px]">
                {points[last].xLabel}
              </text>
            ) : null}
            <path d={path} fill="none" stroke="var(--color-chart-1)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            {active !== null ? (
              <line x1={x(active)} x2={x(active)} y1={PAD.top} y2={PAD.top + plotHeight} stroke="var(--color-mute)" strokeWidth={1} />
            ) : null}
            {points.map((point, index) => (
              <circle
                key={point.key}
                cx={x(index)}
                cy={y(point.value)}
                r={index === last || index === active ? 4.5 : 3}
                fill="var(--color-chart-1)"
                stroke="var(--color-panel)"
                strokeWidth={2}
              />
            ))}
            {points.length > 0 ? (
              <text x={x(last) + 8} y={y(points[last].value)} dy="0.32em" className="fill-paper text-[11.5px] font-semibold tabular-nums">
                {format(points[last].value)}
              </text>
            ) : null}
            <rect
              x={PAD.left}
              y={PAD.top}
              width={plotWidth}
              height={plotHeight}
              fill="transparent"
              onPointerMove={onPointer}
              onPointerLeave={() => setActive(null)}
            />
          </svg>
          {active !== null ? (
            <div
              role="tooltip"
              className="pointer-events-none absolute -top-2 z-10 w-max max-w-[14rem] -translate-x-1/2 -translate-y-full rounded-[8px] border border-line-strong bg-panel-2 px-3 py-2 text-[12.5px] text-paper shadow-[0_12px_30px_-12px_rgba(0,0,0,0.7)]"
              style={{ left: `${(x(active) / WIDTH) * 100}%` }}
            >
              <p className="font-semibold tabular-nums">
                {format(points[active].value)} {unit}
              </p>
              <p className="text-mute">{points[active].detail}</p>
            </div>
          ) : null}
          {band ? <p className="mt-1 text-[12px] text-faint">Podfarbené: {band.label}</p> : null}
        </div>
      )}
    </figure>
  );
}
