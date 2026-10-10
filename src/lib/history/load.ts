import "server-only";

import type { SessionWithReport } from "@/lib/db/sessions";
import type { ComparableSession } from "@/lib/history/compare";
import { assessmentSchema } from "@/lib/reports/assessment";
import type { SessionMeasurements } from "@/lib/reports/measured";

/** Riadok z databázy → tvar pre porovnanie (s validáciou uloženého hodnotenia). */
export function toComparable(session: SessionWithReport): ComparableSession {
  const report = session.feedback_reports;
  const measured =
    report?.measured && Object.keys(report.measured).length > 0 ? (report.measured as unknown as SessionMeasurements) : null;
  const parsed = report?.assessment ? assessmentSchema.safeParse(report.assessment) : null;
  return {
    id: session.id,
    mode: session.mode,
    transport: session.transport,
    createdAt: session.created_at,
    measured,
    assessment: parsed?.success ? parsed.data : null,
  };
}
