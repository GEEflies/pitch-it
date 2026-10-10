import type { Metadata } from "next";
import { OnboardingQuiz } from "@/components/onboarding/onboarding-quiz";
import { PLANS } from "@/lib/billing/plans";

export const metadata: Metadata = { title: "Úvodný kvíz" };

export default function PreviewWelcome() {
  return <OnboardingQuiz preview freeMinutes={PLANS.free.limits.realtimeMinutes} />;
}
