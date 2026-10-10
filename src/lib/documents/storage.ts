import "server-only";

import { check } from "@/lib/db/core";
import { signToken, verifyToken } from "@/lib/auth/token";
import { getKv } from "@/lib/store/kv";
import { getAdminDb, getUserDb } from "@/lib/store/client";

/*
  Súbory podkladov v Redise po častiach (base64), aby nahrávanie prešlo limitom tela
  požiadavky na Verceli (4,5 MB). Prehliadač posiela časti na /api/documents/upload
  s podpísaným tokenom, ktorý platí iba pre jednu cestu.
*/

export const UPLOAD_CHUNK_BYTES = 2 * 1024 * 1024;

export function storagePathFor(projectId: string, documentId: string, kind: "pdf" | "pptx"): string {
  return `${projectId}/${documentId}.${kind}`;
}

const metaKey = (path: string) => `f:${path}:meta`;
const partKey = (path: string, part: number) => `f:${path}:${part}`;

/** Podpísané povolenie nahrať súbor na danú cestu (15 minút). */
export async function createUploadUrl(path: string): Promise<{ path: string; token: string }> {
  return { path, token: await signToken("upload", { path }, 15 * 60) };
}

export async function verifyUploadToken(path: string, token: string | null): Promise<boolean> {
  const payload = await verifyToken<{ path: string }>("upload", token);
  return payload?.path === path;
}

export async function storeUploadPart(path: string, part: number, parts: number, bytes: Uint8Array): Promise<void> {
  const kv = getKv();
  await kv.set(partKey(path, part), Buffer.from(bytes).toString("base64"));
  await kv.set(metaKey(path), JSON.stringify({ parts }));
}

export async function downloadDocument(path: string): Promise<Uint8Array> {
  const kv = getKv();
  const meta = await kv.get(metaKey(path));
  if (!meta) throw new Error("storage.download: súbor neexistuje");
  const { parts } = JSON.parse(meta) as { parts: number };
  const chunks = await kv.mget(Array.from({ length: parts }, (_, i) => partKey(path, i)));
  if (chunks.some((c) => c === null)) throw new Error("storage.download: súbor nie je celý");
  return new Uint8Array(Buffer.concat(chunks.map((c) => Buffer.from(c as string, "base64"))));
}

export async function removeDocumentFile(path: string): Promise<void> {
  const kv = getKv();
  const meta = await kv.get(metaKey(path));
  const parts = meta ? (JSON.parse(meta) as { parts: number }).parts : 0;
  await kv.del([metaKey(path), ...Array.from({ length: parts }, (_, i) => partKey(path, i))]);
}

/** Zmaže všetky súbory projektu (pred zmazaním projektu). Prístup overí klient používateľa. */
export async function removeProjectFiles(projectId: string): Promise<void> {
  const db = await getUserDb();
  const result = await db.from("documents").select("storage_path").eq("project_id", projectId).limit(1000);
  check(result, "storage.listProject");
  for (const row of (result.data ?? []) as Array<{ storage_path: string }>) await removeDocumentFile(row.storage_path);
}

/** Zmaže súbory všetkých projektov, ktoré používateľ vlastní (pri zmazaní účtu). */
export async function removeUserFiles(userId: string): Promise<void> {
  const admin = getAdminDb();
  const projects = await admin.from("projects").select("id").eq("owner_id", userId).limit(1000);
  check(projects, "storage.userProjects");
  const projectIds = ((projects.data ?? []) as Array<{ id: string }>).map((row) => row.id);
  const uploads = await admin.from("documents").select("storage_path").eq("uploaded_by", userId).limit(5000);
  check(uploads, "storage.userUploads");
  const paths = new Set<string>(((uploads.data ?? []) as Array<{ storage_path: string }>).map((row) => row.storage_path));
  if (projectIds.length > 0) {
    const owned = await admin.from("documents").select("storage_path").in("project_id", projectIds).limit(5000);
    check(owned, "storage.ownedDocuments");
    for (const row of (owned.data ?? []) as Array<{ storage_path: string }>) paths.add(row.storage_path);
  }
  for (const path of paths) await removeDocumentFile(path);
}
