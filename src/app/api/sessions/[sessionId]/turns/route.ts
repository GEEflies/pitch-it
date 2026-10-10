import { apiError, apiOk, handleRouteError, isUuid, parseJson, requireApiUser } from "@/lib/http/route";
import { recordTurns } from "@/lib/session/service";
import { turnsRequestSchema } from "@/lib/validation/schemas";

/** Uloží dokončené ťahy rozhovoru (idempotentne podľa poradového čísla). */
export async function POST(request: Request, { params }: RouteContext<"/api/sessions/[sessionId]/turns">) {
  const user = await requireApiUser();
  if (user instanceof Response) return user;
  const { sessionId } = await params;
  if (!isUuid(sessionId)) return apiError(404, "not_found", "Tréning neexistuje.");

  const body = await parseJson(request, turnsRequestSchema);
  if (body instanceof Response) return body;

  try {
    await recordTurns(user.id, sessionId, body.turns);
    return apiOk({ saved: body.turns.map((turn) => turn.seq) });
  } catch (error) {
    return handleRouteError(error, "sessions.turns");
  }
}
