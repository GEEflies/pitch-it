import type { Metadata } from "next";
import { redirect } from "next/navigation";
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
  // Nový účet: najprv krátky úvodný kvíz (dá sa preskočiť).
  if (profile && !profile.onboarding_completed_at) redirect("/app/vitaj");

  const counts = await getMaterialCounts(projects.map((project) => project.id));

  const firstProject = projects[0] ?? null;
  const hasDeck = projects.some((project) => (counts[project.id]?.documents ?? 0) > 0);
  const deckProject = firstProject ? `/app/projekty/${firstProject.id}/podklady` : "/app/projekty/novy";
  const checklist = [
    {
      key: "profile",
      title: "Nastav si plán tréningu",
      detail: "Šesť rýchlych otázok, z ktorých zostavíme plán pred stretnutím.",
      href: "/app/vitaj",
      done: Boolean(profile?.onboarding_answers),
    },
    {
      key: "project",
      title: "Opíš svoj startup",
      detail: "Investor sa bude pýtať podľa profilu startupu.",
      href: firstProject ? `/app/projekty/${firstProject.id}` : "/app/projekty/novy",
      done: projects.length > 0,
    },
    {
      key: "deck",
      title: "Nahraj pitch deck",
      detail: "PDF alebo PPTX. Vytiahneme z neho čísla a fakty, na ktoré sa investor opýta.",
      href: deckProject,
      done: hasDeck,
    },
    {
      key: "session",
      title: "Absolvuj prvý tréning",
      detail: "Hlasový rozhovor so simulovaným investorom.",
      href: "/app/trening/novy",
      done: sessions.some((session) => session.status === "completed"),
    },
    {
      key: "report",
      title: "Prejdi si rozbor",
      detail: "Merania, citácie slabých miest a cvičenia na zlepšenie.",
      href: "/app/historia",
      done: sessions.some((session) => session.feedback_reports?.status === "ready"),
    },
  ];

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
      checklist={checklist}
      notice={params.heslo === "zmenene" ? <Notice tone="success">Heslo je zmenené.</Notice> : null}
    />
  );
}
