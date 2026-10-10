/*
  Vymenované hodnoty a ich slovenské popisy. Hodnoty zodpovedajú check constraintom
  v databáze. Pri lokalizácii pribudne anglická mapa s rovnakými kľúčmi.
*/

export const STAGES = ["idea", "pre_seed", "seed", "series_a", "series_b_plus"] as const;
export type Stage = (typeof STAGES)[number];

export const STAGE_LABELS: Record<Stage, string> = {
  idea: "Nápad",
  pre_seed: "Pre-seed",
  seed: "Seed",
  series_a: "Séria A",
  series_b_plus: "Séria B a ďalej",
};

export const CURRENCIES = ["EUR", "USD", "CZK", "GBP"] as const;
export type Currency = (typeof CURRENCIES)[number];

export const FACT_CATEGORIES = [
  "market",
  "traction",
  "financials",
  "unit_economics",
  "team",
  "product",
  "technology",
  "competition",
  "business_model",
  "fundraising",
  "other",
] as const;
export type FactCategory = (typeof FACT_CATEGORIES)[number];

export const FACT_CATEGORY_LABELS: Record<FactCategory, string> = {
  market: "Trh",
  traction: "Trakcia",
  financials: "Financie",
  unit_economics: "Unit economics",
  team: "Tím",
  product: "Produkt",
  technology: "Technológia",
  competition: "Konkurencia",
  business_model: "Biznis model",
  fundraising: "Investícia",
  other: "Iné",
};

export const FACT_SOURCES = ["user", "document", "ai_inference"] as const;
export type FactSource = (typeof FACT_SOURCES)[number];

export const FACT_SOURCE_LABELS: Record<FactSource, string> = {
  user: "Zadal si ty",
  document: "Z podkladu",
  ai_inference: "Interpretácia AI",
};

export const FACT_STATUSES = ["confirmed", "needs_review", "rejected"] as const;
export type FactStatus = (typeof FACT_STATUSES)[number];

export const FACT_STATUS_LABELS: Record<FactStatus, string> = {
  confirmed: "Potvrdené",
  needs_review: "Na kontrolu",
  rejected: "Zamietnuté",
};

export const ISSUE_KINDS = ["missing", "conflict", "unsupported_claim", "unclear"] as const;
export type IssueKind = (typeof ISSUE_KINDS)[number];

export const ISSUE_KIND_LABELS: Record<IssueKind, string> = {
  missing: "Chýba",
  conflict: "Rozpor",
  unsupported_claim: "Nepodložené tvrdenie",
  unclear: "Nejasné",
};

export const TRAINING_MODES = ["coach", "simulation", "delivery"] as const;
export type TrainingMode = (typeof TRAINING_MODES)[number];

export const TRAINING_MODE_LABELS: Record<TrainingMode, string> = {
  coach: "Tréning s nápovedou",
  simulation: "Realistická simulácia",
  delivery: "Prednes celého pitchu",
};

export const TRAINING_MODE_DESCRIPTIONS: Record<TrainingMode, string> = {
  coach:
    "Investor sa pýta ako naostro. Ty si môžeš vypýtať nápovedu a dostávať jemné upozornenia na to, na čo sa práve sústreďuješ.",
  simulation:
    "Rozhovor bez nápovedy a bez upozornení, čo najbližšie skutočnému stretnutiu. Celý rozbor príde až po skončení.",
  delivery:
    "Odprezentuješ celý pitch v časovom limite. Investor mlčí a počúva. Potom dostaneš rozbor obsahu, času, tempa a páuz.",
};

export const COACH_FOCUS_OPTIONS = ["pace", "answer_length", "fillers", "camera_gaze", "framing"] as const;
export type CoachFocus = (typeof COACH_FOCUS_OPTIONS)[number];

export const COACH_FOCUS_LABELS: Record<CoachFocus, string> = {
  pace: "Tempo reči",
  answer_length: "Dĺžka odpovedí",
  fillers: "Výplňové slová",
  camera_gaze: "Pohľad ku kamere",
  framing: "Poloha v zábere",
};

export const SESSION_STATUSES = ["ready", "live", "completed", "abandoned", "failed"] as const;
export type SessionStatus = (typeof SESSION_STATUSES)[number];

export const SESSION_STATUS_LABELS: Record<SessionStatus, string> = {
  ready: "Pripravená",
  live: "Prebieha",
  completed: "Dokončená",
  abandoned: "Prerušená",
  failed: "Zlyhala",
};

export const END_REASONS = [
  "user_ended",
  "investor_ended",
  "time_limit",
  "connection_lost",
  "error",
  "abandoned",
] as const;
export type EndReason = (typeof END_REASONS)[number];

export const EXERCISE_CATEGORIES = [
  "market",
  "financials",
  "competition",
  "traction_unit_economics",
  "team",
  "fundraising_ask",
  "concise_answers",
  "tough_follow_ups",
  "full_pitch",
] as const;
export type ExerciseCategory = (typeof EXERCISE_CATEGORIES)[number];

export const EXERCISE_CATEGORY_LABELS: Record<ExerciseCategory, string> = {
  market: "Otázky o trhu",
  financials: "Obhajoba finančných metrík",
  competition: "Konkurencia a diferenciácia",
  traction_unit_economics: "Trakcia a unit economics",
  team: "Prečo práve tento tím",
  fundraising_ask: "Fundraisingová požiadavka",
  concise_answers: "Stručné a jasné odpovede",
  tough_follow_ups: "Náročné doplňujúce otázky",
  full_pitch: "Celý pitch v časovom limite",
};

export const EXERCISE_KINDS = ["answer_drill", "mini_simulation", "pitch_timed"] as const;
export type ExerciseKind = (typeof EXERCISE_KINDS)[number];

export function isOneOf<T extends string>(values: readonly T[], value: unknown): value is T {
  return typeof value === "string" && (values as readonly string[]).includes(value);
}
