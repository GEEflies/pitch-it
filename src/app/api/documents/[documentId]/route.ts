import { after } from "next/server";
import { analyzeDocument, deleteDocument, requestReanalysis } from "@/lib/documents/service";
import { apiError, apiOk, handleRouteError, isUuid, rateLimited, requireApiUser } from "@/lib/http/route";
import { RATE_LIMITS } from "@/lib/security/rate-limit";

export const maxDuration = 300;

/** Znova spustí AI analýzu podkladu. */
export async function POST(_request: Request, { params }: RouteContext<"/api/documents/[documentId]">) {
  const user = await requireApiUser();
  if (user instanceof Response) return user;
  const { documentId } = await params;
  if (!isUuid(documentId)) return apiError(404, "not_found", "Podklad neexistuje.");
  const limited = rateLimited(user.id, "upload", RATE_LIMITS.upload);
  if (limited) return limited;

  try {
    const document = await requestReanalysis(documentId);
    after(() => analyzeDocument(document.id, user.id));
    return apiOk({ status: "analyzing" });
  } catch (error) {
    return handleRouteError(error, "documents.reanalyze");
  }
}

export async function DELETE(_request: Request, { params }: RouteContext<"/api/documents/[documentId]">) {
  const user = await requireApiUser();
  if (user instanceof Response) return user;
  const { documentId } = await params;
  if (!isUuid(documentId)) return apiError(404, "not_found", "Podklad neexistuje.");

  try {
    await deleteDocument(documentId);
    return apiOk({ deleted: true });
  } catch (error) {
    return handleRouteError(error, "documents.delete");
  }
}
