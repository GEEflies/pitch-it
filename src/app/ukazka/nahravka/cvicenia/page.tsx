import type { Metadata } from "next";
import { DrillScreen } from "@/components/coach/drill-screen";

export const metadata: Metadata = { title: "Cvičenia reči tela" };

export default function PreviewDrills() {
  return <DrillScreen backHref="/ukazka/nahravka" />;
}
