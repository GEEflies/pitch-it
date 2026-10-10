import { connection } from "next/server";
import { DashboardView } from "@/components/dashboard/dashboard-view";
import { previewDashboard } from "@/lib/preview/dashboard";
import { previewHref } from "@/lib/preview/links";

// Ukážkové dáta sú relatívne k času požiadavky.
export const instant = false;

export default async function PreviewDashboard() {
  await connection();
  return <DashboardView {...previewDashboard(new Date())} href={previewHref} />;
}
