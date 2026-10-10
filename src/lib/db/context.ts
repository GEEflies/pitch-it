import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { DbError, must } from "@/lib/db/core";
import type { ExtractionRow, FactRow, IssueRow, ProjectRow } from "@/lib/db/types";
import { toNumber } from "@/lib/db/types";
import type { StartupContext } from "@/lib/investor/context";

/*
  Načítanie kontextu startupu daným klientom. Klient používateľa (RLS) pri požiadavkách,
  admin klient iba pri úlohách na pozadí po overení vlastníctva (napr. generovanie reportu).
*/

type ExtractionWithDocument = ExtractionRow & { documents: { status: string; created_at: string } | null };

export function toStartupContext(
  project: ProjectRow,
  facts: FactRow[],
  extractions: ExtractionWithDocument[],
  issues: IssueRow[],
): StartupContext {
  // Pri viacerých podkladoch berieme ako „deck“ najnovší pripravený dokument.
  const sorted = [...extractions].sort((a, b) => {
    const da = a.documents?.created_at ?? "";
    const db = b.documents?.created_at ?? "";
    return da === db ? a.slide_number - b.slide_number : da.localeCompare(db);
  });
  const latestDocumentId = sorted.length > 0 ? sorted[sorted.length - 1].document_id : null;
  const deck = sorted.filter((row) => row.document_id === latestDocumentId);

  return {
    profile: {
      name: project.name,
      oneLiner: project.one_liner,
      industry: project.industry,
      problem: project.problem,
      solution: project.solution,
      targetSegment: project.target_segment,
      businessModel: project.business_model,
      competition: project.competition,
      differentiation: project.differentiation,
      traction: project.traction,
      financials: project.financials,
      team: project.team,
      stage: project.stage,
      raiseAmount: toNumber(project.raise_amount),
      raiseCurrency: project.raise_currency,
      useOfFunds: project.use_of_funds,
      meetingGoal: project.meeting_goal,
    },
    facts: facts.map((fact) => ({
      category: fact.category,
      label: fact.label,
      valueText: fact.value_text,
      period: fact.period,
      sourceType: fact.source_type,
      status: fact.status,
      slideNumber: fact.slide_number,
    })),
    slides: deck.map((row) => ({ slideNumber: row.slide_number, title: row.title, body: row.body })),
    issues: issues
      .filter((issue) => issue.status === "open")
      .map((issue) => ({ kind: issue.kind, description: issue.description, slideNumber: issue.slide_number })),
  };
}

export async function fetchStartupContext(
  client: SupabaseClient,
  projectId: string,
): Promise<{ project: ProjectRow; context: StartupContext }> {
  const [projectResult, factsResult, extractionsResult, issuesResult] = await Promise.all([
    client.from("projects").select("*").eq("id", projectId).maybeSingle<ProjectRow>(),
    client.from("startup_facts").select("*").eq("project_id", projectId).order("category").limit(500),
    client
      .from("document_extractions")
      .select("id, document_id, project_id, slide_number, title, body, notes, method, documents!inner(status, created_at)")
      .eq("project_id", projectId)
      .eq("documents.status", "ready")
      .limit(400),
    client.from("project_issues").select("*").eq("project_id", projectId).eq("status", "open").limit(100),
  ]);

  if (projectResult.error) throw new DbError("query_failed", `context.project: ${projectResult.error.message}`);
  const project = projectResult.data;
  if (!project) throw new DbError("not_found", "Projekt neexistuje alebo k nemu nemáš prístup.");

  const facts = must(factsResult, "context.facts") as FactRow[];
  const extractions = must(extractionsResult, "context.extractions") as unknown as ExtractionWithDocument[];
  const issues = must(issuesResult, "context.issues") as IssueRow[];
  return { project, context: toStartupContext(project, facts, extractions, issues) };
}
