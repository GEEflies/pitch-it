import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ReportView } from "@/components/report/report-view";
import { requireUser } from "@/lib/auth/session";
import { listExercises } from "@/lib/db/exercises";
import { getProject } from "@/lib/db/projects";
import { findOwnedSession, getReport, listTurns } from "@/lib/db/sessions";
import { trackEvent } from "@/lib/events/track";
import { isUuid } from "@/lib/validation/ids";

// Stránka závisí od URL a dát používateľa: navigácia smie počkať na server.
export const instant = false;

export const metadata: Metadata = { title: "Rozbor tréningu" };

export default async function ReportPage({ params }: PageProps<"/app/trening/[sessionId]">) {
  const { sessionId } = await params;
  const user = await requireUser(`/app/trening/${sessionId}`);
  if (!isUuid(sessionId)) notFound();
  const session = await findOwnedSession(sessionId, user.id);
  if (!session) notFound();
  if (session.status === "ready" || session.status === "live") redirect(`/app/miestnost/${session.id}`);

  const [report, turns, project, exercises] = await Promise.all([
    getReport(session.id),
    listTurns(session.id),
    getProject(session.project_id),
    listExercises(user.id),
  ]);
  if (report?.status === "ready") await trackEvent(user.id, "report_viewed", { mode: session.mode });

  const retest = new URLSearchParams({
    projekt: session.project_id,
    rezim: session.mode === "coach" ? "simulation" : session.mode,
    investor: session.investor_key,
    scenar: session.scenario_key,
    predosly: session.id,
  });

  return (
    <ReportView
      session={session}
      projectName={project?.name ?? null}
      report={report}
      turns={turns}
      sessionExercises={exercises.filter((exercise) => exercise.source_session_id === session.id)}
      links={{
        history: "/app/historia",
        retest: `/app/trening/novy?${retest.toString()}`,
        materials: `/app/projekty/${session.project_id}/podklady`,
        exercises: "/app/cvicenia",
        exercise: (id) => `/app/cvicenia/${id}`,
      }}
    />
  );
}
