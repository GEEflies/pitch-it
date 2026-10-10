import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { MAX_DOCUMENT_BYTES } from "@/lib/documents/file-check";
import { storeUploadPart, UPLOAD_CHUNK_BYTES, verifyUploadToken } from "@/lib/documents/storage";

/** Jedna časť nahrávaného podkladu. Cestu a právo nahrávať potvrdzuje podpísaný token. */
export async function PUT(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: { message: "Prihlás sa znova." } }, { status: 401 });
  const params = request.nextUrl.searchParams;
  const path = params.get("path") ?? "";
  const part = Number(params.get("part"));
  const parts = Number(params.get("parts"));
  const maxParts = Math.ceil(MAX_DOCUMENT_BYTES / UPLOAD_CHUNK_BYTES);
  if (!Number.isInteger(part) || !Number.isInteger(parts) || parts < 1 || parts > maxParts || part < 0 || part >= parts) {
    return NextResponse.json({ error: { message: "Neplatná časť súboru." } }, { status: 400 });
  }
  if (!(await verifyUploadToken(path, params.get("token")))) {
    return NextResponse.json({ error: { message: "Povolenie na nahratie vypršalo. Skús to znova." } }, { status: 403 });
  }
  const bytes = new Uint8Array(await request.arrayBuffer());
  if (bytes.byteLength === 0 || bytes.byteLength > UPLOAD_CHUNK_BYTES) {
    return NextResponse.json({ error: { message: "Neplatná veľkosť časti." } }, { status: 400 });
  }
  await storeUploadPart(path, part, parts, bytes);
  return NextResponse.json({ ok: true });
}
