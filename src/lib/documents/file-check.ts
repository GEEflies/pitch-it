/*
  Kontrola nahraného súboru podľa obsahu (magic bytes), nie podľa prípony ani MIME
  od klienta. Čisté funkcie, testované.
*/

export const MAX_DOCUMENT_BYTES = 25 * 1024 * 1024;

export const DOCUMENT_MIME: Record<"pdf" | "pptx", string> = {
  pdf: "application/pdf",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
};

export type DocumentKind = keyof typeof DOCUMENT_MIME;

/** Typ podľa prípony názvu (iba predbežne, pred nahraním). */
export function kindFromFileName(name: string): DocumentKind | null {
  const lower = name.toLowerCase().trim();
  if (lower.endsWith(".pdf")) return "pdf";
  if (lower.endsWith(".pptx")) return "pptx";
  return null;
}

/** Overí obsah: PDF začína „%PDF-“, PPTX je ZIP („PK\x03\x04“). Štruktúru PPTX overí až parser. */
export function sniffDocumentKind(bytes: Uint8Array): DocumentKind | null {
  if (bytes.length >= 5 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46 && bytes[4] === 0x2d) {
    return "pdf";
  }
  if (bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04) {
    return "pptx";
  }
  return null;
}

/** Bezpečný zobrazovaný názov: bez ciest, riadiacich znakov a s obmedzenou dĺžkou. */
export function sanitizeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "podklad";
  const cleaned = base
    .normalize("NFC")
    .replace(/[\u0000-\u001f\u007f<>:"|?*]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return "podklad";
  if (cleaned.length <= 200) return cleaned;
  const dot = cleaned.lastIndexOf(".");
  const extension = dot > 0 ? cleaned.slice(dot) : "";
  return `${cleaned.slice(0, 200 - extension.length)}${extension}`;
}

export type UploadCheck =
  | { ok: true; kind: DocumentKind; fileName: string }
  | { ok: false; error: string };

export function checkUploadRequest(input: { fileName: string; size: number }): UploadCheck {
  const kind = kindFromFileName(input.fileName);
  if (!kind) return { ok: false, error: "Nahraj PDF alebo PowerPoint (.pptx)." };
  if (!Number.isFinite(input.size) || input.size <= 0) return { ok: false, error: "Súbor je prázdny." };
  if (input.size > MAX_DOCUMENT_BYTES) return { ok: false, error: "Súbor je väčší ako 25 MB." };
  return { ok: true, kind, fileName: sanitizeFileName(input.fileName) };
}

export function isSha256Hex(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{64}$/.test(value);
}
