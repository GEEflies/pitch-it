import { z } from "zod";
import { prepareUpload } from "@/lib/documents/service";
import { apiError, apiOk, handleRouteError, isUuid, parseJson, rateLimited, requireApiUser } from "@/lib/http/route";
import { RATE_LIMITS } from "@/lib/security/rate-limit";

const bodySchema = z.object({
  fileName: z.string().min(1).max(300),
  size: z.number().int().positive(),
  sha256: z.string().length(64),
});

/** Založí záznam podkladu a vráti podpísaný upload do súkromného úložiska. */
export async function POST(request: Request, { params }: RouteContext<"/api/projects/[projectId]/documents">) {
  const user = await requireApiUser();
  if (user instanceof Response) return user;
  const { projectId } = await params;
  if (!isUuid(projectId)) return apiError(404, "not_found", "Projekt neexistuje.");

  const limited = rateLimited(user.id, "upload", RATE_LIMITS.upload);
  if (limited) return limited;

  const body = await parseJson(request, bodySchema);
  if (body instanceof Response) return body;

  try {
    return apiOk(await prepareUpload(user.id, projectId, body), 201);
  } catch (error) {
    return handleRouteError(error, "documents.prepare");
  }
}
