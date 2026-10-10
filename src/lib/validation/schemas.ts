import { z } from "zod";
import {
  COACH_FOCUS_OPTIONS,
  CURRENCIES,
  END_REASONS,
  FACT_CATEGORIES,
  ISSUE_KINDS,
  STAGES,
  TRAINING_MODES,
} from "@/lib/domain/labels";
import { INVESTOR_KEYS, SCENARIO_KEYS } from "@/lib/investor/catalog";

/*
  Validácia vstupov. Rovnaké schémy používa klient (okamžitá spätná väzba)
  aj server (jediný dôveryhodný zdroj). Chybové hlášky sú pre používateľa.
*/

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Najviac ${max} znakov.`)
    .transform((value) => (value.length > 0 ? value : null))
    .nullable()
    .optional()
    .transform((value) => value ?? null);

export const projectSchema = z.object({
  name: z.string().trim().min(1, "Zadaj názov startupu.").max(120, "Najviac 120 znakov."),
  one_liner: optionalText(400),
  industry: optionalText(120),
  problem: optionalText(4000),
  solution: optionalText(4000),
  target_segment: optionalText(4000),
  business_model: optionalText(4000),
  competition: optionalText(4000),
  differentiation: optionalText(4000),
  traction: optionalText(4000),
  financials: optionalText(4000),
  team: optionalText(4000),
  stage: z.enum(STAGES, "Vyber fázu startupu."),
  raise_amount: z
    .union([z.literal(""), z.null(), z.undefined(), z.coerce.number()])
    .transform((value) => (typeof value === "number" ? value : null))
    .refine((value) => value === null || (Number.isFinite(value) && value >= 0 && value < 1e12), {
      message: "Zadaj sumu ako kladné číslo.",
    }),
  raise_currency: z.enum(CURRENCIES).default("EUR"),
  use_of_funds: optionalText(4000),
  meeting_goal: optionalText(1000),
});

export type ProjectInput = z.infer<typeof projectSchema>;

export const factSchema = z.object({
  category: z.enum(FACT_CATEGORIES, "Vyber kategóriu."),
  label: z.string().trim().min(1, "Zadaj, o aký údaj ide.").max(160),
  value_text: z.string().trim().min(1, "Zadaj hodnotu.").max(2000),
  period: optionalText(60),
  note: optionalText(1000),
});

export type FactInput = z.infer<typeof factSchema>;

export const factReviewSchema = z.object({
  factId: z.uuid(),
  decision: z.enum(["confirm", "reject"]),
  corrected_value: optionalText(2000),
});

export const issueStatusSchema = z.object({
  issueId: z.uuid(),
  status: z.enum(["resolved", "dismissed", "open"]),
});

export const issueKindSchema = z.enum(ISSUE_KINDS);

export const createSessionSchema = z.object({
  projectId: z.uuid("Vyber projekt."),
  mode: z.enum(TRAINING_MODES),
  investorKey: z.enum(INVESTOR_KEYS),
  scenarioKey: z.enum(SCENARIO_KEYS),
  durationMinutes: z.coerce.number().int().min(1).max(60),
  cameraEnabled: z.boolean().default(false),
  coachFocus: z.array(z.enum(COACH_FOCUS_OPTIONS)).max(5).default([]),
  transport: z.enum(["realtime", "text"]).default("realtime"),
  exerciseId: z.uuid().nullable().default(null),
  previousSessionId: z.uuid().nullable().default(null),
});

export type CreateSessionInput = z.infer<typeof createSessionSchema>;

const ms = z.number().int().min(0).max(4 * 60 * 60 * 1000);

export const founderTurnMetricsSchema = z.object({
  speechMs: ms,
  pauseCount: z.number().int().min(0).max(10_000),
  pauseTotalMs: ms,
  longestPauseMs: ms,
  responseLatencyMs: ms.nullable(),
  volumeVariabilityDb: z.number().min(0).max(100).nullable(),
  pitchVariabilitySemitones: z.number().min(0).max(48).nullable(),
  pitchReliable: z.boolean(),
  transcriptConfidence: z.number().min(0).max(1).nullable(),
});

export type FounderTurnMetrics = z.infer<typeof founderTurnMetricsSchema>;

export const turnPayloadSchema = z.object({
  seq: z.number().int().min(0).max(100_000),
  speaker: z.enum(["investor", "founder"]),
  text: z.string().max(20_000),
  startedMs: ms.nullable(),
  endedMs: ms.nullable(),
  interrupted: z.boolean(),
  source: z.enum(["realtime", "text"]),
  providerItemId: z.string().max(100).nullable(),
  metrics: founderTurnMetricsSchema.nullable(),
});

export type TurnPayload = z.infer<typeof turnPayloadSchema>;

export const turnsRequestSchema = z.object({
  turns: z.array(turnPayloadSchema).min(1).max(50),
});

const ratio = z.number().min(0).max(1).nullable();

export const visualAggregateSchema = z.object({
  framesAnalyzed: z.number().int().min(0).max(1_000_000),
  sampleRateHz: z.number().min(0).max(60).nullable(),
  faceVisibleRatio: ratio,
  faceCenteredRatio: ratio,
  facingCameraRatio: ratio,
  gazeTowardCameraRatio: ratio,
  headMovementIndex: z.number().min(0).max(1000).nullable(),
  upperBodyVisibleRatio: ratio,
  postureStabilityIndex: z.number().min(0).max(1000).nullable(),
  handsVisibleRatio: ratio,
  gestureActivityIndex: z.number().min(0).max(1000).nullable(),
  framingIssues: z.array(z.string().max(40)).max(10),
  perTurn: z
    .array(
      z.object({
        turnSeq: z.number().int().min(0),
        facingCameraRatio: ratio,
        faceVisibleRatio: ratio,
        gestureActivityIndex: z.number().min(0).max(1000).nullable(),
      }),
    )
    .max(500),
});

export type VisualAggregate = z.infer<typeof visualAggregateSchema>;

const usageNumber = z.number().int().min(0).max(100_000_000);

export const finishRequestSchema = z.object({
  endReason: z.enum(END_REASONS),
  visual: visualAggregateSchema.nullable().default(null),
  providerUsage: z
    .object({
      inputTokens: usageNumber,
      outputTokens: usageNumber,
      inputAudioTokens: usageNumber,
      outputAudioTokens: usageNumber,
      cachedTokens: usageNumber,
      responses: usageNumber,
    })
    .nullable()
    .default(null),
});

export type FinishRequest = z.infer<typeof finishRequestSchema>;

export const connectRequestSchema = z.object({
  resume: z.boolean().default(false),
});

export const textTurnRequestSchema = z.object({
  message: z.string().trim().max(4000).nullable(),
});

export const hintRequestSchema = z.object({
  question: z.string().trim().min(1).max(2000),
});

export const settingsSchema = z.object({
  display_name: optionalText(80),
  default_mode: z.enum(TRAINING_MODES),
  coach_focus: z.array(z.enum(COACH_FOCUS_OPTIONS)).max(5),
  data_retention_days: z
    .union([z.literal("forever"), z.literal("30"), z.literal("90"), z.literal("365")])
    .transform((value) => (value === "forever" ? null : (Number(value) as 30 | 90 | 365))),
});

export const exerciseAttemptSchema = z.object({
  answer: z.string().trim().min(1, "Odpoveď je prázdna.").max(20_000),
  inputMethod: z.enum(["voice", "text"]),
  durationMs: z.number().int().min(0).max(30 * 60 * 1000).nullable(),
  speechMs: z.number().int().min(0).max(30 * 60 * 1000).nullable(),
});

/** Prvá chyba pre každé pole (pre formuláre). */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_form";
    if (!errors[key]) errors[key] = issue.message;
  }
  return errors;
}
