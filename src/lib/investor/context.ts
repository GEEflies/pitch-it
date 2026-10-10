import type { FactCategory, FactSource, FactStatus, IssueKind, Stage } from "@/lib/domain/labels";
import { FACT_CATEGORY_LABELS, ISSUE_KIND_LABELS, STAGE_LABELS } from "@/lib/domain/labels";

/*
  Kontext startupu pre investora: profil, fakty, slidy a známe problémy.
  Rozlišuje potvrdené údaje, údaje z podkladov a nepotvrdené interpretácie.
  Text z podkladov je dáta, nie inštrukcie: vkladá sa do ohraničených blokov.
*/

export type ProjectProfile = {
  name: string;
  oneLiner: string | null;
  industry: string | null;
  problem: string | null;
  solution: string | null;
  targetSegment: string | null;
  businessModel: string | null;
  competition: string | null;
  differentiation: string | null;
  traction: string | null;
  financials: string | null;
  team: string | null;
  stage: Stage;
  raiseAmount: number | null;
  raiseCurrency: string;
  useOfFunds: string | null;
  meetingGoal: string | null;
};

export type ContextFact = {
  category: FactCategory;
  label: string;
  valueText: string;
  period: string | null;
  sourceType: FactSource;
  status: FactStatus;
  slideNumber: number | null;
};

export type ContextSlide = { slideNumber: number; title: string | null; body: string };

export type ContextIssue = { kind: IssueKind; description: string; slideNumber: number | null };

export type StartupContext = {
  profile: ProjectProfile;
  facts: ContextFact[];
  slides: ContextSlide[];
  issues: ContextIssue[];
};

export const CONTEXT_LIMITS = {
  maxFacts: 80,
  maxIssues: 20,
  maxSlideChars: 900,
  maxDeckChars: 14_000,
  maxFieldChars: 1_200,
} as const;

function clip(value: string, max: number): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > max ? `${normalized.slice(0, max - 1).trimEnd()}…` : normalized;
}

/** Odstráni značky, ktorými ohraničujeme dáta, aby ich text z podkladu nemohol „zavrieť“. */
export function sanitizeUntrusted(value: string): string {
  return value.replace(/<\/?\s*(startup_data|deck|profil|fakty|problemy|prepis|otazka|odpoved|kriteria|meranie)[^>]*>/gi, "");
}

function formatMoney(amount: number, currency: string): string {
  return `${new Intl.NumberFormat("sk-SK", { maximumFractionDigits: 0 }).format(amount)} ${currency}`;
}

function profileLines(profile: ProjectProfile): string[] {
  const fields: Array<[string, string | null]> = [
    ["Názov", profile.name],
    ["Jednou vetou", profile.oneLiner],
    ["Odvetvie", profile.industry],
    ["Problém", profile.problem],
    ["Riešenie", profile.solution],
    ["Cieľový segment", profile.targetSegment],
    ["Biznis model", profile.businessModel],
    ["Konkurencia", profile.competition],
    ["Diferenciácia", profile.differentiation],
    ["Trakcia", profile.traction],
    ["Finančné ukazovatele", profile.financials],
    ["Tím", profile.team],
    ["Fáza", STAGE_LABELS[profile.stage]],
    [
      "Požadovaná investícia",
      profile.raiseAmount !== null ? formatMoney(profile.raiseAmount, profile.raiseCurrency) : null,
    ],
    ["Použitie investície", profile.useOfFunds],
    ["Cieľ stretnutia", profile.meetingGoal],
  ];
  return fields
    .filter((entry): entry is [string, string] => Boolean(entry[1]?.trim()))
    .map(([label, value]) => `- ${label}: ${sanitizeUntrusted(clip(value, CONTEXT_LIMITS.maxFieldChars))}`);
}

const SOURCE_TAG: Record<FactSource, string> = {
  user: "potvrdil founder",
  document: "z podkladu",
  ai_inference: "interpretácia AI, nepotvrdené",
};

