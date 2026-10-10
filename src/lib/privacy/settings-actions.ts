"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { recordConsent, updateProfileAndSettings, type ConsentKind } from "@/lib/db/profile";
import { LEGAL_VERSION } from "@/lib/auth/schemas";
import { MEDIA_CONSENT_VERSION } from "@/lib/privacy/consent-texts";
import { deleteAccount, deleteAllSessions } from "@/lib/privacy/account";
import type { FormState } from "@/lib/projects/actions";
import { endSession } from "@/lib/auth/accounts";
import { fieldErrors, settingsSchema } from "@/lib/validation/schemas";

const SIGNED_OUT: FormState = { status: "error", message: "Relácia vypršala. Prihlás sa znova." };

export async function saveSettingsAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return SIGNED_OUT;
  const parsed = settingsSchema.safeParse({
    display_name: formData.get("display_name") ?? "",
    default_mode: formData.get("default_mode"),
    coach_focus: formData.getAll("coach_focus"),
    data_retention_days: formData.get("data_retention_days"),
  });
  if (!parsed.success) return { status: "error", message: "Skontroluj zvýraznené polia.", fieldErrors: fieldErrors(parsed.error) };
  try {
    await updateProfileAndSettings(user.id, parsed.data);
  } catch (error) {
    console.error("[settings]", error instanceof Error ? error.message : error);
    return { status: "error", message: "Nastavenia sa nepodarilo uložiť." };
  }
  revalidatePath("/app/nastavenia");
  return { status: "success", message: "Nastavenia sú uložené." };
}

const REVOCABLE: ConsentKind[] = ["microphone_processing", "camera_analysis", "product_emails"];

export async function setConsentAction(kind: ConsentKind, granted: boolean): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return SIGNED_OUT;
  if (!REVOCABLE.includes(kind)) return { status: "error", message: "Tento súhlas sa nedá meniť tu." };
  try {
    await recordConsent(user.id, kind, granted, kind === "product_emails" ? LEGAL_VERSION : MEDIA_CONSENT_VERSION);
  } catch {
    return { status: "error", message: "Súhlas sa nepodarilo uložiť." };
  }
  revalidatePath("/app/nastavenia");
  return { status: "success", message: granted ? "Súhlas je udelený." : "Súhlas je odvolaný." };
}

export async function deleteAllSessionsAction(): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return SIGNED_OUT;
  try {
    const count = await deleteAllSessions(user.id);
    revalidatePath("/app", "layout");
    return { status: "success", message: count > 0 ? `Zmazali sme ${count} tréningov.` : "Nemáš žiadne tréningy na zmazanie." };
  } catch {
    return { status: "error", message: "Tréningy sa nepodarilo zmazať." };
  }
}

export async function deleteAccountAction(): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return SIGNED_OUT;
  try {
    await deleteAccount(user.id);
    await endSession();
  } catch (error) {
    console.error("[account] mazanie zlyhalo:", error instanceof Error ? error.message : error);
    return { status: "error", message: "Účet sa nepodarilo zmazať. Napíš nám a vybavíme to ručne." };
  }
  redirect("/?ucet=zmazany");
}
