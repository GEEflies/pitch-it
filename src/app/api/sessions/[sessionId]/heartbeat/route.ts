import { apiError, apiOk, handleRouteError, isUuid, requireApiUser } from "@/lib/http/route";
import { heartbeat } from "@/lib/session/service";

/** Signál, že relácia stále beží (účtovanie a uzatváranie opustených relácií). */
export async function POST(_request: Request, { params }: RouteContext<"/api/sessions/[sessionId]/heartbeat">) {
  const user = await requireApiUser();
  if (user instanceof Response) return user;
  const { sessionId } = await params;
  if (!isUuid(sessionId)) return apiError(404, "not_found", "Tréning neexistuje.");
  try {
    await heartbeat(user.id, sessionId);
    return apiOk({ ok: true });
  } catch (error) {
    return handleRouteError(error, "sessions.heartbeat");
  }
}
