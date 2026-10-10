import type { ReactNode } from "react";
import { Suspense } from "react";

/** Layout pre úvodný kvíz: kým sa overí relácia, ostane len tiché pozadie (žiadny spinner ani text). */
export default function OnboardingLayout({ children }: { children: ReactNode }) {
  return <Suspense fallback={<div className="min-h-dvh" aria-busy="true" />}>{children}</Suspense>;
}
