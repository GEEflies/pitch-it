import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { getLlmProvider } from "@/lib/ai/llm/anthropic";
import { LlmError } from "@/lib/ai/llm/types";
import { checkEntitlement } from "@/lib/billing/plans";
import { fetchStartupContext } from "@/lib/db/context";
import { check, DbError, must } from "@/lib/db/core";
import type { DocumentRow, ExtractionRow } from "@/lib/db/types";
import { getBillingContext } from "@/lib/db/usage";
import { getAdminBillingContext, recordUsage } from "@/lib/db/usage-admin";
import {
  DECK_ANALYSIS_SYSTEM,
  DECK_ANALYSIS_VERSION,
  buildDeckAnalysisPrompt,
  deckAnalysisSchema,
} from "@/lib/documents/analysis";
import { extractPdf, PdfError } from "@/lib/documents/extract-pdf";
import { extractPptx, PptxError, type ExtractedSlide } from "@/lib/documents/extract-pptx";
import { checkUploadRequest, isSha256Hex, MAX_DOCUMENT_BYTES, sniffDocumentKind } from "@/lib/documents/file-check";
import { createUploadUrl, downloadDocument, removeDocumentFile, storagePathFor } from "@/lib/documents/storage";
import { trackEvent } from "@/lib/events/track";
import { getAdminDb, getUserDb } from "@/lib/store/client";

export class DocumentServiceError extends Error {
  constructor(
    readonly code: "invalid_file" | "duplicate" | "limit_reached" | "not_found" | "forbidden" | "processing_failed",
    message: string,
    readonly status = 400,
  ) {
    super(message);
    this.name = "DocumentServiceError";
  }
}

const EXTRACTION_ERRORS: Record<string, string> = {
  invalid: "Súbor sa nedá prečítať. Over, že ide o platné PDF alebo PPTX.",
  encrypted: "PDF je chránené heslom. Nahraj verziu bez hesla.",
  too_many_pages: "Podklad má viac ako 200 strán.",
  too_large: "Prezentácia je po rozbalení príliš veľká.",
  empty: "Prezentácia neobsahuje žiadne slidy.",
};

export async function listDocuments(projectId: string): Promise<DocumentRow[]> {
  const db = await getUserDb();
  const result = await db
    .from("documents")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(50);
  return must(result, "documents.list") as DocumentRow[];
}

async function getDocument(documentId: string): Promise<DocumentRow> {
  const db = await getUserDb();
  const { data, error } = await db.from("documents").select("*").eq("id", documentId).maybeSingle<DocumentRow>();
  check({ error }, "documents.get");
  if (!data) throw new DocumentServiceError("not_found", "Podklad neexistuje.", 404);
  return data;
}

export type PreparedUpload = { documentId: string; path: string; token: string };

/** Založí záznam dokumentu a vráti podpísaný upload do súkromného úložiska. */
export async function prepareUpload(
  userId: string,
  projectId: string,
  input: { fileName: string; size: number; sha256: string },
): Promise<PreparedUpload> {
  const checked = checkUploadRequest(input);
  if (!checked.ok) throw new DocumentServiceError("invalid_file", checked.error);
  if (!isSha256Hex(input.sha256)) throw new DocumentServiceError("invalid_file", "Chýba kontrolný súčet súboru.");

  const billing = await getBillingContext(userId);
  if (!checkEntitlement(billing.plan, billing.usage, "deck_analysis").allowed) {
    throw new DocumentServiceError("limit_reached", "Limit analýz podkladov je na tento mesiac vyčerpaný.", 402);
  }

  const documentId = randomUUID();
  const path = storagePathFor(projectId, documentId, checked.kind);
  const db = await getUserDb();
  const { error } = await db.from("documents").insert({
    id: documentId,
    project_id: projectId,
    uploaded_by: userId,
    storage_path: path,
    file_name: checked.fileName,
    file_type: checked.kind,
    size_bytes: input.size,
    sha256: input.sha256,
    status: "uploaded",
  });
  if (error?.code === "23505") {
    throw new DocumentServiceError("duplicate", "Tento súbor už v projekte je.", 409);
  }
  if (error?.code === "42501") {
    throw new DocumentServiceError("forbidden", "Do tohto projektu nemôžeš nahrávať podklady.", 403);
  }
  check({ error }, "documents.insert");

  const upload = await createUploadUrl(path);
  return { documentId, path: upload.path, token: upload.token };
}

async function setStatus(documentId: string, patch: Partial<DocumentRow>): Promise<void> {
  const { error } = await getAdminDb().from("documents").update(patch).eq("id", documentId);
  check({ error }, "documents.status");
}