function factLine(fact: ContextFact): string {
  const tag = fact.status === "confirmed" ? SOURCE_TAG[fact.sourceType] : `${SOURCE_TAG[fact.sourceType]}, čaká na kontrolu`;
  const slide = fact.slideNumber ? `, slide ${fact.slideNumber}` : "";
  const period = fact.period ? ` (${clip(fact.period, 60)})` : "";
  return `- [${FACT_CATEGORY_LABELS[fact.category]}] ${clip(fact.label, 160)}: ${clip(fact.valueText, 300)}${period} [${tag}${slide}]`;
}

/** Zostaví textový blok s kontextom startupu v rozpočte znakov. */
export function formatStartupContext(context: StartupContext): string {
  const usableFacts = context.facts
    .filter((fact) => fact.status !== "rejected")
    // Potvrdené údaje majú prednosť pred nepotvrdenými.
    .sort((a, b) => Number(b.status === "confirmed") - Number(a.status === "confirmed"))
    .slice(0, CONTEXT_LIMITS.maxFacts);

  const sections: string[] = [];
  sections.push(`<profil>\n${profileLines(context.profile).join("\n")}\n</profil>`);

  if (usableFacts.length > 0) {
    sections.push(
      `<fakty>\n${usableFacts.map((fact) => sanitizeUntrusted(factLine(fact))).join("\n")}\n</fakty>`,
    );
  }

  const openIssues = context.issues.slice(0, CONTEXT_LIMITS.maxIssues);
  if (openIssues.length > 0) {
    sections.push(
      `<problemy>\n${openIssues
        .map((issue) => {
          const slide = issue.slideNumber ? ` (slide ${issue.slideNumber})` : "";
          return `- ${ISSUE_KIND_LABELS[issue.kind]}: ${sanitizeUntrusted(clip(issue.description, 300))}${slide}`;
        })
        .join("\n")}\n</problemy>`,
    );
  }

  if (context.slides.length > 0) {
    let budget: number = CONTEXT_LIMITS.maxDeckChars;
    const slideLines: string[] = [];
    for (const slide of [...context.slides].sort((a, b) => a.slideNumber - b.slideNumber)) {
      const title = slide.title ? clip(slide.title, 120) : "";
      const body = clip(slide.body, CONTEXT_LIMITS.maxSlideChars);
      const line = `Slide ${slide.slideNumber}${title ? ` – ${title}` : ""}: ${body || "(bez textu)"}`;
      if (line.length > budget) {
        slideLines.push(`(ďalšie slidy vynechané pre dĺžku)`);
        break;
      }
      budget -= line.length;
      slideLines.push(sanitizeUntrusted(line));
    }
    sections.push(`<deck>\n${slideLines.join("\n")}\n</deck>`);
  }

  return `<startup_data>\n${sections.join("\n\n")}\n</startup_data>`;
}

/** Čo v kontexte chýba: investor sa na to má pýtať a report to má spomenúť. */
export function missingProfileAreas(profile: ProjectProfile, facts: ContextFact[]): string[] {
  const hasFact = (categories: FactCategory[]) =>
    facts.some((fact) => fact.status !== "rejected" && categories.includes(fact.category));
  const missing: string[] = [];
  if (!profile.targetSegment && !hasFact(["market"])) missing.push("cieľový segment a veľkosť trhu");
  if (!profile.traction && !hasFact(["traction"])) missing.push("trakcia");
  if (!profile.businessModel && !hasFact(["business_model", "unit_economics"])) missing.push("biznis model");
  if (!profile.competition && !hasFact(["competition"])) missing.push("konkurencia");
  if (!profile.team && !hasFact(["team"])) missing.push("tím");
  if (profile.raiseAmount === null && !hasFact(["fundraising"])) missing.push("výška investície");
  if (!profile.useOfFunds) missing.push("použitie investície");
  return missing;
}
