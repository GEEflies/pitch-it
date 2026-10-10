import type { ReactNode } from "react";
import Link from "next/link";
import { GettingStarted, type ChecklistItem } from "@/components/app/getting-started";
import { SessionStatusText } from "@/components/app/session-status";
import { UsageMeter } from "@/components/app/usage-meter";
import { buttonClasses } from "@/components/ui/button";
import type { Plan, UsageTotals } from "@/lib/billing/plans";
import type { Recommendation } from "@/lib/dashboard/recommendation";
import type { SessionListItem } from "@/lib/db/sessions";
import type { ExerciseRow } from "@/lib/db/types";
import { TRAINING_MODE_LABELS } from "@/lib/domain/labels";
import { formatDateTime, formatDuration } from "@/lib/format";
import { INVESTOR_STYLES, isInvestorKey } from "@/lib/investor/catalog";

export type DashboardViewData = {
  name: string | null;
  recommendation: Recommendation;
  sessions: Array<Pick<SessionListItem, "id" | "status" | "mode" | "investor_key" | "created_at" | "billed_seconds" | "projects" | "feedback_reports">>;
  exercises: Array<Pick<ExerciseRow, "id" | "title" | "origin">>;
  billing: { plan: Plan; usage: UsageTotals };
  notice?: ReactNode;
  /** Prvé kroky nového účtu; prázdne alebo hotové sa neukáže. */
  checklist?: ChecklistItem[];
  /** Prepis odkazov (ukážka mapuje /app na /ukazka). */
  href?: (path: string) => string;
};

export function DashboardView({ name, recommendation, sessions, exercises, billing, notice = null, checklist = [], href = (path) => path }: DashboardViewData) {
  const minutesUsed = Math.ceil(billing.usage.realtime_seconds / 60);
  return (
    <div className="space-y-12">
      {notice}

      <GettingStarted items={checklist} href={href} />

      <section aria-labelledby="next-step" className="relative overflow-hidden rounded-xl border border-line bg-panel px-6 py-6 md:px-8 md:py-7">
        <p id="next-step" className="text-sm font-medium text-signal-soft">
          {name ? `${name}, tvoj ďalší krok` : "Tvoj ďalší krok"}
        </p>
        <h1 className="type-display mt-2 max-w-[40rem] text-[1.6rem] md:text-[1.85rem]">{recommendation.title}</h1>
        <p className="mt-2 max-w-[36rem] text-[15px] leading-relaxed text-mute">{recommendation.reason}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href={href(recommendation.href)} className={buttonClasses({ size: "lg" })}>
            {recommendation.cta}
          </Link>
          {recommendation.kind === "add_materials" ? (
            <Link href={href(recommendation.secondaryHref)} className={buttonClasses({ variant: "secondary", size: "lg" })}>
              Trénovať bez podkladov
            </Link>
          ) : null}
        </div>
      </section>

      <div className="grid gap-12 lg:grid-cols-12 lg:gap-10">
        <section aria-labelledby="recent" className="lg:col-span-7">
          <div className="flex items-baseline justify-between gap-4">
            <h2 id="recent" className="type-heading text-lg">
              Posledné tréningy
            </h2>
            {sessions.length > 0 ? (
              <Link href={href("/app/historia")} className="link-underline text-sm text-mute hover:text-paper">
                Celá história
              </Link>
            ) : null}
          </div>
          {sessions.length === 0 ? (
            <p className="mt-4 leading-relaxed text-mute">
              Zatiaľ žiadny tréning. Po prvom rozhovore tu uvidíš jeho priebeh a odkaz na rozbor.
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-line/70 border-y border-line/70">
              {sessions.map((session) => {
                const investor = isInvestorKey(session.investor_key) ? INVESTOR_STYLES[session.investor_key].name : session.investor_key;
                const target = session.status === "ready" || session.status === "live" ? `/app/miestnost/${session.id}` : `/app/trening/${session.id}`;
                return (
                  <li key={session.id}>
                    <Link href={href(target)} className="flex flex-col gap-1 py-4 transition-colors hover:bg-panel/40 sm:flex-row sm:items-center sm:justify-between sm:px-2">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-paper">{investor}</p>
                        <p className="mt-0.5 text-sm text-faint">
                          {session.projects?.name ?? "Projekt"}, {TRAINING_MODE_LABELS[session.mode].toLowerCase()}, {formatDateTime(session.created_at)}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-4 text-sm">
                        <span className="tabular-nums text-mute">{formatDuration(session.billed_seconds || null)}</span>
                        <SessionStatusText status={session.status} report={session.feedback_reports?.status ?? null} />
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <div className="space-y-12 lg:col-span-5">
          <section aria-labelledby="usage">
            <h2 id="usage" className="type-heading text-lg">
              Tento mesiac
            </h2>
            <p className="mt-1 text-sm text-faint">Plán {billing.plan.name}</p>
            <div className="mt-5 space-y-5">
              <UsageMeter label="Hlasový tréning" used={minutesUsed} limit={billing.plan.limits.realtimeMinutes} unit="min" />
              <UsageMeter label="Reporty" used={billing.usage.report} limit={billing.plan.limits.reports} unit="" />
            </div>
            {billing.plan.id === "free" ? (
              <Link href="/cennik" className="link-underline mt-5 inline-block text-sm text-mute hover:text-paper">
                Porovnať plány
              </Link>
            ) : null}
          </section>

          <section aria-labelledby="exercises">
            <div className="flex items-baseline justify-between gap-4">
              <h2 id="exercises" className="type-heading text-lg">
                Otvorené cvičenia
              </h2>
              <Link href={href("/app/cvicenia")} className="link-underline text-sm text-mute hover:text-paper">
                Knižnica
              </Link>
            </div>
            {exercises.length === 0 ? (
              <p className="mt-4 leading-relaxed text-mute">
                Cvičenia vzniknú z rozboru tréningu podľa toho, kde odpovede neobstáli. Môžeš začať aj z knižnice.
              </p>
            ) : (
              <ul className="mt-4 space-y-2">
                {exercises.slice(0, 4).map((exercise) => (
                  <li key={exercise.id}>
                    <Link
                      href={href(`/app/cvicenia/${exercise.id}`)}
                      className="flex items-start gap-3 rounded-[10px] px-2 py-2 transition-colors hover:bg-panel/60"
                    >
                      <span
                        aria-hidden="true"
                        className={`mt-2 size-1.5 shrink-0 rounded-full ${exercise.origin === "report" ? "bg-marker" : "bg-line-strong"}`}
                      />
                      <span>
                        <span className="block text-paper">{exercise.title}</span>
                        <span className="block text-sm text-faint">
                          {exercise.origin === "report" ? "Z rozboru tréningu" : "Z knižnice"}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
