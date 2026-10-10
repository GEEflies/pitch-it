"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { DbError } from "@/lib/db/core";
import { removeProjectFiles } from "@/lib/documents/storage";
import {
  countOwnedProjects,
  createProject,
  createUserFact,
  deleteFact,
  deleteProject,
  reviewFact,
  setIssueStatus,
  updateProject,
} from "@/lib/db/projects";
import { getBillingContext } from "@/lib/db/usage";
import { trackEvent } from "@/lib/events/track";
import {
  factReviewSchema,
  factSchema,
  fieldErrors,
  issueStatusSchema,
  projectSchema,
} from "@/lib/validation/schemas";

export type FormState = {
  status: "idle" | "error" | "success";
  message?: string;
  fieldErrors?: Record<string, string>;
};

const SIGNED_OUT: FormState = { status: "error", message: "Relácia vypršala. Prihlás sa znova." };

function formObject(formData: FormData): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of formData.entries()) if (typeof value === "string") result[key] = value;
  return result;
}

function failure(error: unknown, fallback: string): FormState {
  if (error instanceof DbError && (error.code === "forbidden" || error.code === "not_found")) {
    return { status: "error", message: error.message };
  }
  console.error("[projects]", error instanceof Error ? error.message : error);
  return { status: "error", message: fallback };
}

export async function createProjectAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return SIGNED_OUT;

  const parsed = projectSchema.safeParse(formObject(formData));
  if (!parsed.success) {
    return { status: "error", message: "Skontroluj zvýraznené polia.", fieldErrors: fieldErrors(parsed.error) };
  }

  let projectId: string;
  try {
    const [billing, owned] = await Promise.all([getBillingContext(user.id), countOwnedProjects(user.id)]);
    if (owned >= billing.plan.limits.projects) {
      return {
        status: "error",
        message: `V pláne ${billing.plan.name} môžeš mať najviac ${billing.plan.limits.projects} ${billing.plan.limits.projects === 1 ? "projekt" : "projektov"}. Uprav existujúci projekt alebo prejdi na vyšší plán.`,
      };
    }
    const project = await createProject(user.id, parsed.data);
    projectId = project.id;
    await trackEvent(user.id, "project_created", { stage: parsed.data.stage, first: owned === 0 });
    if (owned === 0) await trackEvent(user.id, "onboarding_completed", {});
  } catch (error) {
    return failure(error, "Projekt sa nepodarilo uložiť. Skús to znova.");
  }
  redirect(`/app/projekty/${projectId}/podklady?novy=1`);
}

export async function updateProjectAction(projectId: string, _previous: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return SIGNED_OUT;
  const parsed = projectSchema.safeParse(formObject(formData));
  if (!parsed.success) {
    return { status: "error", message: "Skontroluj zvýraznené polia.", fieldErrors: fieldErrors(parsed.error) };
  }
  try {
    await updateProject(projectId, parsed.data);
  } catch (error) {
    return failure(error, "Zmeny sa nepodarilo uložiť. Skús to znova.");
  }
  revalidatePath(`/app/projekty/${projectId}`);
  return { status: "success", message: "Profil startupu je uložený." };
}

export async function deleteProjectAction(projectId: string): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return SIGNED_OUT;
  try {
    await removeProjectFiles(projectId);
    await deleteProject(projectId);
  } catch (error) {
    return failure(error, "Projekt sa nepodarilo zmazať.");
  }
  redirect("/app/projekty?zmazany=1");
}

export async function addFactAction(projectId: string, _previous: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return SIGNED_OUT;
  const parsed = factSchema.safeParse(formObject(formData));
  if (!parsed.success) {
    return { status: "error", message: "Skontroluj zvýraznené polia.", fieldErrors: fieldErrors(parsed.error) };
  }
  try {
    await createUserFact(projectId, parsed.data);
  } catch (error) {
    return failure(error, "Údaj sa nepodarilo uložiť.");
  }
  revalidatePath(`/app/projekty/${projectId}/podklady`);
  return { status: "success", message: "Údaj je pridaný." };
}

export async function reviewFactAction(projectId: string, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return SIGNED_OUT;
  const parsed = factReviewSchema.safeParse(formObject(formData));
  if (!parsed.success) return { status: "error", message: "Neplatná požiadavka." };
  try {
    await reviewFact(parsed.data.factId, parsed.data.decision, parsed.data.corrected_value);
  } catch (error) {
    return failure(error, "Údaj sa nepodarilo upraviť.");
  }
  revalidatePath(`/app/projekty/${projectId}/podklady`);
  return {
    status: "success",
    message: parsed.data.decision === "reject" ? "Údaj je zamietnutý." : "Údaj je potvrdený.",
  };
}

export async function deleteFactAction(projectId: string, factId: string): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return SIGNED_OUT;
  try {
    await deleteFact(factId);
  } catch (error) {
    return failure(error, "Údaj sa nepodarilo zmazať.");
  }
  revalidatePath(`/app/projekty/${projectId}/podklady`);
  return { status: "success", message: "Údaj je zmazaný." };
}

export async function setIssueStatusAction(projectId: string, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return SIGNED_OUT;
  const parsed = issueStatusSchema.safeParse(formObject(formData));
  if (!parsed.success) return { status: "error", message: "Neplatná požiadavka." };
  try {
    await setIssueStatus(parsed.data.issueId, parsed.data.status);
  } catch (error) {
    return failure(error, "Stav sa nepodarilo zmeniť.");
  }
  revalidatePath(`/app/projekty/${projectId}/podklady`);
  return { status: "success", message: parsed.data.status === "open" ? "Problém je znova otvorený." : "Problém je vyriešený." };
}
