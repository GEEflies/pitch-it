"use client";

import { useId, useState } from "react";

/*
  Stĺpcový graf jednej série (napr. dĺžka odpovedí) s cieľovou čiarou.
  Stĺpce nad cieľom majú stavovú farbu a textový štítok v legende; tooltip pri hoveri
  aj pri fokuse klávesnicou; tabuľkový pohľad pre čítačky a presné hodnoty.
*/

export type Column = { key: string; label: string; value: number; attention: boolean; detail: string };

const HEIGHT = 180;
const PAD = { top: 12, right: 8, bottom: 26, left: 36 };
const BAR_MAX = 24;

function niceMax(value: number): number {
  if (value <= 0) return 10;
  const step = 10 ** Math.floor(Math.log10(value));
  for (const multiple of [1, 2, 2.5, 5, 10]) if (multiple * step >= value) return multiple * step;
  return 10 * step;
}

export function ColumnChart({
  title,
  columns,
  target,
  unit,
  attentionLabel,
}: {
  title: string;
  columns: Column[];
  target: number | null;
  unit: string;
  attentionLabel: string;
}) {
  const id = useId();
  const [active, setActive] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);
  const width = Math.max(320, columns.length * 34 + PAD.left + PAD.right);
  const max = niceMax(Math.max(target ?? 0, ...columns.map((column) => column.value)) * 1.08);
  const plotHeight = HEIGHT - PAD.top - PAD.bottom;
  const band = (width - PAD.left - PAD.right) / Math.max(1, columns.length);
  const barWidth = Math.min(BAR_MAX, band * 0.6);
  const y = (value: number) => PAD.top + plotHeight - (value / max) * plotHeight;
  const ticks = [0, max / 2, max];
  const hasAttention = columns.some((column) => column.attention);

  return (
    <figure aria-labelledby={`${id}-title`}>
      <figcaption className="flex flex-wrap items-baseline justify-between gap-3">
        <span id={`${id}-title`} className="text-[15px] font-semibold text-paper">
          {title}
        </span>
        <span className="flex items-center gap-4 text-[13px] text-mute">
          {target !== null ? (
            <span className="flex items-center gap-1.5">
              <span aria-hidden="true" className="inline-block h-px w-4 bg-paper/70" />
              cieľ {target} {unit}
            </span>
          ) : null}
          {hasAttention ? (
            <span className="flex items-center gap-1.5">
              <span aria-hidden="true" className="inline-block size-2.5 rounded-[3px] bg-chart-attention" />
              {attentionLabel}
            </span>
          ) : null}
          <button type="button" className="underline-offset-4 hover:text-paper hover:underline" onClick={() => setShowTable((value) => !value)}>
            {showTable ? "Graf" : "Tabuľka"}
          </button>
        </span>
      </figcaption>

      {showTable ? (
        <table className="mt-3 w-full text-left text-[14px]">
          <thead className="text-faint">
            <tr>
              <th className="py-1.5 font-normal">Odpoveď</th>
              <th className="py-1.5 font-normal">Hodnota</th>
              <th className="py-1.5 font-normal">Detail</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line/60">
            {columns.map((column) => (
              <tr key={column.key}>
                <td className="py-1.5 text-paper">{column.label}</td>
                <td className="py-1.5 tabular-nums text-paper">
                  {Math.round(column.value)} {unit}
                  {column.attention ? <span className="ml-2 text-marker">{attentionLabel}</span> : null}
                </td>
                <td className="py-1.5 text-mute">{column.detail}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="relative mt-3 overflow-x-auto">
          <svg viewBox={`0 0 ${width} ${HEIGHT}`} className="h-[180px] min-w-full" style={{ width: `max(100%, ${width}px)` }} role="img" aria-label={`${title}. Prepni na tabuľku pre presné hodnoty.`}>
            {ticks.map((tick) => (
              <g key={tick}>
                <line x1={PAD.left} x2={width - PAD.right} y1={y(tick)} y2={y(tick)} stroke="var(--color-chart-grid)" strokeWidth={1} />
                <text x={PAD.left - 6} y={y(tick)} dy="0.32em" textAnchor="end" className="fill-faint text-[11px] tabular-nums">
                  {Math.round(tick)}
                </text>
              </g>
            ))}
            {columns.map((column, index) => {
              const x = PAD.left + band * index + (band - barWidth) / 2;
              const top = y(column.value);
              const heightValue = Math.max(0, PAD.top + plotHeight - top);
              const radius = Math.min(4, heightValue);
              return (
                <g key={column.key}>
                  <path
                    d={`M${x},${PAD.top + plotHeight} V${top + radius} Q${x},${top} ${x + radius},${top} H${x + barWidth - radius} Q${x + barWidth},${top} ${x + barWidth},${top + radius} V${PAD.top + plotHeight} Z`}
                    fill={column.attention ? "var(--color-chart-attention)" : "var(--color-chart-1)"}
                    opacity={active === null || active === index ? 1 : 0.55}
                  />
                  <text x={x + barWidth / 2} y={HEIGHT - 8} textAnchor="middle" className="fill-faint text-[11px]">
                    {column.label}
                  </text>
                  <rect
                    x={PAD.left + band * index}
                    y={PAD.top}
                    width={band}
                    height={plotHeight}
                    fill="transparent"
                    tabIndex={0}
                    role="button"
                    aria-label={`${column.label}: ${Math.round(column.value)} ${unit}. ${column.detail}`}
                    onMouseEnter={() => setActive(index)}
                    onMouseLeave={() => setActive(null)}
                    onFocus={() => setActive(index)}
                    onBlur={() => setActive(null)}
                    className="outline-none"
                  />
                </g>
              );
            })}
            {target !== null ? (
              <line x1={PAD.left} x2={width - PAD.right} y1={y(target)} y2={y(target)} stroke="var(--color-paper)" strokeOpacity={0.7} strokeWidth={1} />
            ) : null}
          </svg>
          {active !== null ? (
            <div
              role="tooltip"
              className="pointer-events-none absolute top-0 z-10 max-w-[16rem] -translate-x-1/2 rounded-[8px] border border-line-strong bg-panel-2 px-3 py-2 text-[13px] text-paper shadow-[0_12px_30px_-12px_rgba(0,0,0,0.7)]"
              style={{ left: `${((PAD.left + band * active + band / 2) / width) * 100}%` }}
            >
              <p className="font-semibold">
                {columns[active].label}: {Math.round(columns[active].value)} {unit}
              </p>
              <p className="mt-0.5 text-mute">{columns[active].detail}</p>
            </div>
          ) : null}
        </div>
      )}
    </figure>
  );
}
