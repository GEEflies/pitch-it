"use server";

import { redirect } from "next/navigation";
import { checkEntitlement } from "@/lib/billing/plans";
import { getCurrentUser } from "@/lib/auth/session";
import { getExercise } from "@/lib/db/exercises";
import { getProject } from "@/lib/db/projects";
import { createSession, deleteSession, findOwnedSession } from "@/lib/db/sessions";
import { getBillingContext } from "@/lib/db/usage";
import { INVESTOR_STYLES, SCENARIOS } from "@/lib/investor/catalog";
import { configSnapshot } from "@/lib/investor/instructions";
import type { FormState } from "@/lib/projects/actions";
import { createSessionSchema } from "@/lib/validation/schemas";

function bool(formData: FormData, name: string): boolean {
  const value = formData.get(name);
  return value === "on" || value === "true";
}

function str(formData: FormData, name: string): string | null {
  const value = formData.get(name);
  return typeof value === "string" && value.length > 0 ? value : null;
}

export async function createTrainingSessionAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return { status: "error", message: "Relácia vypršala. Prihlás sa znova." };

  const parsed = createSessionSchema.safeParse({
    projectId: str(formData, "projectId"),
    mode: str(formData, "mode"),
    investorKey: str(formData, "investorKey") ?? "generalist",
    scenarioKey: str(formData, "scenarioKey"),
    durationMinutes: str(formData, "durationMinutes"),
    cameraEnabled: bool(formData, "cameraEnabled"),
    coachFocus: formData.getAll("coachFocus").filter((value): value is string => typeof value === "string"),
    transport: str(formData, "transport") ?? "realtime",
    exerciseId: str(formData, "exerciseId"),
    previousSessionId: str(formData, "previousSessionId"),
  });
  if (!parsed.success) return { status: "error", message: "Vyber projekt, režim a scenár." };
  const input = parsed.data;

  const scenario = SCENARIOS[input.scenarioKey];
  if (!scenario.modes.includes(input.mode)) {
    return { status: "error", message: "Tento scenár sa nehodí k zvolenému režimu." };
  }
  if (!scenario.allowedMinutes.includes(input.durationMinutes)) {
    return { status: "error", message: "Vyber dĺžku z ponúkaných možností." };
  }
  if (input.mode === "delivery" && input.transport === "text") {
    return { status: "error", message: "Prednes pitchu potrebuje mikrofón." };
  }

  let sessionId: string;
  try {
    const project = await getProject(input.projectId);
    if (!project) return { status: "error", message: "Projekt neexistuje alebo k nemu nemáš prístup." };

    // Nadväzujúce odkazy musia patriť používateľovi.
    const previous = input.previousSessionId ? await findOwnedSession(input.previousSessionId, user.id) : null;
    const exercise = input.exerciseId ? await getExercise(input.exerciseId) : null;

    const billing = await getBillingContext(user.id);
    if (input.transport === "realtime") {
      const entitlement = checkEntitlement(billing.plan, billing.usage, "realtime_seconds");
      if (!entitlement.allowed) {
        return {
          status: "error",
          message: "Minúty hlasového tréningu sú na tento mesiac vyčerpané. Môžeš trénovať v textovom režime.",
        };
      }
    } else if (!checkEntitlement(billing.plan, billing.usage, "text_turn").allowed) {
      return { status: "error", message: "Limit textových tréningov je na tento mesiac vyčerpaný." };
    }

    const minutes = Math.min(input.durationMinutes, billing.plan.limits.maxSessionMinutes);
    const style = INVESTOR_STYLES[input.mode === "delivery" ? "generalist" : input.investorKey];
    const session = await createSession({
      userId: user.id,
      projectId: project.id,
      mode: input.mode,
      investorKey: style.key,
      scenarioKey: scenario.key,
      targetDurationSeconds: minutes * 60,
      cameraEnabled: input.cameraEnabled,
      coachFocus: input.mode === "coach" ? input.coachFocus : [],
      transport: input.transport,
      exerciseId: exercise?.id ?? null,
      previousSessionId: previous?.id ?? null,
      configSnapshot: configSnapshot({ style, scenario, mode: input.mode, durationMinutes: minutes }),
    });
    sessionId = session.id;
  } catch (error) {
    console.error("[sessions] create:", error instanceof Error ? error.message : error);
    return { status: "error", message: "Tréning sa nepodarilo pripraviť. Skús to znova." };
  }

  redirect(`/app/miestnost/${sessionId}`);
}

export async function deleteSessionAction(sessionId: string): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return { status: "error", message: "Relácia vypršala. Prihlás sa znova." };
  try {
    await deleteSession(sessionId);
  } catch (error) {
    console.error("[sessions] delete:", error instanceof Error ? error.message : error);
    return { status: "error", message: "Tréning sa nepodarilo zmazať. Prebiehajúci tréning najprv ukonči." };
  }
  redirect("/app/historia?zmazany=1");
}
