import { DashboardView } from "@/components/app/dashboard-view";
import { PREVIEW_BILLING, PREVIEW_DASHBOARD_SESSIONS, PREVIEW_EXERCISES, PREVIEW_RECOMMENDATION } from "@/lib/preview/fixtures";
import { previewHref } from "@/lib/preview/links";

export default function PreviewDashboard() {
  return (
    <DashboardView
      name="Jana"
      recommendation={PREVIEW_RECOMMENDATION}
      sessions={PREVIEW_DASHBOARD_SESSIONS}
      exercises={PREVIEW_EXERCISES}
      billing={PREVIEW_BILLING}
      href={previewHref}
    />
  );
}
