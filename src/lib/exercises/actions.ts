"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { createLibraryExercise, deleteExercise, setExerciseStatus } from "@/lib/db/exercises";
import { getProject } from "@/lib/db/projects";
import { findTemplate } from "@/lib/exercises/catalog";
import type { FormState } from "@/lib/projects/actions";
import { isUuid } from "@/lib/validation/ids";

/** Spustí cvičenie z knižnice. Mini simulácia a prednes pokračujú cez nastavenie tréningu. */
export async function startLibraryExerciseAction(templateKey: string, projectId: string | null): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return { status: "error", message: "Relácia vypršala. Prihlás sa znova." };
  const template = findTemplate(templateKey);
  if (!template) return { status: "error", message: "Cvičenie neexistuje." };

  const project = isUuid(projectId) ? await getProject(projectId) : null;
  let exerciseId: string;
  try {
    const exercise = await createLibraryExercise(user.id, project?.id ?? null, project?.name ?? null, template);
    exerciseId = exercise.id;
  } catch (error) {
    console.error("[exercises] start:", error instanceof Error ? error.message : error);
    return { status: "error", message: "Cvičenie sa nepodarilo pripraviť." };
  }

  if (template.simulation) {
    const params = new URLSearchParams({
      rezim: template.kind === "pitch_timed" ? "delivery" : "coach",
      investor: template.simulation.investorKey,
      scenar: template.simulation.scenarioKey,
      cvicenie: exerciseId,
    });
    if (project) params.set("projekt", project.id);
    redirect(`/app/trening/novy?${params.toString()}`);
  }
  redirect(`/app/cvicenia/${exerciseId}`);
}

export async function setExerciseStatusAction(exerciseId: string, status: "open" | "completed" | "dismissed"): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return { status: "error", message: "Relácia vypršala. Prihlás sa znova." };
  try {
    await setExerciseStatus(exerciseId, status);
  } catch {
    return { status: "error", message: "Stav sa nepodarilo zmeniť." };
  }
  revalidatePath("/app/cvicenia");
  revalidatePath(`/app/cvicenia/${exerciseId}`);
  return { status: "success", message: status === "completed" ? "Cvičenie je hotové." : status === "dismissed" ? "Cvičenie je skryté." : "Cvičenie je znova otvorené." };
}

export async function deleteExerciseAction(exerciseId: string): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return { status: "error", message: "Relácia vypršala. Prihlás sa znova." };
  try {
    await deleteExercise(exerciseId);
  } catch {
    return { status: "error", message: "Cvičenie sa nepodarilo zmazať." };
  }
  redirect("/app/cvicenia");
}
