import type { TrainingMode } from "@/lib/domain/labels";
import { formatNumericDate } from "@/lib/format";

/*
  Upozornenia v hornej lište: hotové rozbory a nové cvičenia z nich.
  Čo už používateľ videl, si pamätá prehliadač (časová značka), nie server.
*/

export type NotificationItem = {
  id: string;
  kind: "report" | "exercise";
  title: string;
  detail: string;
  at: string;
  href: string;
};

const MODE_NAMES: Record<TrainingMode, string> = {
  coach: "Tréning s nápovedou",
  simulation: "AI investor simulácia",
  delivery: "Tréning pitchu",
};

export function buildNotifications(
  sessions: Array<{ id: string; mode: TrainingMode; created_at: string; feedback_reports: { status: string; completed_at: string | null } | null }>,
  exercises: Array<{ id: string; title: string; created_at: string }>,
  limit = 6,
): NotificationItem[] {
  const items: NotificationItem[] = [];
  for (const session of sessions) {
    const report = session.feedback_reports;
    if (report?.status !== "ready") continue;
    const at = report.completed_at ?? session.created_at;
    items.push({
      id: `report-${session.id}`,
      kind: "report",
      title: "Rozbor je pripravený",
      detail: `${MODE_NAMES[session.mode]} · ${formatNumericDate(session.created_at)}`,
      at,
      href: `/app/trening/${session.id}`,
    });
  }
  for (const exercise of exercises) {
    items.push({
      id: `exercise-${exercise.id}`,
      kind: "exercise",
      title: "Nové cvičenie z rozboru",
      detail: exercise.title,
      at: exercise.created_at,
      href: `/app/cvicenia/${exercise.id}`,
    });
  }
  return items.sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit);
}
