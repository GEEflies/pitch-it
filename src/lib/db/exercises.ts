import "server-only";

import { check, DbError, must } from "@/lib/db/core";
import type { ExerciseAttemptRow, ExerciseRow, SessionRow } from "@/lib/db/types";
import type { ExerciseTemplate } from "@/lib/exercises/catalog";
import { personalizePrompt } from "@/lib/exercises/catalog";
import type { Assessment } from "@/lib/reports/assessment";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/* Cvičenia vytvára server (z reportu alebo knižnice); používateľ mení stav a maže. */

export async function createExercisesFromReport(session: SessionRow, assessment: Assessment): Promise<void> {
  const rows = assessment.weaknesses.map((weakness) => ({
    user_id: session.user_id,
    project_id: session.project_id,
    source_session_id: session.id,
    category: weakness.exercise.category,
    kind: "answer_drill" as const,
    title: weakness.exercise.title.slice(0, 160),
    prompt: weakness.exercise.prompt.slice(0, 2000),
    rationale: weakness.problem.slice(0, 2000),
    original_excerpt: weakness.original_excerpt.slice(0, 4000),
    success_criteria: weakness.exercise.success_criteria.slice(0, 4).map((criterion) => criterion.slice(0, 300)),
    time_limit_seconds: 90,
    origin: "report" as const,
  }));
  if (rows.length === 0) return;
  const { error } = await getSupabaseAdmin().from("exercises").insert(rows);
  check({ error }, "exercises.fromReport");
}

export async function createLibraryExercise(
  userId: string,
  projectId: string | null,
  projectName: string | null,
  template: ExerciseTemplate,
): Promise<ExerciseRow> {
  const result = await getSupabaseAdmin()
    .from("exercises")
    .insert({
      user_id: userId,
      project_id: projectId,
      category: template.category,
      kind: template.kind,
      title: template.title,
      prompt: personalizePrompt(template.prompt, projectName),
      rationale: template.rationale,
      success_criteria: template.successCriteria,
      time_limit_seconds: template.timeLimitSeconds,
      origin: "library",
    })
    .select("*")
    .single<ExerciseRow>();
  return must(result, "exercises.createLibrary");
}

export async function listExercises(userId: string, status?: ExerciseRow["status"]): Promise<ExerciseRow[]> {
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("exercises")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (status) query = query.eq("status", status);
  const result = await query;
  return must(result, "exercises.list") as ExerciseRow[];
}

export async function getExercise(exerciseId: string): Promise<ExerciseRow | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("exercises").select("*").eq("id", exerciseId).maybeSingle<ExerciseRow>();
  check({ error }, "exercises.get");
  return data;
}

export async function requireExercise(exerciseId: string): Promise<ExerciseRow> {
  const exercise = await getExercise(exerciseId);
  if (!exercise) throw new DbError("not_found", "Cvičenie neexistuje.");
  return exercise;
}

export async function setExerciseStatus(exerciseId: string, status: ExerciseRow["status"]): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("exercises")
    .update({ status, completed_at: status === "completed" ? new Date().toISOString() : null })
    .eq("id", exerciseId);
  check({ error }, "exercises.status");
}

export async function deleteExercise(exerciseId: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("exercises").delete().eq("id", exerciseId);
  check({ error }, "exercises.delete");
}

export async function listAttempts(exerciseId: string): Promise<ExerciseAttemptRow[]> {
  const supabase = await createSupabaseServerClient();
  const result = await supabase
    .from("exercise_attempts")
    .select("*")
    .eq("exercise_id", exerciseId)
    .order("created_at", { ascending: false })
    .limit(50);
  return must(result, "attempts.list") as ExerciseAttemptRow[];
}

export type NewAttempt = {
  exerciseId: string;
  userId: string;
  answer: string;
  inputMethod: "voice" | "text";
  durationMs: number | null;
  wordCount: number;
  wordsPerMinute: number | null;
  fillerCount: number;
};

/** Zápis pokusu (server, po overení vlastníctva cvičenia cez requireExercise). */
export async function insertAttempt(attempt: NewAttempt): Promise<ExerciseAttemptRow> {
  const result = await getSupabaseAdmin()
    .from("exercise_attempts")
    .insert({
      exercise_id: attempt.exerciseId,
      user_id: attempt.userId,
      answer_text: attempt.answer,
      input_method: attempt.inputMethod,
      duration_ms: attempt.durationMs,
      word_count: attempt.wordCount,
      words_per_minute: attempt.wordsPerMinute,
      filler_count: attempt.fillerCount,
    })
    .select("*")
    .single<ExerciseAttemptRow>();
  return must(result, "attempts.insert");
}

export async function updateAttemptEvaluation(
  attemptId: string,
  patch: Pick<ExerciseAttemptRow, "evaluation_status"> & Partial<Pick<ExerciseAttemptRow, "evaluation" | "model">>,
): Promise<void> {
  const { error } = await getSupabaseAdmin().from("exercise_attempts").update(patch).eq("id", attemptId);
  check({ error }, "attempts.evaluation");
}
