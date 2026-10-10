import type { ReactNode } from "react";
import Link from "next/link";
import { LineChart } from "@/components/charts/line-chart";
import { ComparePicker } from "@/components/history/compare-picker";
import { buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import type { SessionWithReport } from "@/lib/db/sessions";
import { TRAINING_MODES, TRAINING_MODE_LABELS, type TrainingMode } from "@/lib/domain/labels";
import { formatDateTime, formatDuration, formatShortDate } from "@/lib/format";
import { METRICS, metricSeries, type ComparableSession } from "@/lib/history/compare";
import { INVESTOR_STYLES, SCENARIOS, isInvestorKey, isScenarioKey } from "@/lib/investor/catalog";

export type HistoryViewData = {
  sessions: Array<Pick<SessionWithReport, "id" | "mode" | "status" | "investor_key" | "scenario_key" | "created_at" | "billed_seconds" | "projects" | "feedback_reports">>;
  comparable: ComparableSession[];
  mode: TrainingMode;
  counts: Record<TrainingMode, number>;
  notice?: ReactNode;
  href?: (path: string) => string;
  reportBase?: string;
  compareBase?: string;
};

export function HistoryView({ sessions, comparable, mode, counts, notice = null, href = (path) => path, reportBase, compareBase }: HistoryViewData) {
  const charts = METRICS.map((definition) => ({ definition, series: metricSeries(comparable, definition, mode) })).filter(
    (chart) => chart.series.length >= 2,
  );

  if (sessions.length === 0) {
    return (
      <>
        <PageHeader title="História" />
        <EmptyState
          title="Zatiaľ žiadny dokončený tréning"
          action={
            <Link href={href("/app/trening/novy")} className={buttonClasses({ size: "lg" })}>
              Začať tréning
            </Link>
          }
        >
          Po každom tréningu tu pribudne rozbor a namerané hodnoty. Od druhého tréningu uvidíš aj vývoj v čase.
        </EmptyState>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="História"
        description="Vývoj iba z nameraných hodnôt a iba v rámci rovnakého typu tréningu. Pri jednotlivých pokusoch nájdeš aj rozbor obsahu."
      />
      {notice}

      <nav aria-label="Typ tréningu" className="mb-8 flex flex-wrap gap-2">
        {TRAINING_MODES.map((option) => (
          <Link
            key={option}
            href={href(`/app/historia?rezim=${option}`)}
            aria-current={option === mode ? "page" : undefined}
            className={`rounded-full border px-4 py-2 text-sm transition-colors ${
              option === mode ? "border-signal bg-signal/10 text-paper" : "border-line-strong text-mute hover:text-paper"
            }`}
          >
            {TRAINING_MODE_LABELS[option]} ({counts[option]})
          </Link>
        ))}
      </nav>

      <section aria-labelledby="trend" className="mb-14">
        <h2 id="trend" className="type-heading text-[1.4rem]">
          Vývoj
        </h2>
        {charts.length === 0 ? (
          <p className="mt-3 max-w-[40rem] leading-relaxed text-mute">
            Na vývoj treba aspoň dva hlasové tréningy tohto typu s meraniami. {counts[mode] === 1 ? "Zatiaľ máš jeden." : ""}
          </p>
        ) : (
          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {charts.map(({ definition, series }) => (
              <LineChart
                key={definition.key}
                title={definition.label}
                description={
                  definition.direction === "lower_better"
                    ? "Nižšie je lepšie"
                    : definition.direction === "higher_better"
                      ? "Vyššie je lepšie"
                      : "Cieľom je bežný rozsah"
                }
                unit={definition.unit}
                band={definition.range ? { ...definition.range, label: "orientačný bežný rozsah" } : undefined}
                digits={definition.digits}
                points={series.map(({ session, value }) => ({
                  key: session.id,
                  xLabel: formatShortDate(session.createdAt),
                  value,
                  detail: formatDateTime(session.createdAt),
                }))}
              />
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="sessions">
        <h2 id="sessions" className="type-heading text-[1.4rem]">
          Tréningy
        </h2>
        <div className="mt-4">
          <ComparePicker
            reportBase={reportBase}
            compareBase={compareBase}
            rows={sessions
              .filter((session) => session.mode === mode)
              .map((session) => ({
                id: session.id,
                mode: session.mode,
                modeLabel: TRAINING_MODE_LABELS[session.mode],
                title:
                  session.mode === "delivery"
                    ? isScenarioKey(session.scenario_key)
                      ? SCENARIOS[session.scenario_key].name
                      : "Prednes"
                    : isInvestorKey(session.investor_key)
                      ? INVESTOR_STYLES[session.investor_key].name
                      : "Investor",
                subtitle: `${session.projects?.name ?? "Projekt"}, ${formatDateTime(session.created_at)}`,
                duration: formatDuration(session.billed_seconds || null),
                status: session.status,
                reportStatus: session.feedback_reports?.status ?? null,
              }))}
          />
        </div>
      </section>
    </>
  );
}
