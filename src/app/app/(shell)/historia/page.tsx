import type { Metadata } from "next";
import { HistoryView } from "@/components/history/history-view";
import { Notice } from "@/components/ui/notice";
import { requireUser } from "@/lib/auth/session";
import { listSessionsWithReports } from "@/lib/db/sessions";
import { TRAINING_MODES, isOneOf, type TrainingMode } from "@/lib/domain/labels";
import { toComparable } from "@/lib/history/load";

// Stránka závisí od URL a dát používateľa: navigácia smie počkať na server.
export const instant = false;

export const metadata: Metadata = { title: "História" };

export default async function HistoryPage({ searchParams }: PageProps<"/app/historia">) {
  const user = await requireUser("/app/historia");
  const params = await searchParams;
  const sessions = await listSessionsWithReports(user.id);
  const counts = Object.fromEntries(TRAINING_MODES.map((mode) => [mode, sessions.filter((session) => session.mode === mode).length])) as Record<TrainingMode, number>;
  const requested = Array.isArray(params.rezim) ? params.rezim[0] : params.rezim;
  const mode: TrainingMode = isOneOf(TRAINING_MODES, requested)
    ? requested
    : TRAINING_MODES.reduce((best, current) => (counts[current] > counts[best] ? current : best), "coach" as TrainingMode);

  return (
    <HistoryView
      sessions={sessions}
      comparable={sessions.map(toComparable)}
      mode={mode}
      counts={counts}
      notice={params.zmazany ? <Notice tone="success" className="mb-8">Tréning je zmazaný.</Notice> : null}
    />
  );
}
