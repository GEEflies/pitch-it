import "server-only";

import { getLlmProvider } from "@/lib/ai/llm/anthropic";
import { LlmError } from "@/lib/ai/llm/types";
import { TranscriptionError, transcribeAudio } from "@/lib/ai/transcription";
import { countFillers, countWords, wordsPerMinute } from "@/lib/analytics/speech/text-metrics";
import { checkEntitlement } from "@/lib/billing/plans";
import { DbError } from "@/lib/db/core";
import { insertAttempt, requireExercise, setExerciseStatus, updateAttemptEvaluation } from "@/lib/db/exercises";
import { loadStartupContext } from "@/lib/db/projects";
import type { ExerciseAttemptRow } from "@/lib/db/types";
import { getBillingContext, recordUsage } from "@/lib/db/usage";
import { trackEvent } from "@/lib/events/track";
import { attemptEvaluationSchema, buildEvaluationPrompt, EVALUATION_SYSTEM } from "@/lib/exercises/evaluation";

export class ExerciseServiceError extends Error {
  constructor(
    readonly code: "not_found" | "invalid" | "transcription_failed" | "limit_reached",
    message: string,
    readonly status = 400,
  ) {
    super(message);
    this.name = "ExerciseServiceError";
  }
}

export const MAX_AUDIO_BYTES = 4 * 1024 * 1024;

export type AttemptInput =
  | { kind: "text"; answer: string; durationMs: number | null }
  | { kind: "voice"; audio: Blob; fileName: string; durationMs: number | null; speechMs: number | null };

/** Uloží pokus (s prepisom pri hlase), vypočíta merania a vyhodnotí ho voči kritériám. */
export async function submitAttempt(userId: string, exerciseId: string, input: AttemptInput): Promise<ExerciseAttemptRow> {
  let exercise;
  try {
    exercise = await requireExercise(exerciseId);
  } catch (error) {
    if (error instanceof DbError) throw new ExerciseServiceError("not_found", "Cvičenie neexistuje.", 404);
    throw error;
  }
  if (exercise.user_id !== userId) throw new ExerciseServiceError("not_found", "Cvičenie neexistuje.", 404);

  let answer: string;
  let speechMs: number | null = null;
  if (input.kind === "voice") {
    if (input.audio.size === 0 || input.audio.size > MAX_AUDIO_BYTES) {
      throw new ExerciseServiceError("invalid", "Nahrávka je prázdna alebo príliš dlhá (najviac asi 3 minúty).");
    }
    try {
      answer = await transcribeAudio(input.audio, input.fileName, "sk");
    } catch (error) {
      const message =
        error instanceof TranscriptionError && error.code === "not_configured"
          ? "Prepis reči nie je dostupný. Napíš odpoveď textom."
          : "Nahrávku sa nepodarilo prepísať. Skús to znova alebo odpovedz textom.";
      throw new ExerciseServiceError("transcription_failed", message, 503);
    }
    if (!answer) throw new ExerciseServiceError("transcription_failed", "V nahrávke sme nezachytili reč. Skús to znova bližšie k mikrofónu.");
    speechMs = input.speechMs ?? input.durationMs;
    if (input.durationMs) await recordUsage(userId, "transcription_seconds", Math.ceil(input.durationMs / 1000), null);
  } else {
    answer = input.answer.trim();
    if (!answer) throw new ExerciseServiceError("invalid", "Odpoveď je prázdna.");
  }

  const words = countWords(answer);
  const attempt = await insertAttempt({
    exerciseId: exercise.id,
    userId,
    answer: answer.slice(0, 20_000),
    inputMethod: input.kind,
    durationMs: input.durationMs,
    wordCount: words,
    wordsPerMinute: input.kind === "voice" && speechMs ? wordsPerMinute(words, speechMs, 3_000) : null,
    fillerCount: countFillers(answer).total,
  });

  const llm = getLlmProvider();
  if (!llm) {
    await updateAttemptEvaluation(attempt.id, { evaluation_status: "not_configured" });
    return { ...attempt, evaluation_status: "not_configured" };
  }
  const billing = await getBillingContext(userId);
  if (!checkEntitlement(billing.plan, billing.usage, "exercise_evaluation").allowed) {
    await updateAttemptEvaluation(attempt.id, { evaluation_status: "failed" });
    throw new ExerciseServiceError("limit_reached", "Pokus je uložený, ale limit vyhodnotení je na tento mesiac vyčerpaný.", 402);
  }

  try {
    const context = exercise.project_id ? (await loadStartupContext(exercise.project_id)).context : null;
    const result = await llm.generateStructured({
      purpose: "exercise_evaluation",
      system: EVALUATION_SYSTEM,
      messages: [
        {
          role: "user",
          content: buildEvaluationPrompt({
            question: exercise.prompt,
            criteria: exercise.success_criteria,
            answer,
            context,
            durationSeconds: input.durationMs ? input.durationMs / 1000 : null,
            timeLimitSeconds: exercise.time_limit_seconds,
          }),
        },
      ],
      schema: attemptEvaluationSchema,
      effort: "medium",
      maxTokens: 4_000,
      speed: "interactive",
    });
    await updateAttemptEvaluation(attempt.id, { evaluation_status: "ready", evaluation: result.data, model: result.model });
    await recordUsage(userId, "exercise_evaluation", 1, null);

    const allMet = result.data.criteria.length > 0 && result.data.criteria.every((criterion) => criterion.met === "yes");
    if (allMet && exercise.status === "open") {
      await setExerciseStatus(exercise.id, "completed");
      await trackEvent(userId, "exercise_completed", { category: exercise.category, origin: exercise.origin });
    }
    return { ...attempt, evaluation_status: "ready", evaluation: result.data, model: result.model };
  } catch (error) {
    console.error("[exercises] vyhodnotenie zlyhalo:", error instanceof LlmError ? error.code : error);
    await updateAttemptEvaluation(attempt.id, { evaluation_status: "failed" });
    return { ...attempt, evaluation_status: "failed" };
  }
}
