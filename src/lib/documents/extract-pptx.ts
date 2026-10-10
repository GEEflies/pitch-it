import JSZip from "jszip";

/*
  Extrakcia textu z PPTX: text slidov (a:t) v poradí podľa presentation.xml
  a poznámky prezentujúceho. Nespúšťa makrá ani nečíta externé odkazy.
*/

export type ExtractedSlide = { slideNumber: number; title: string | null; body: string; notes: string | null };

const MAX_SLIDES = 200;
const MAX_UNCOMPRESSED_BYTES = 80 * 1024 * 1024;

function decodeXml(text: string): string {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&amp;/g, "&");
}

/** Odseky (a:p) → riadky; texty (a:t) v odseku sa spoja. */
function paragraphs(xml: string): string[] {
  const result: string[] = [];
  for (const paragraph of xml.match(/<a:p[\s>][\s\S]*?<\/a:p>/g) ?? []) {
    const runs = [...paragraph.matchAll(/<a:t(?:\s[^>]*)?>([\s\S]*?)<\/a:t>/g)].map((match) => decodeXml(match[1]));
    const line = runs.join("").replace(/\s+/g, " ").trim();
    if (line) result.push(line);
  }
  return result;
}

/** Tvar (p:sp) s nadpisovým placeholderom. */
function titleOf(xml: string): string | null {
  for (const shape of xml.match(/<p:sp[\s>][\s\S]*?<\/p:sp>/g) ?? []) {
    if (/<p:ph[^>]*type="(title|ctrTitle)"/.test(shape)) {
      const text = paragraphs(shape).join(" ").trim();
      if (text) return text.slice(0, 300);
    }
  }
  return null;
}

function slideOrder(presentationXml: string, relsXml: string): string[] {
  const targets = new Map<string, string>();
  for (const match of relsXml.matchAll(/<Relationship\s[^>]*Id="([^"]+)"[^>]*Target="([^"]+)"[^>]*\/?>/g)) {
    targets.set(match[1], match[2]);
  }
  const ordered: string[] = [];
  for (const match of presentationXml.matchAll(/<p:sldId\s[^>]*r:id="([^"]+)"/g)) {
    const target = targets.get(match[1]);
    if (target) ordered.push(`ppt/${target.replace(/^\/?ppt\//, "").replace(/^\.\.\//, "")}`);
  }
  return ordered;
}

export class PptxError extends Error {
  readonly code: "invalid" | "too_large" | "empty";

  constructor(code: "invalid" | "too_large" | "empty") {
    super(code);
    this.code = code;
    this.name = "PptxError";
  }
}

export async function extractPptx(bytes: Uint8Array): Promise<ExtractedSlide[]> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(bytes);
  } catch {
    throw new PptxError("invalid");
  }

  const contentTypes = zip.file("[Content_Types].xml");
  const presentation = zip.file("ppt/presentation.xml");
  const presentationRels = zip.file("ppt/_rels/presentation.xml.rels");
  if (!contentTypes || !presentation || !presentationRels) throw new PptxError("invalid");
  if (!(await contentTypes.async("string")).includes("presentationml")) throw new PptxError("invalid");

  // Ochrana proti zip bombám: súčet deklarovaných nekomprimovaných veľkostí.
  let declared = 0;
  zip.forEach((_, entry) => {
    const size = (entry as unknown as { _data?: { uncompressedSize?: number } })._data?.uncompressedSize ?? 0;
    declared += size;
  });
  if (declared > MAX_UNCOMPRESSED_BYTES) throw new PptxError("too_large");

  let order = slideOrder(await presentation.async("string"), await presentationRels.async("string"));
  if (order.length === 0) {
    order = Object.keys(zip.files)
      .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
      .sort((a, b) => Number(a.match(/\d+/g)?.pop()) - Number(b.match(/\d+/g)?.pop()));
  }

  const slides: ExtractedSlide[] = [];
  for (const [index, path] of order.slice(0, MAX_SLIDES).entries()) {
    const file = zip.file(path);
    if (!file) continue;
    const xml = await file.async("string");
    const title = titleOf(xml);
    const lines = paragraphs(xml);
    const body = (title && lines[0] === title ? lines.slice(1) : lines).join("\n");

    let notes: string | null = null;
    const relsPath = path.replace(/slides\/(slide\d+\.xml)$/, "slides/_rels/$1.rels");
    const rels = zip.file(relsPath);
    if (rels) {
      const notesTarget = (await rels.async("string")).match(/Target="\.\.\/notesSlides\/(notesSlide\d+\.xml)"/)?.[1];
      const notesFile = notesTarget ? zip.file(`ppt/notesSlides/${notesTarget}`) : null;
      if (notesFile) {
        const text = paragraphs(await notesFile.async("string"))
          // Číslo slidu v poznámkach nie je obsah.
          .filter((line) => !/^\d+$/.test(line))
          .join("\n");
        notes = text || null;
      }
    }

    slides.push({ slideNumber: index + 1, title, body: body.slice(0, 20_000), notes: notes?.slice(0, 20_000) ?? null });
  }

  if (slides.length === 0) throw new PptxError("empty");
  return slides;
}
