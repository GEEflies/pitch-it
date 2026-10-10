import "server-only";

import type { DashboardExercise, DashboardSession } from "@/lib/dashboard/overview";
import type { DashboardSessionRow } from "@/lib/db/sessions";
import type { ExerciseRow } from "@/lib/db/types";
import { assessmentSchema } from "@/lib/reports/assessment";
import type { SessionMeasurements } from "@/lib/reports/measured";

/** Riadok z databázy → tvar pre prehľad (uložené hodnotenie sa validuje rovnako ako v histórii). */
export function toDashboardSession(row: DashboardSessionRow): DashboardSession {
  const report = row.feedback_reports;
  const measured =
    report?.measured && Object.keys(report.measured).length > 0 ? (report.measured as unknown as SessionMeasurements) : null;
  const parsed = report?.assessment ? assessmentSchema.safeParse(report.assessment) : null;
  return {
    id: row.id,
    mode: row.mode,
    transport: row.transport,
    status: row.status,
    createdAt: row.created_at,
    endedAt: row.ended_at,
    billedSeconds: row.billed_seconds,
    report: report
      ? { status: report.status, completedAt: report.completed_at, measured, assessment: parsed?.success ? parsed.data : null }
      : null,
  };
}

export function toDashboardExercise(row: Pick<ExerciseRow, "id" | "title" | "status" | "completed_at">): DashboardExercise {
  return { id: row.id, title: row.title, status: row.status, completedAt: row.completed_at };
}
