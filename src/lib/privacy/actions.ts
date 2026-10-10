"use server";

import { getCurrentUser } from "@/lib/auth/session";
import { recordConsent } from "@/lib/db/profile";
import { MEDIA_CONSENT_VERSION } from "@/lib/privacy/consent-texts";

/** Zapíše súhlas s mikrofónom alebo kamerou (append-only log). */
export async function recordMediaConsentAction(
  kind: "microphone_processing" | "camera_analysis",
  granted: boolean,
): Promise<{ ok: boolean }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false };
  if (kind !== "microphone_processing" && kind !== "camera_analysis") return { ok: false };
  try {
    await recordConsent(user.id, kind, granted, MEDIA_CONSENT_VERSION);
    return { ok: true };
  } catch (error) {
    console.error("[consents]", error instanceof Error ? error.message : error);
    return { ok: false };
  }
}
