import { apiError, apiOk, handleRouteError, isUuid, parseJson, rateLimited, requireApiUser } from "@/lib/http/route";
import { RATE_LIMITS } from "@/lib/security/rate-limit";
import { connectRealtime } from "@/lib/session/service";
import { connectRequestSchema } from "@/lib/validation/schemas";

/** Vydá krátkodobý token na realtime spojenie (po overení vlastníctva a limitov). */
export async function POST(request: Request, { params }: RouteContext<"/api/sessions/[sessionId]/connect">) {
  const user = await requireApiUser();
  if (user instanceof Response) return user;
  const { sessionId } = await params;
  if (!isUuid(sessionId)) return apiError(404, "not_found", "Tréning neexistuje.");

  const limited = rateLimited(user.id, "connect", RATE_LIMITS.realtimeConnect);
  if (limited) return limited;
  const body = await parseJson(request, connectRequestSchema);
  if (body instanceof Response) return body;

  try {
    return apiOk(await connectRealtime(user.id, sessionId, body.resume));
  } catch (error) {
    return handleRouteError(error, "sessions.connect");
  }
}
