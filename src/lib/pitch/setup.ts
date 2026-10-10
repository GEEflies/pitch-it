import "server-only";

import { getProfile } from "@/lib/db/profile";
import { readAnswers } from "@/lib/onboarding/plan";

/** Nastavenie nahrávania z odpovedí v onboardingu (publikum, dĺžka, čo ukázať najprv). */
export async function loadPitchSetup(userId: string) {
  const profile = await getProfile(userId);
  const answers = readAnswers(profile?.onboarding_answers);
  return {
    setup: { audience: answers.audience, targetSeconds: answers.lengthSeconds, focus: answers.focus } as const,
    notes: profile?.pitch_notes ?? null,
    accountType: profile?.account_type ?? "participant",
  };
}
