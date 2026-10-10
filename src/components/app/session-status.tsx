import type { ReportStatus } from "@/lib/db/types";
import type { SessionStatus } from "@/lib/domain/labels";

const SESSION_STYLE: Record<SessionStatus, { label: string; className: string }> = {
  ready: { label: "Pripravený", className: "text-mute" },
  live: { label: "Prebieha", className: "text-signal-soft" },
  completed: { label: "Dokončený", className: "text-paper/80" },
  abandoned: { label: "Prerušený", className: "text-marker" },
  failed: { label: "Zlyhal", className: "text-coral" },
};

const REPORT_STYLE: Record<ReportStatus, { label: string; className: string }> = {
  pending: { label: "Rozbor čaká", className: "text-mute" },
  generating: { label: "Rozbor sa pripravuje", className: "text-signal-soft" },
  ready: { label: "Rozbor hotový", className: "text-mint" },
  failed: { label: "Rozbor zlyhal", className: "text-coral" },
  insufficient_data: { label: "Málo dát na rozbor", className: "text-marker" },
  not_configured: { label: "Iba merania", className: "text-mute" },
};

export function SessionStatusText({ status, report }: { status: SessionStatus; report: ReportStatus | null }) {
  if (status === "completed" && report) {
    const meta = REPORT_STYLE[report];
    return <span className={meta.className}>{meta.label}</span>;
  }
  const meta = SESSION_STYLE[status];
  return <span className={meta.className}>{meta.label}</span>;
}
