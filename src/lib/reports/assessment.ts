import { z } from "zod";
import { EXERCISE_CATEGORIES } from "@/lib/domain/labels";

/*
  Štruktúrovaný výstup AI hodnotenia. Každý úsudok má citáciu odpovede (turn_seq + quote),
  aby sa dal overiť proti prepisu. Žiadne celkové skóre ani predikcia rozhodnutia investora.
*/

export const ASSESSMENT_VERSION = "2026-10-10.1";

export const CONTENT_DIMENSIONS = [
  "relevance",
  "specificity",
  "evidence_numbers",
  "consistency",
  "brevity_structure",
  "tough_questions",
] as const;

export const CONTENT_DIMENSION_LABELS: Record<(typeof CONTENT_DIMENSIONS)[number], string> = {
  relevance: "Relevantnosť a priamosť odpovedí",
  specificity: "Konkrétnosť tvrdení",
  evidence_numbers: "Práca s číslami a dôkazmi",
  consistency: "Konzistentnosť s podkladmi",
  brevity_structure: "Stručnosť a štruktúra",
  tough_questions: "Zvládnutie náročných otázok",
};

export const RATINGS = ["strong", "adequate", "weak", "not_assessable"] as const;
export type Rating = (typeof RATINGS)[number];

export const RATING_LABELS: Record<Rating, string> = {
  strong: "Silné",
  adequate: "V poriadku",
  weak: "Na zlepšenie",
  not_assessable: "Nedá sa posúdiť",
};

export const PITCH_ELEMENTS = [
  "problem",
  "solution",
  "market",
  "business_model",
  "traction",
  "competition",
  "team",
  "ask",
] as const;

export const PITCH_ELEMENT_LABELS: Record<(typeof PITCH_ELEMENTS)[number], string> = {
  problem: "Problém",
  solution: "Riešenie",
  market: "Trh",
  business_model: "Biznis model",
  traction: "Trakcia",
  competition: "Konkurencia",
  team: "Tím",
  ask: "Požiadavka (koľko a na čo)",
};

const evidence = z.object({
  turn_seq: z.number().int().describe("Číslo ťahu foundera z prepisu."),
  quote: z.string().describe("Doslovná krátka citácia z tohto ťahu (najviac 200 znakov)."),
});

export const assessmentSchema = z.object({
  summary: z.string().describe("2 až 3 vety: čo fungovalo a čo je najdôležitejšie zlepšiť. Vecne, bez hodnotenia osoby."),
  content_dimensions: z
    .array(
      z.object({
        key: z.enum(CONTENT_DIMENSIONS),
        rating: z.enum(RATINGS),
        explanation: z.string().describe("Prečo toto hodnotenie, 1 až 3 vety."),
        evidence: z.array(evidence).describe("0 až 3 citácie, o ktoré sa hodnotenie opiera."),
      }),
    )
    .describe("Presne jedna položka pre každú dimenziu."),
  questions: z
    .array(
      z.object({
        investor_turn_seq: z.number().int(),
        topic: z.string().describe("Téma otázky, 2 až 5 slov."),
        answer_turn_seqs: z.array(z.number().int()),
        verdict: z.enum(["answered", "partially_answered", "evaded", "not_answered"]),
        note: z.string().describe("Jedna veta, prečo."),
      }),
    )
    .describe("Každá otázka investora a ako na ňu founder odpovedal."),
  consistency_issues: z.array(
    z.object({
      turn_seq: z.number().int(),
      claim: z.string().describe("Čo founder povedal."),
      conflicts_with: z.string().describe("S čím je to v rozpore (údaj z podkladov alebo skoršia odpoveď)."),
      source: z.enum(["profile", "fact", "deck", "earlier_answer"]),
      severity: z.enum(["high", "medium", "low"]),
    }),
  ),
  unsupported_claims: z.array(
    z.object({
      turn_seq: z.number().int(),
      claim: z.string(),
      why: z.string().describe("Čo chýba: číslo, zdroj, obdobie, príklad."),
    }),
  ),
  strengths: z
    .array(z.object({ turn_seq: z.number().int(), point: z.string() }))
    .describe("Najviac 3 konkrétne silné momenty s odkazom na ťah."),
  weaknesses: z
    .array(
      z.object({
        title: z.string().describe("Krátky názov slabiny."),
        turn_seq: z.number().int(),
        original_excerpt: z.string().describe("Doslovná citácia pôvodnej odpovede (najviac 400 znakov)."),
        problem: z.string().describe("Čo bolo problematické a prečo na tom investorovi záleží."),
        improved_example: z
          .string()
          .describe(
            "Ukážka lepšej odpovede. Použi iba údaje z podkladov; chýbajúce údaje označ ako [doplň: …]. Nevymýšľaj čísla.",
          ),
        exercise: z.object({
          category: z.enum(EXERCISE_CATEGORIES),
          title: z.string(),
          prompt: z.string().describe("Otázka investora na precvičenie, prispôsobená startupu."),
          success_criteria: z.array(z.string()).describe("2 až 4 kritériá dobrej odpovede."),
        }),
      }),
    )
    .describe("Tri najdôležitejšie slabiny (menej, ak relácia bola krátka)."),
  data_gaps: z.array(z.string()).describe("Údaje, na ktoré sa investor pýtal a v podkladoch chýbajú."),
  pitch_coverage: z
    .array(
      z.object({
        element: z.enum(PITCH_ELEMENTS),
        status: z.enum(["clear", "brief", "missing"]),
        note: z.string(),
      }),
    )
    .nullable()
    .describe("Iba pre prednes celého pitchu, inak null."),
  uncertainty: z
    .string()
    .nullable()
    .describe("Čo obmedzuje spoľahlivosť hodnotenia (krátky rozhovor, chyby prepisu). Inak null."),
});

export type Assessment = z.infer<typeof assessmentSchema>;

/**
 * Overí, že citácie a čísla ťahov odkazujú na reálne ťahy foundera; neplatné citácie odstráni.
 * Model sa môže pomýliť, report nesmie ukázať citáciu, ktorá v prepise nie je.
 */
export function validateAssessmentEvidence(
  assessment: Assessment,
  founderTurns: Map<number, string>,
  investorSeqs: Set<number>,
): Assessment {
  const normalize = (text: string) => text.toLowerCase().replace(/[\s„“"'.,!?…–-]+/g, " ").trim();
  const quoteMatches = (seq: number, quote: string) => {
    const turn = founderTurns.get(seq);
    if (!turn) return false;
    const needle = normalize(quote).slice(0, 80);
    return needle.length === 0 || normalize(turn).includes(needle);
  };

  return {
    ...assessment,
    content_dimensions: assessment.content_dimensions.map((dimension) => ({
      ...dimension,
      evidence: dimension.evidence.filter((item) => quoteMatches(item.turn_seq, item.quote)),
    })),
    questions: assessment.questions
      .filter((question) => investorSeqs.has(question.investor_turn_seq))
      .map((question) => ({
        ...question,
        answer_turn_seqs: question.answer_turn_seqs.filter((seq) => founderTurns.has(seq)),
      })),
    consistency_issues: assessment.consistency_issues.filter((issue) => founderTurns.has(issue.turn_seq)),
    unsupported_claims: assessment.unsupported_claims.filter((claim) => founderTurns.has(claim.turn_seq)),
    strengths: assessment.strengths.filter((strength) => founderTurns.has(strength.turn_seq)).slice(0, 3),
    weaknesses: assessment.weaknesses
      .filter((weakness) => quoteMatches(weakness.turn_seq, weakness.original_excerpt))
      .slice(0, 3),
  };
}
