import type { Metadata } from "next";
import Link from "next/link";
import { SetupForm, type SetupDefaults } from "@/components/session/setup-form";
import { buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Notice } from "@/components/ui/notice";
import { PageHeader } from "@/components/ui/page-header";
import { getAnthropicConfig, getOpenAiRealtimeConfig } from "@/config/server-env";
import { requireUser } from "@/lib/auth/session";
import { remainingRealtimeSeconds } from "@/lib/billing/plans";
import { getExercise } from "@/lib/db/exercises";
import { getSettings } from "@/lib/db/profile";
import { listProjects } from "@/lib/db/projects";
import { getBillingContext } from "@/lib/db/usage";
import { COACH_FOCUS_OPTIONS, TRAINING_MODES, isOneOf, type CoachFocus } from "@/lib/domain/labels";
import { CATEGORY_INVESTOR } from "@/lib/exercises/catalog";
import { isInvestorKey, isScenarioKey } from "@/lib/investor/catalog";
import { isUuid } from "@/lib/validation/ids";

// Stránka závisí od URL a dát používateľa: navigácia smie počkať na server.
export const instant = false;

export const metadata: Metadata = { title: "Nový tréning" };

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function NewTrainingPage({ searchParams }: PageProps<"/app/trening/novy">) {
  const user = await requireUser("/app/trening/novy");
  const params = await searchParams;
  const [projects, settings, billing] = await Promise.all([
    listProjects(),
    getSettings(user.id),
    getBillingContext(user.id),
  ]);

  if (projects.length === 0) {
    return (
      <>
        <PageHeader title="Nový tréning" />
        <EmptyState
          title="Najprv opíš svoj startup"
          action={
            <Link href="/app/projekty/novy" className={buttonClasses({ size: "lg" })}>
              Vytvoriť profil startupu
            </Link>
          }
        >
          Investor sa pýta na tvoj trh, čísla a tím. Bez profilu startupu nemá z čoho vychádzať.
        </EmptyState>
      </>
    );
  }

  const exerciseId = first(params.cvicenie);
  const exercise = isUuid(exerciseId) ? await getExercise(exerciseId) : null;

  const requestedProject = first(params.projekt);
  const requestedMode = first(params.rezim);
  const requestedInvestor = first(params.investor);
  const requestedScenario = first(params.scenar);
  const previous = first(params.predosly);

  const defaults: SetupDefaults = {
    projectId:
      (isUuid(requestedProject) && projects.some((project) => project.id === requestedProject) ? requestedProject : null) ??
      exercise?.project_id ??
      projects[0].id,
    mode: isOneOf(TRAINING_MODES, requestedMode) ? requestedMode : (settings?.default_mode ?? "coach"),
    investorKey: isInvestorKey(requestedInvestor)
      ? requestedInvestor
      : exercise
        ? CATEGORY_INVESTOR[exercise.category]
        : "generalist",
    scenarioKey: isScenarioKey(requestedScenario) ? requestedScenario : null,
    coachFocus: (settings?.coach_focus ?? ["pace", "answer_length"]).filter((focus): focus is CoachFocus =>
      isOneOf(COACH_FOCUS_OPTIONS, focus),
    ),
    previousSessionId: isUuid(previous) ? previous : null,
    exerciseId: exercise?.id ?? null,
  };

  const realtimeAvailable = getOpenAiRealtimeConfig() !== null;
  const textAvailable = getAnthropicConfig() !== null;
  const remainingMinutes = Math.floor(remainingRealtimeSeconds(billing.plan, billing.usage) / 60);

  return (
    <>
      <PageHeader
        title="Nový tréning"
        description="Vyber, s kým a na aké stretnutie sa pripravuješ. Mikrofón a kameru nastavíš v ďalšom kroku."
      />
      {!realtimeAvailable && !textAvailable ? (
        <Notice tone="attention" className="mb-8" title="AI investor teraz nie je dostupný">
          {process.env.NODE_ENV !== "production"
            ? "Vývojárska poznámka: nastav OPENAI_API_KEY (hlas) alebo ANTHROPIC_API_KEY (text) v .env.local. Postup je v README."
            : "Skús to prosím neskôr."}
        </Notice>
      ) : null}
      <SetupForm
        projects={projects.map((project) => ({ id: project.id, name: project.name }))}
        defaults={defaults}
        realtimeAvailable={realtimeAvailable}
        textAvailable={textAvailable}
        remainingMinutes={remainingMinutes}
        maxSessionMinutes={billing.plan.limits.maxSessionMinutes}
        exerciseTitle={exercise?.title ?? null}
      />
    </>
  );
}
