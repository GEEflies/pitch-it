"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { completeOnboarding } from "@/lib/db/profile";
import { countOwnedProjects, createProject, listProjects } from "@/lib/db/projects";
import { getBillingContext } from "@/lib/db/usage";
import { trackEvent } from "@/lib/events/track";
import { ANSWERS_VERSION, buildTrainingPlan, onboardingSubmissionSchema } from "@/lib/onboarding/plan";
import { projectSchema } from "@/lib/validation/schemas";

export type OnboardingResult = { status: "ok"; projectId: string } | { status: "error"; message: string };

/**
 * Uloží odpovede z kvízu, vytvorí prvý projekt a nastaví predvolený režim tréningu.
 * Ak plán už ďalší projekt nedovolí, použije existujúci (napr. ak sa kvíz spustí znova).
 */
export async function submitOnboarding(input: unknown): Promise<OnboardingResult> {
  const user = await getCurrentUser();
  if (!user) return { status: "error", message: "Relácia vypršala. Prihlás sa znova." };

  const parsed = onboardingSubmissionSchema.safeParse(input);
  if (!parsed.success) return { status: "error", message: "Niektorá odpoveď chýba. Vráť sa a doplň ju." };
  const { startupName, ...answers } = parsed.data;
  const plan = buildTrainingPlan(answers);

  try {
    const [billing, owned] = await Promise.all([getBillingContext(user.id), countOwnedProjects(user.id)]);
    let projectId: string;
    if (owned < billing.plan.limits.projects) {
      const project = await createProject(user.id, projectSchema.parse({ name: startupName, stage: answers.stage }));
      projectId = project.id;
      await trackEvent(user.id, "project_created", { stage: answers.stage, first: owned === 0, source: "onboarding" });
    } else {
      const [existing] = await listProjects();
      if (!existing) return { status: "error", message: "Projekt sa nepodarilo vytvoriť. Skús to znova." };
      projectId = existing.id;
    }

    await completeOnboarding(user.id, {
      answers: { version: ANSWERS_VERSION, ...answers },
      settings: { default_mode: plan.firstSession.mode, coach_focus: plan.coachFocus },
    });
    await trackEvent(user.id, "onboarding_completed", {
      stage: answers.stage,
      meeting: answers.meeting,
      experience: answers.experience,
      worries: answers.worries.join(","),
    });
    revalidatePath("/app", "layout");
    return { status: "ok", projectId };
  } catch (error) {
    console.error("[onboarding]", error instanceof Error ? error.message : error);
    return { status: "error", message: "Plán sa nepodarilo uložiť. Skús to znova." };
  }
}

/** Preskočenie kvízu: dashboard ho už nevynúti, checklist ostáva. */
export async function skipOnboarding(): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/prihlasenie?next=/app");
  await completeOnboarding(user.id, { answers: null });
  revalidatePath("/app", "layout");
  redirect("/app");
}
