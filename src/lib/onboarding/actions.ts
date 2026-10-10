"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { completeOnboarding } from "@/lib/db/profile";
import { trackEvent } from "@/lib/events/track";
import { ANSWERS_VERSION, onboardingSubmissionSchema } from "@/lib/onboarding/plan";

export type OnboardingResult = { status: "ok" } | { status: "error"; message: string };

/** Uloží tri odpovede z kvízu a voliteľné poznámky k pitchu. */
export async function submitOnboarding(input: unknown): Promise<OnboardingResult> {
  const user = await getCurrentUser();
  if (!user) return { status: "error", message: "Relácia vypršala. Prihlás sa znova." };

  const parsed = onboardingSubmissionSchema.safeParse(input);
  if (!parsed.success) return { status: "error", message: "Niektorá odpoveď chýba. Vráť sa a doplň ju." };
  const { notes, ...answers } = parsed.data;

  try {
    await completeOnboarding(user.id, {
      answers: { version: ANSWERS_VERSION, ...answers },
      notes: notes || null,
    });
    await trackEvent(user.id, "onboarding_completed", {
      audience: answers.audience,
      length: answers.lengthSeconds,
      focus: answers.focus,
      notes: Boolean(notes),
    });
    revalidatePath("/app", "layout");
    return { status: "ok" };
  } catch (error) {
    console.error("[onboarding]", error instanceof Error ? error.message : error);
    return { status: "error", message: "Plán sa nepodarilo uložiť. Skús to znova." };
  }
}

/** Preskočenie kvízu: použijú sa predvolené nastavenia. */
export async function skipOnboarding(): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/prihlasenie?next=/app");
  await completeOnboarding(user.id, { answers: null });
  revalidatePath("/app", "layout");
  redirect("/app");
}
