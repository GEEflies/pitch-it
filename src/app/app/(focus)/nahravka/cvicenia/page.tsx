import type { Metadata } from "next";
import { DrillScreen } from "@/components/coach/drill-screen";
import { requireUser } from "@/lib/auth/session";

export const instant = false;

export const metadata: Metadata = { title: "Cvičenia reči tela" };

export default async function DrillsPage() {
  await requireUser("/app/nahravka/cvicenia");
  return <DrillScreen backHref="/app/nahravka" />;
}
