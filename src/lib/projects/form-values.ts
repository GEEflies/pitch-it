import type { ProjectFormValues } from "@/components/projects/project-form";
import type { ProjectRow } from "@/lib/db/types";
import { toNumber } from "@/lib/db/types";

export function projectToFormValues(project: ProjectRow): ProjectFormValues {
  const amount = toNumber(project.raise_amount);
  return {
    name: project.name,
    one_liner: project.one_liner ?? "",
    industry: project.industry ?? "",
    problem: project.problem ?? "",
    solution: project.solution ?? "",
    target_segment: project.target_segment ?? "",
    business_model: project.business_model ?? "",
    competition: project.competition ?? "",
    differentiation: project.differentiation ?? "",
    traction: project.traction ?? "",
    financials: project.financials ?? "",
    team: project.team ?? "",
    stage: project.stage,
    raise_amount: amount === null ? "" : String(amount),
    raise_currency: project.raise_currency,
    use_of_funds: project.use_of_funds ?? "",
    meeting_goal: project.meeting_goal ?? "",
  };
}

/** Koľko z kľúčových častí profilu je vyplnených (pre prehľad, nie hodnotenie). */
export function profileCompleteness(project: ProjectRow): { filled: number; total: number; missing: string[] } {
  const parts: Array<[string, unknown]> = [
    ["problém", project.problem],
    ["riešenie", project.solution],
    ["trh", project.target_segment],
    ["biznis model", project.business_model],
    ["konkurencia", project.competition],
    ["trakcia", project.traction],
    ["čísla", project.financials],
    ["tím", project.team],
    ["investícia", project.raise_amount],
    ["použitie peňazí", project.use_of_funds],
  ];
  const missing = parts.filter(([, value]) => value === null || value === "").map(([label]) => label);
  return { filled: parts.length - missing.length, total: parts.length, missing };
}
