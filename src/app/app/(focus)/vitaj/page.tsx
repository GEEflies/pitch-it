import type { Metadata } from "next";
import { OnboardingQuiz } from "@/components/onboarding/onboarding-quiz";
import { requireUser } from "@/lib/auth/session";

// Stránka závisí od relácie používateľa: navigácia smie počkať na server.
export const instant = false;

export const metadata: Metadata = { title: "Vitaj" };

export default async function WelcomePage() {
  await requireUser("/app/vitaj");
  return <OnboardingQuiz />;
}
