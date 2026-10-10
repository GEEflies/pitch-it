import { apiError, apiOk, handleRouteError, isUuid, parseJson, rateLimited, requireApiUser } from "@/lib/http/route";
import { RATE_LIMITS } from "@/lib/security/rate-limit";
import { textTurn } from "@/lib/session/service";
import { textTurnRequestSchema } from "@/lib/validation/schemas";

export const maxDuration = 60;

/** Textový režim: odpoveď foundera → replika investora. */
export async function POST(request: Request, { params }: RouteContext<"/api/sessions/[sessionId]/text-turn">) {
  const user = await requireApiUser();
  if (user instanceof Response) return user;
  const { sessionId } = await params;
  if (!isUuid(sessionId)) return apiError(404, "not_found", "Tréning neexistuje.");

  const limited = rateLimited(user.id, "text-turn", RATE_LIMITS.textTurn);
  if (limited) return limited;
  const body = await parseJson(request, textTurnRequestSchema);
  if (body instanceof Response) return body;

  try {
    return apiOk(await textTurn(user.id, sessionId, body.message));
  } catch (error) {
    return handleRouteError(error, "sessions.textTurn");
  }
}