async function failDocument(document: DocumentRow, code: string): Promise<void> {
  await setStatus(document.id, { status: "failed", error_code: code });
  await removeDocumentFile(document.storage_path).catch(() => undefined);
}

/**
 * Overí nahraný súbor (veľkosť, obsah, kontrolný súčet), extrahuje slidy a uloží ich.
 * Vráti true, ak je dokument pripravený na AI analýzu.
 */
export async function extractUploadedDocument(documentId: string): Promise<{ document: DocumentRow; slides: number }> {
  const document = await getDocument(documentId);
  if (document.status !== "uploaded") {
    return { document, slides: document.slide_count ?? 0 };
  }

  let bytes: Uint8Array;
  try {
    bytes = await downloadDocument(document.storage_path);
  } catch {
    throw new DocumentServiceError("processing_failed", "Súbor sa nenahral celý. Skús ho nahrať znova.", 409);
  }

  const actualHash = createHash("sha256").update(bytes).digest("hex");
  if (bytes.length > MAX_DOCUMENT_BYTES || bytes.length !== document.size_bytes || actualHash !== document.sha256) {
    await failDocument(document, "integrity");
    throw new DocumentServiceError("invalid_file", "Nahraný súbor sa nezhoduje s pôvodným. Nahraj ho znova.");
  }
  if (sniffDocumentKind(bytes) !== document.file_type) {
    await failDocument(document, "type_mismatch");
    throw new DocumentServiceError("invalid_file", "Obsah súboru nezodpovedá PDF ani PPTX.");
  }

  await setStatus(document.id, { status: "extracting" });
  let slides: ExtractedSlide[];
  try {
    slides = document.file_type === "pdf" ? await extractPdf(bytes) : await extractPptx(bytes);
  } catch (error) {
    const code = error instanceof PdfError || error instanceof PptxError ? error.code : "invalid";
    await failDocument(document, `extract_${code}`);
    throw new DocumentServiceError("invalid_file", EXTRACTION_ERRORS[code] ?? EXTRACTION_ERRORS.invalid);
  }

  const { error } = await getAdminDb()
    .from("document_extractions")
    .upsert(
      slides.map((slide) => ({
        document_id: document.id,
        project_id: document.project_id,
        slide_number: slide.slideNumber,
        title: slide.title,
        body: slide.body,
        notes: slide.notes,
        method: document.file_type === "pdf" ? "pdf_text" : "pptx_xml",
      })),
      { onConflict: "document_id,slide_number" },
    );
  check({ error }, "extractions.insert");

  await setStatus(document.id, { status: "analyzing", slide_count: slides.length, error_code: null });
  return { document: { ...document, status: "analyzing", slide_count: slides.length }, slides: slides.length };
}

/**
 * AI analýza na pozadí (after()). Vlastníctvo overil volajúci cez extractUploadedDocument.
 * Pri zlyhaní AI ostane dokument použiteľný (extrakcia), iba bez navrhnutých faktov.
 */
