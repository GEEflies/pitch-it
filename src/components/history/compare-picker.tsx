"use client";

import Link from "next/link";
import { useState } from "react";
import { SessionStatusText } from "@/components/app/session-status";
import { buttonClasses } from "@/components/ui/button";
import type { ReportStatus } from "@/lib/db/types";
import type { SessionStatus, TrainingMode } from "@/lib/domain/labels";

export type HistoryRow = {
  id: string;
  mode: TrainingMode;
  modeLabel: string;
  title: string;
  subtitle: string;
  duration: string;
  status: SessionStatus;
  reportStatus: ReportStatus | null;
};

/** Zoznam tréningov s výberom dvoch rovnakého režimu na porovnanie. */
export function ComparePicker({
  rows,
  reportBase = "/app/trening/",
  compareBase = "/app/historia/porovnanie",
}: {
  rows: HistoryRow[];
  reportBase?: string;
  compareBase?: string;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const selectedMode = rows.find((row) => row.id === selected[0])?.mode ?? null;

  const toggle = (id: string) =>
    setSelected((current) => (current.includes(id) ? current.filter((value) => value !== id) : [...current, id].slice(-2)));

  const compareHref =
    selected.length === 2
      ? (() => {
          // Starší tréning ako „pred“, novší ako „po“ (rows sú zoradené od najnovšieho).
          const ordered = rows.filter((row) => selected.includes(row.id)).reverse();
          return `${compareBase}?a=${ordered[0].id}&b=${ordered[1].id}`;
        })()
      : null;

  return (
    <div>
      <div className="sticky top-16 z-10 flex flex-wrap items-center justify-between gap-3 border-b border-line/70 bg-ink/95 py-3 lg:top-0">
        <p className="text-sm text-mute" aria-live="polite">
          {selected.length === 0
            ? "Vyber dva tréningy rovnakého režimu a porovnaj ich."
            : selected.length === 1
              ? "Vyber ešte jeden tréning rovnakého režimu."
              : "Pripravené na porovnanie."}
        </p>
        {compareHref ? (
          <Link href={compareHref} className={buttonClasses()}>
            Porovnať
          </Link>
        ) : null}
      </div>
      <ul className="divide-y divide-line/70 border-b border-line/70">
        {rows.map((row) => {
          const disabled = selectedMode !== null && row.mode !== selectedMode && !selected.includes(row.id);
          return (
            <li key={row.id} className="flex items-center gap-4 py-4">
              <input
                type="checkbox"
                aria-label={`Vybrať na porovnanie: ${row.title}`}
                checked={selected.includes(row.id)}
                disabled={disabled}
                onChange={() => toggle(row.id)}
                className="size-[18px] shrink-0 accent-signal disabled:opacity-40"
              />
              <Link href={`${reportBase}${row.id}`} className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <span className="min-w-0">
                  <span className="block truncate font-medium text-paper">{row.title}</span>
                  <span className="block text-sm text-faint">
                    {row.modeLabel}, {row.subtitle}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-4 text-sm">
                  <span className="tabular-nums text-mute">{row.duration}</span>
                  <SessionStatusText status={row.status} report={row.reportStatus} />
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
