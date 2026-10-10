import type { Metadata } from "next";
import { DashboardView } from "@/components/app/dashboard-view";
import { Notice } from "@/components/ui/notice";
import { requireUser } from "@/lib/auth/session";
import { recommendNextStep } from "@/lib/dashboard/recommendation";
import { listExercises } from "@/lib/db/exercises";
import { getProfile } from "@/lib/db/profile";
import { getMaterialCounts, listProjects } from "@/lib/db/projects";
import { listSessions } from "@/lib/db/sessions";
import { getBillingContext } from "@/lib/db/usage";

// Stránka závisí od URL a dát používateľa: navigácia smie počkať na server.
export const instant = false;

export const metadata: Metadata = { title: "Prehľad" };

export default async function DashboardPage({ searchParams }: PageProps<"/app">) {
  const user = await requireUser("/app");
  const params = await searchParams;
  const [profile, projects, sessions, exercises, billing] = await Promise.all([
    getProfile(user.id),
    listProjects(),
    listSessions({ userId: user.id, limit: 6 }),
    listExercises(user.id, "open"),
    getBillingContext(user.id),
  ]);
  const counts = await getMaterialCounts(projects.map((project) => project.id));

  const last = sessions.find((session) => session.status === "completed") ?? null;
  const recommendation = recommendNextStep({
    projects: projects.map((project) => ({
      id: project.id,
      name: project.name,
      hasDeck: (counts[project.id]?.documents ?? 0) > 0,
      factCount: counts[project.id]?.facts ?? 0,
    })),
    lastSession: last
      ? {
          id: last.id,
          projectId: last.project_id,
          mode: last.mode,
          investorKey: last.investor_key,
          scenarioKey: last.scenario_key,
          status: last.status,
          reportStatus: last.feedback_reports?.status ?? null,
        }
      : null,
    openReportExercises: exercises
      .filter((exercise) => exercise.origin === "report")
      .map((exercise) => ({ id: exercise.id, title: exercise.title, sourceSessionId: exercise.source_session_id })),
    completedExercisesSinceLastSession: 0,
  });

  return (
    <DashboardView
      name={profile?.display_name ?? null}
      recommendation={recommendation}
      sessions={sessions}
      exercises={exercises}
      billing={billing}
      notice={params.heslo === "zmenene" ? <Notice tone="success">Heslo je zmenené.</Notice> : null}
    />
  );
}
