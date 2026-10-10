import { after } from "next/server";
import { analyzeDocument, extractUploadedDocument } from "@/lib/documents/service";
import { apiError, apiOk, handleRouteError, isUuid, requireApiUser } from "@/lib/http/route";

export const maxDuration = 300;

/** Po nahraní: overenie súboru a extrakcia; AI analýza beží na pozadí. */
export async function POST(_request: Request, { params }: RouteContext<"/api/documents/[documentId]/process">) {
  const user = await requireApiUser();
  if (user instanceof Response) return user;
  const { documentId } = await params;
  if (!isUuid(documentId)) return apiError(404, "not_found", "Podklad neexistuje.");

  try {
    const { document, slides } = await extractUploadedDocument(documentId);
    if (document.status === "analyzing") {
      after(() => analyzeDocument(document.id, user.id));
    }
    return apiOk({ status: document.status, slides });
  } catch (error) {
    return handleRouteError(error, "documents.process");
  }
}
