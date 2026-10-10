import "server-only";

import { check } from "@/lib/db/core";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const DOCUMENTS_BUCKET = "pitch-documents";

export function storagePathFor(projectId: string, documentId: string, kind: "pdf" | "pptx"): string {
  return `${projectId}/${documentId}.${kind}`;
}

/** Podpísaný upload pre prehliadač (politika úložiska overí právo editovať projekt). */
export async function createUploadUrl(path: string): Promise<{ path: string; token: string }> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.storage.from(DOCUMENTS_BUCKET).createSignedUploadUrl(path);
  if (error || !data) throw new Error(`storage.uploadUrl: ${error?.message ?? "bez odpovede"}`);
  return { path: data.path, token: data.token };
}

export async function downloadDocument(path: string): Promise<Uint8Array> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.storage.from(DOCUMENTS_BUCKET).download(path);
  if (error || !data) throw new Error(`storage.download: ${error?.message ?? "bez odpovede"}`);
  return new Uint8Array(await data.arrayBuffer());
}

export async function removeDocumentFile(path: string): Promise<void> {
  const { error } = await getSupabaseAdmin().storage.from(DOCUMENTS_BUCKET).remove([path]);
  if (error) throw new Error(`storage.remove: ${error.message}`);
}

/** Zmaže všetky súbory projektu (pred zmazaním projektu). Overenie prístupu robí volajúci cez RLS. */
export async function removeProjectFiles(projectId: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const result = await supabase.from("documents").select("storage_path").eq("project_id", projectId).limit(1000);
  check(result, "storage.listProject");
  const paths = (result.data ?? []).map((row: { storage_path: string }) => row.storage_path);
  if (paths.length === 0) return;
  const { error } = await getSupabaseAdmin().storage.from(DOCUMENTS_BUCKET).remove(paths);
  if (error) throw new Error(`storage.removeProject: ${error.message}`);
}

/** Zmaže súbory všetkých projektov, ktoré používateľ vlastní (pri zmazaní účtu). */
export async function removeUserFiles(userId: string): Promise<void> {
  const admin = getSupabaseAdmin();
  const projects = await admin.from("projects").select("id").eq("owner_id", userId).limit(1000);
  check(projects, "storage.userProjects");
  const projectIds = (projects.data ?? []).map((row: { id: string }) => row.id);
  const uploads = await admin.from("documents").select("storage_path").eq("uploaded_by", userId).limit(5000);
  check(uploads, "storage.userUploads");
  const paths = new Set<string>((uploads.data ?? []).map((row: { storage_path: string }) => row.storage_path));
  if (projectIds.length > 0) {
    const owned = await admin.from("documents").select("storage_path").in("project_id", projectIds).limit(5000);
    check(owned, "storage.ownedDocuments");
    for (const row of (owned.data ?? []) as Array<{ storage_path: string }>) paths.add(row.storage_path);
  }
  const list = [...paths];
  for (let i = 0; i < list.length; i += 100) {
    const { error } = await admin.storage.from(DOCUMENTS_BUCKET).remove(list.slice(i, i + 100));
    if (error) throw new Error(`storage.removeUser: ${error.message}`);
  }
}
