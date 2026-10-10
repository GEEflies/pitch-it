import type { Metadata } from "next";
import Link from "next/link";
import { HistoryView } from "@/components/history/history-view";
import { requireUser } from "@/lib/auth/session";
import { listExercises } from "@/lib/db/exercises";
import { listSessionsWithReports } from "@/lib/db/sessions";
import { TRAINING_MODES, isOneOf, type TrainingMode } from "@/lib/domain/labels";
import { plural } from "@/lib/format";
import { toComparable } from "@/lib/history/load";

// Stránka závisí od URL a dát používateľa: navigácia smie počkať na server.
export const instant = false;

export const metadata: Metadata = { title: "Progres" };

export default async function ProgressPage({ searchParams }: PageProps<"/app/progres">) {
  const user = await requireUser("/app/progres");
  const params = await searchParams;
  const [sessions, exercises] = await Promise.all([listSessionsWithReports(user.id), listExercises(user.id, "open")]);
  const counts = Object.fromEntries(TRAINING_MODES.map((mode) => [mode, sessions.filter((session) => session.mode === mode).length])) as Record<TrainingMode, number>;
  const requested = Array.isArray(params.rezim) ? params.rezim[0] : params.rezim;
  const mode: TrainingMode = isOneOf(TRAINING_MODES, requested)
    ? requested
    : TRAINING_MODES.reduce((best, current) => (counts[current] > counts[best] ? current : best), "coach" as TrainingMode);

  return (
    <>
      <HistoryView sessions={sessions} comparable={sessions.map(toComparable)} mode={mode} counts={counts} view="trends" />
      <section aria-labelledby="exercises" className="dash-card mt-2 flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 id="exercises" className="text-[17px] font-bold text-paper">
            Cvičenia na zlepšenie
          </h2>
          <p className="mt-1 text-[14px] text-mute">
            {exercises.length > 0
              ? `${exercises.length} ${plural(exercises.length, "otvorené cvičenie", "otvorené cvičenia", "otvorených cvičení")} z rozborov a knižnice.`
              : "Cvičenia vzniknú z rozboru tréningu tam, kde odpovede neobstáli."}
          </p>
        </div>
        <Link href="/app/cvicenia" className="inline-flex h-10 shrink-0 items-center justify-center rounded-full border border-line-strong px-5 text-[14px] font-semibold text-paper hover:bg-panel-2">
          Otvoriť cvičenia
        </Link>
      </section>
    </>
  );
}