export async function analyzeDocument(documentId: string, userId: string): Promise<void> {
  const admin = getAdminDb();
  const documentResult = await admin.from("documents").select("*").eq("id", documentId).single<DocumentRow>();
  const document = must(documentResult, "analyze.document");
  if (document.status !== "analyzing") return;

  const llm = getLlmProvider();
  if (!llm) {
    await setStatus(document.id, { status: "ready", error_code: "analysis_not_configured" });
    return;
  }

  const billing = await getAdminBillingContext(userId);
  if (!checkEntitlement(billing.plan, billing.usage, "deck_analysis").allowed) {
    await setStatus(document.id, { status: "ready", error_code: "analysis_limit" });
    return;
  }

  try {
    const extractions = must(
      await admin.from("document_extractions").select("*").eq("document_id", document.id).order("slide_number"),
      "analyze.extractions",
    ) as ExtractionRow[];
    const { context } = await fetchStartupContext(admin, document.project_id);

    // PDF pošleme aj ako dokument: Claude prečíta grafy a slidy bez textovej vrstvy.
    let pdfBase64: string | null = null;
    if (document.file_type === "pdf" && document.size_bytes <= 20 * 1024 * 1024) {
      const data = await downloadDocument(document.storage_path).catch(() => null);
      if (data) pdfBase64 = Buffer.from(data).toString("base64");
    }

    const result = await llm.generateStructured({
      purpose: "deck_analysis",
      system: DECK_ANALYSIS_SYSTEM,
      documents: pdfBase64 ? [{ kind: "pdf", base64: pdfBase64, title: document.file_name }] : undefined,
      messages: [
        {
          role: "user",
          content: buildDeckAnalysisPrompt({
            fileName: document.file_name,
            slides: extractions.map((row) => ({
              slideNumber: row.slide_number,
              title: row.title,
              body: row.body,
              notes: row.notes,
            })),
            context,
            includesPdf: Boolean(pdfBase64),
          }),
        },
      ],
      schema: deckAnalysisSchema,
      effort: "high",
      maxTokens: 16_000,
    });

    const maxSlide = extractions.length;
    const validSlide = (slide: number | null) => (slide !== null && slide >= 1 && slide <= maxSlide ? slide : null);

    // Pri opakovanej analýze nahradíme iba neskontrolované návrhy z tohto dokumentu.
    check(
      await admin.from("startup_facts").delete().eq("document_id", document.id).eq("status", "needs_review"),
      "analyze.clearFacts",
    );
    check(
      await admin.from("project_issues").delete().eq("document_id", document.id).eq("status", "open"),
      "analyze.clearIssues",
    );

    const facts = result.data.facts.slice(0, 40).map((fact) => ({
      project_id: document.project_id,
      category: fact.category,
      label: fact.label.slice(0, 160),
      value_text: fact.value_text.slice(0, 2000) || "–",
      value_number: fact.value_number !== null && Number.isFinite(fact.value_number) ? fact.value_number : null,
      unit: fact.unit?.slice(0, 24) ?? null,
      period: fact.period?.slice(0, 60) ?? null,
      source_type: fact.origin === "stated" ? "document" : "ai_inference",
      status: "needs_review",
      confidence: fact.confidence,
      document_id: document.id,
      slide_number: validSlide(fact.slide_number),
      source_quote: fact.quote.slice(0, 1000),
    }));
    if (facts.length > 0) check(await admin.from("startup_facts").insert(facts), "analyze.insertFacts");

    const issues = result.data.issues.slice(0, 15).map((issue) => ({
      project_id: document.project_id,
      kind: issue.kind,
      category: issue.category,
      description: issue.description.slice(0, 1000),
      document_id: document.id,
      slide_number: validSlide(issue.slide_number),
    }));
    if (issues.length > 0) check(await admin.from("project_issues").insert(issues), "analyze.insertIssues");

    await setStatus(document.id, {
      status: "ready",
      error_code: null,
      analysis_summary: result.data.summary.slice(0, 4000),
      analysis_model: `${result.model}@${DECK_ANALYSIS_VERSION}`.slice(0, 80),
      analyzed_at: new Date().toISOString(),
    });
    await recordUsage(userId, "deck_analysis", 1, null);
    await trackEvent(userId, "deck_processed", {
      file_type: document.file_type,
      slides: maxSlide,
      facts: facts.length,
      issues: issues.length,
    });
  } catch (error) {
    const code = error instanceof LlmError ? error.code : error instanceof DbError ? error.code : "unexpected";
    console.error("[documents] analýza zlyhala:", code, error instanceof Error ? error.message.slice(0, 200) : "");
    await setStatus(document.id, { status: "ready", error_code: "analysis_failed" }).catch(() => undefined);
  }
}

/** Opätovná AI analýza už extrahovaného dokumentu. */
export async function requestReanalysis(documentId: string): Promise<DocumentRow> {
  const document = await getDocument(documentId);
  if (document.status !== "ready") {
    throw new DocumentServiceError("processing_failed", "Podklad sa ešte spracúva.", 409);
  }
  const db = await getUserDb();
  const { data } = await db.rpc("can_edit_project", { p_project_id: document.project_id });
  if (data !== true) throw new DocumentServiceError("forbidden", "Tento podklad nemôžeš upravovať.", 403);
  await setStatus(document.id, { status: "analyzing", error_code: null });
  return document;
}

/** Zmaže podklad, jeho súbor a neskontrolované návrhy faktov. Potvrdené fakty ostanú. */
export async function deleteDocument(documentId: string): Promise<void> {
  const document = await getDocument(documentId);
  const db = await getUserDb();
  check(
    await db.from("startup_facts").delete().eq("document_id", document.id).eq("status", "needs_review"),
    "documents.deleteFacts",
  );
  const { data, error } = await db.from("documents").delete().eq("id", document.id).select("id");
  check({ error }, "documents.delete");
  if (!data || data.length === 0) throw new DocumentServiceError("forbidden", "Tento podklad nemôžeš zmazať.", 403);
  await removeDocumentFile(document.storage_path);
}
