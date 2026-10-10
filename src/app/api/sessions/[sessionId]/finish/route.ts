import { after } from "next/server";
import { apiError, apiOk, handleRouteError, isUuid, parseJson, requireApiUser } from "@/lib/http/route";
import { generateReportSafely } from "@/lib/reports/generate";
import { finishTraining } from "@/lib/session/service";
import { finishRequestSchema } from "@/lib/validation/schemas";

export const maxDuration = 300;

/** Ukončí tréning, vyúčtuje čas a na pozadí pripraví report. */
export async function POST(request: Request, { params }: RouteContext<"/api/sessions/[sessionId]/finish">) {
  const user = await requireApiUser();
  if (user instanceof Response) return user;
  const { sessionId } = await params;
  if (!isUuid(sessionId)) return apiError(404, "not_found", "Tréning neexistuje.");

  const body = await parseJson(request, finishRequestSchema);
  if (body instanceof Response) return body;

  try {
    const outcome = await finishTraining(user.id, sessionId, body);
    if (outcome.reportQueued) after(() => generateReportSafely(sessionId));
    return apiOk({ status: outcome.session.status, reportUrl: `/app/trening/${sessionId}` });
  } catch (error) {
    return handleRouteError(error, "sessions.finish");
  }
}
