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
      checklist={[
        { key: "profile", title: "Nastav si plán tréningu", detail: "", href: "/app/vitaj", done: true },
        { key: "project", title: "Opíš svoj startup", detail: "", href: "/app/projekty", done: true },
        { key: "deck", title: "Nahraj pitch deck", detail: "PDF alebo PPTX. Vytiahneme z neho čísla a fakty, na ktoré sa investor opýta.", href: "/app/projekty", done: false },
        { key: "session", title: "Absolvuj prvý tréning", detail: "Hlasový rozhovor so simulovaným investorom.", href: "/app/trening/novy", done: false },
        { key: "report", title: "Prejdi si rozbor", detail: "Merania, citácie slabých miest a cvičenia na zlepšenie.", href: "/app/historia", done: false },
      ]}
      href={previewHref}
    />
  );
}
