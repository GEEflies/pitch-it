import { apiError, apiOk, handleRouteError, isUuid, parseJson, rateLimited, requireApiUser } from "@/lib/http/route";
import { RATE_LIMITS } from "@/lib/security/rate-limit";
import { generateHint } from "@/lib/session/service";
import { hintRequestSchema } from "@/lib/validation/schemas";

export const maxDuration = 60;

/** Nápoveda k aktuálnej otázke investora (režim tréningu). */
export async function POST(request: Request, { params }: RouteContext<"/api/sessions/[sessionId]/hint">) {
  const user = await requireApiUser();
  if (user instanceof Response) return user;
  const { sessionId } = await params;
  if (!isUuid(sessionId)) return apiError(404, "not_found", "Tréning neexistuje.");

  const limited = rateLimited(user.id, "hint", RATE_LIMITS.hint);
  if (limited) return limited;
  const body = await parseJson(request, hintRequestSchema);
  if (body instanceof Response) return body;

  try {
    return apiOk({ hint: await generateHint(user.id, sessionId, body.question) });
  } catch (error) {
    return handleRouteError(error, "sessions.hint");
  }
}
