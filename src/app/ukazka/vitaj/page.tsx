import type { Metadata } from "next";
import { OnboardingQuiz } from "@/components/onboarding/onboarding-quiz";

export const metadata: Metadata = { title: "Úvodný kvíz" };

export default function PreviewWelcome() {
  return <OnboardingQuiz preview previewHref="/ukazka/nahravka/kamera" />;
}
