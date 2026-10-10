import "server-only";

import { check, DbError, must } from "@/lib/db/core";
import { fetchStartupContext } from "@/lib/db/context";
import type { FactRow, IssueRow, ProjectRow } from "@/lib/db/types";
import type { FactInput, ProjectInput } from "@/lib/validation/schemas";
import type { StartupContext } from "@/lib/investor/context";
import { getUserDb } from "@/lib/store/client";

/* Projekty: všetko cez klienta používateľa, RLS rozhoduje o prístupe. */

export async function listProjects(): Promise<ProjectRow[]> {
  const db = await getUserDb();
  const result = await db
    .from("projects")
    .select("*")
    .is("archived_at", null)
    .order("updated_at", { ascending: false })
    .limit(100);
  return must(result, "projects.list") as ProjectRow[];
}

export async function getProject(projectId: string): Promise<ProjectRow | null> {
  const db = await getUserDb();
  const { data, error } = await db.from("projects").select("*").eq("id", projectId).maybeSingle<ProjectRow>();
  check({ error }, "projects.get");
  return data;
}

export async function requireProject(projectId: string): Promise<ProjectRow> {
  const project = await getProject(projectId);
  if (!project) throw new DbError("not_found", "Projekt neexistuje alebo k nemu nemáš prístup.");
  return project;
}

export async function countOwnedProjects(userId: string): Promise<number> {
  const db = await getUserDb();
  const { count, error } = await db
    .from("projects")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", userId)
    .is("archived_at", null);
  check({ error }, "projects.count");
  return count ?? 0;
}

export async function createProject(userId: string, input: ProjectInput): Promise<ProjectRow> {
  const db = await getUserDb();
  const result = await db
    .from("projects")
    .insert({ ...input, owner_id: userId })
    .select("*")
    .single<ProjectRow>();
  return must(result, "projects.create");
}

export async function updateProject(projectId: string, input: ProjectInput): Promise<void> {
  const db = await getUserDb();
  const { data, error } = await db.from("projects").update(input).eq("id", projectId).select("id");
  check({ error }, "projects.update");
  if (!data || data.length === 0) throw new DbError("forbidden", "Projekt nemôžeš upraviť.");
}

export async function deleteProject(projectId: string): Promise<void> {
  const db = await getUserDb();
  const { data, error } = await db.from("projects").delete().eq("id", projectId).select("id");
  check({ error }, "projects.delete");
  if (!data || data.length === 0) throw new DbError("forbidden", "Projekt môže zmazať iba jeho vlastník.");
}

/* ───────────── Fakty a problémy ───────────── */

export async function listFacts(projectId: string): Promise<FactRow[]> {
  const db = await getUserDb();
  const result = await db
    .from("startup_facts")
    .select("*")
    .eq("project_id", projectId)
    .order("category")
    .order("created_at")
    .limit(500);
  return must(result, "facts.list") as FactRow[];
}

export async function createUserFact(projectId: string, input: FactInput): Promise<void> {
  const db = await getUserDb();
  const { error } = await db.from("startup_facts").insert({
    project_id: projectId,
    category: input.category,
    label: input.label,
    value_text: input.value_text,
    period: input.period,
    note: input.note,
    source_type: "user",
    status: "confirmed",
    reviewed_at: new Date().toISOString(),
  });
  check({ error }, "facts.create");
}

/** Potvrdenie alebo zamietnutie údaju z podkladu či AI. Oprava hodnoty z neho urobí údaj od používateľa. */
export async function reviewFact(
  factId: string,
  decision: "confirm" | "reject",
  correctedValue: string | null,
): Promise<void> {
  const db = await getUserDb();
  const patch =
    decision === "reject"
      ? { status: "rejected", reviewed_at: new Date().toISOString() }
      : correctedValue
        ? { status: "confirmed", source_type: "user", value_text: correctedValue, reviewed_at: new Date().toISOString() }
        : { status: "confirmed", reviewed_at: new Date().toISOString() };
  const { data, error } = await db.from("startup_facts").update(patch).eq("id", factId).select("id");
  check({ error }, "facts.review");
  if (!data || data.length === 0) throw new DbError("forbidden", "Údaj nemôžeš upraviť.");
}

export async function deleteFact(factId: string): Promise<void> {
  const db = await getUserDb();
  const { error } = await db.from("startup_facts").delete().eq("id", factId);
  check({ error }, "facts.delete");
}

export async function listIssues(projectId: string): Promise<IssueRow[]> {
  const db = await getUserDb();
  const result = await db
    .from("project_issues")
    .select("*")
    .eq("project_id", projectId)
    .order("status")
    .order("created_at", { ascending: false })
    .limit(200);
  return must(result, "issues.list") as IssueRow[];
}

export async function setIssueStatus(issueId: string, status: "open" | "resolved" | "dismissed"): Promise<void> {
  const db = await getUserDb();
  const { error } = await db
    .from("project_issues")
    .update({ status, resolved_at: status === "open" ? null : new Date().toISOString() })
    .eq("id", issueId);
  check({ error }, "issues.status");
}

/** Počet pripravených podkladov a faktov pre projekty (dashboard, zoznam projektov). */
export async function getMaterialCounts(
  projectIds: string[],
): Promise<Record<string, { documents: number; facts: number; openIssues: number }>> {
  const counts: Record<string, { documents: number; facts: number; openIssues: number }> = {};
  for (const id of projectIds) counts[id] = { documents: 0, facts: 0, openIssues: 0 };
  if (projectIds.length === 0) return counts;

  const db = await getUserDb();
  const [documents, facts, issues] = await Promise.all([
    db.from("documents").select("project_id").in("project_id", projectIds).eq("status", "ready").limit(1000),
    db.from("startup_facts").select("project_id").in("project_id", projectIds).neq("status", "rejected").limit(5000),
    db.from("project_issues").select("project_id").in("project_id", projectIds).eq("status", "open").limit(2000),
  ]);
  for (const row of (must(documents, "counts.documents") as Array<{ project_id: string }>)) counts[row.project_id].documents += 1;
  for (const row of (must(facts, "counts.facts") as Array<{ project_id: string }>)) counts[row.project_id].facts += 1;
  for (const row of (must(issues, "counts.issues") as Array<{ project_id: string }>)) counts[row.project_id].openIssues += 1;
  return counts;
}

/* ───────────── Kontext pre investora a report ───────────── */

export async function loadStartupContext(projectId: string): Promise<{ project: ProjectRow; context: StartupContext }> {
  const db = await getUserDb();
  return fetchStartupContext(db, projectId);
}
