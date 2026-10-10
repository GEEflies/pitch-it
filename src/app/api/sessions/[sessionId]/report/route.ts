import { after } from "next/server";
import { getOwnedSession, getReport, updateReport } from "@/lib/db/sessions";
import { apiError, apiOk, handleRouteError, isUuid, rateLimited, requireApiUser } from "@/lib/http/route";
import { generateReportSafely } from "@/lib/reports/generate";
import { RATE_LIMITS } from "@/lib/security/rate-limit";

export const maxDuration = 300;

/** Stav reportu (polling zo stránky reportu). */
export async function GET(_request: Request, { params }: RouteContext<"/api/sessions/[sessionId]/report">) {
  const user = await requireApiUser();
  if (user instanceof Response) return user;
  const { sessionId } = await params;
  if (!isUuid(sessionId)) return apiError(404, "not_found", "Tréning neexistuje.");
  try {
    const report = await getReport(sessionId);
    return apiOk({ status: report?.status ?? null });
  } catch (error) {
    return handleRouteError(error, "reports.status");
  }
}

/** Znova spustí generovanie reportu, ak predtým zlyhalo. */
export async function POST(_request: Request, { params }: RouteContext<"/api/sessions/[sessionId]/report">) {
  const user = await requireApiUser();
  if (user instanceof Response) return user;
  const { sessionId } = await params;
  if (!isUuid(sessionId)) return apiError(404, "not_found", "Tréning neexistuje.");
  const limited = rateLimited(user.id, "report", RATE_LIMITS.report);
  if (limited) return limited;

  try {
    const session = await getOwnedSession(sessionId, user.id);
    const report = await getReport(sessionId);
    if (session.status !== "completed" || !report) return apiError(409, "not_ready", "Tréning ešte nie je ukončený.");
    if (report.status !== "failed" && report.status !== "not_configured") {
      return apiError(409, "not_retryable", "Report sa už pripravuje alebo je hotový.");
    }
    await updateReport(sessionId, { status: "pending", error_code: null, attempts: report.attempts + 1 });
    after(() => generateReportSafely(sessionId));
    return apiOk({ status: "pending" });
  } catch (error) {
    return handleRouteError(error, "reports.retry");
  }
}
