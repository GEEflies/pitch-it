import "server-only";

import { check, DbError, must } from "@/lib/db/core";
import type {
  AudioMetricsRow,
  ReportRow,
  SessionRow,
  TurnRow,
  VisualAnalyticsRow,
} from "@/lib/db/types";
import type { EndReason, TrainingMode } from "@/lib/domain/labels";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { FounderTurnMetrics, TurnPayload, VisualAggregate } from "@/lib/validation/schemas";

/*
  Relácie: čítanie cez klienta používateľa (RLS), životný cyklus a účtovanie
  cez admin klienta až po overení vlastníctva (getOwnedSession).
*/

export async function getOwnedSession(sessionId: string, userId: string): Promise<SessionRow> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("training_sessions")
    .select("*")
    .eq("id", sessionId)
    .eq("user_id", userId)
    .maybeSingle<SessionRow>();
  check({ error }, "sessions.get");
  if (!data) throw new DbError("not_found", "Tréning neexistuje.");
  return data;
}

export async function findOwnedSession(sessionId: string, userId: string): Promise<SessionRow | null> {
  try {
    return await getOwnedSession(sessionId, userId);
  } catch (error) {
    if (error instanceof DbError && error.code === "not_found") return null;
    throw error;
  }
}

export type NewSession = {
  userId: string;
  projectId: string;
  mode: TrainingMode;
  investorKey: string;
  scenarioKey: string;
  targetDurationSeconds: number;
  cameraEnabled: boolean;
  coachFocus: string[];
  transport: "realtime" | "text";
  exerciseId: string | null;
  previousSessionId: string | null;
  configSnapshot: Record<string, unknown>;
};

export async function createSession(input: NewSession): Promise<SessionRow> {
  const result = await getSupabaseAdmin()
    .from("training_sessions")
    .insert({
      user_id: input.userId,
      project_id: input.projectId,
      mode: input.mode,
      investor_key: input.investorKey,
      scenario_key: input.scenarioKey,
      target_duration_seconds: input.targetDurationSeconds,
      camera_enabled: input.cameraEnabled,
      coach_focus: input.coachFocus,
      transport: input.transport,
      exercise_id: input.exerciseId,
      previous_session_id: input.previousSessionId,
      config_snapshot: input.configSnapshot,
    })
    .select("*")
    .single<SessionRow>();
  return must(result, "sessions.create");
}

/** Uzavrie opustené živé relácie používateľa a vyúčtuje ich. */
export async function closeStaleSessions(userId: string): Promise<void> {
  const { error } = await getSupabaseAdmin().rpc("close_stale_sessions", { p_user_id: userId });
  check({ error }, "sessions.closeStale");
}

export async function markSessionLive(
  session: SessionRow,
  provider: { id: string; model: string } | null,
  transport: "realtime" | "text",
): Promise<SessionRow> {
  const now = new Date().toISOString();
  const result = await getSupabaseAdmin()
    .from("training_sessions")
    .update({
      status: "live",
      transport,
      started_at: session.started_at ?? now,
      last_heartbeat_at: now,
      connection_count: session.connection_count + (provider ? 1 : 0),
      realtime_provider: provider?.id ?? session.realtime_provider,
      realtime_model: provider?.model ?? session.realtime_model,
    })
    .eq("id", session.id)
    .eq("user_id", session.user_id)
    .in("status", ["ready", "live"])
    .select("*")
    .single<SessionRow>();
  return must(result, "sessions.markLive");
}

export async function touchHeartbeat(sessionId: string, userId: string): Promise<void> {
  const { error } = await getSupabaseAdmin()
    .from("training_sessions")
    .update({ last_heartbeat_at: new Date().toISOString() })
    .eq("id", sessionId)
    .eq("user_id", userId)
    .eq("status", "live");
  check({ error }, "sessions.heartbeat");
}

export async function listTurns(sessionId: string): Promise<TurnRow[]> {
  const supabase = await createSupabaseServerClient();
  const result = await supabase
    .from("conversation_turns")
    .select("*")
    .eq("session_id", sessionId)
    .order("seq")
    .limit(2000);
  return must(result, "turns.list") as TurnRow[];
}

/** Uloží ťahy (idempotentne podľa seq). RLS povolí zápis iba do vlastnej živej relácie. */
export async function insertTurns(sessionId: string, userId: string, turns: TurnPayload[]): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("conversation_turns").upsert(
    turns.map((turn) => ({
      session_id: sessionId,
      user_id: userId,
      seq: turn.seq,
      speaker: turn.speaker,
      text: turn.text,
      started_ms: turn.startedMs,
      ended_ms: turn.endedMs !== null && turn.startedMs !== null && turn.endedMs < turn.startedMs ? turn.startedMs : turn.endedMs,
      interrupted: turn.interrupted,
      source: turn.source,
      provider_item_id: turn.providerItemId,
    })),
    { onConflict: "session_id,seq", ignoreDuplicates: true },
  );
  check({ error }, "turns.insert");
}

export type FounderMetricsRecord = {
  turnSeq: number;
  wordCount: number;
  wordsPerMinute: number | null;
  fillerCount: number;
  fillers: Record<string, number>;
  metrics: FounderTurnMetrics;
};

export async function upsertAudioMetrics(sessionId: string, userId: string, records: FounderMetricsRecord[]): Promise<void> {
  if (records.length === 0) return;
  const { error } = await getSupabaseAdmin()
    .from("audio_delivery_metrics")
    .upsert(
      records.map((record) => ({
        session_id: sessionId,
        user_id: userId,
        turn_seq: record.turnSeq,
        speech_ms: record.metrics.speechMs,
        word_count: record.wordCount,
        words_per_minute: record.wordsPerMinute,
        response_latency_ms: record.metrics.responseLatencyMs,
        pause_count: record.metrics.pauseCount,
        pause_total_ms: record.metrics.pauseTotalMs,
        longest_pause_ms: record.metrics.longestPauseMs,
        filler_count: record.fillerCount,
        fillers: record.fillers,
        volume_variability: record.metrics.volumeVariabilityDb,
        pitch_variability_semitones: record.metrics.pitchVariabilitySemitones,
        pitch_reliable: record.metrics.pitchReliable,
        transcript_confidence: record.metrics.transcriptConfidence,
      })),
      { onConflict: "session_id,turn_seq", ignoreDuplicates: true },
    );
  check({ error }, "audioMetrics.upsert");
}

export async function listAudioMetrics(sessionIds: string[]): Promise<AudioMetricsRow[]> {
  if (sessionIds.length === 0) return [];
  const supabase = await createSupabaseServerClient();
  const result = await supabase
    .from("audio_delivery_metrics")
    .select("*")
    .in("session_id", sessionIds)
    .order("turn_seq")
    .limit(5000);
  return must(result, "audioMetrics.list") as AudioMetricsRow[];
}

export async function saveVisualAnalytics(sessionId: string, userId: string, visual: VisualAggregate): Promise<void> {
  const { error } = await getSupabaseAdmin()
    .from("visual_analytics")
    .upsert(
      {
        session_id: sessionId,
        user_id: userId,
        frames_analyzed: visual.framesAnalyzed,
        sample_rate_hz: visual.sampleRateHz,
        face_visible_ratio: visual.faceVisibleRatio,
        face_centered_ratio: visual.faceCenteredRatio,
        facing_camera_ratio: visual.facingCameraRatio,
        gaze_toward_camera_ratio: visual.gazeTowardCameraRatio,
        head_movement_index: visual.headMovementIndex,
        upper_body_visible_ratio: visual.upperBodyVisibleRatio,
        posture_stability_index: visual.postureStabilityIndex,
        hands_visible_ratio: visual.handsVisibleRatio,
        gesture_activity_index: visual.gestureActivityIndex,
        framing_issues: visual.framingIssues,
        per_turn: visual.perTurn,
      },
      { onConflict: "session_id" },
    );
  check({ error }, "visual.save");
}

export async function getVisualAnalytics(sessionId: string): Promise<VisualAnalyticsRow | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("visual_analytics")
    .select("*")
    .eq("session_id", sessionId)
    .maybeSingle<VisualAnalyticsRow>();
  check({ error }, "visual.get");
  return data;
}

export type FinishResult = { session: SessionRow; newlyBilledSeconds: number };

/** Uzavrie reláciu a vypočíta účtovaný čas zo serverových časov (nie z klienta). */
export async function finishSession(
  session: SessionRow,
  endReason: EndReason,
  providerUsage: Record<string, unknown> | null,
  now = new Date(),
): Promise<FinishResult> {
  const startedAt = session.started_at ? new Date(session.started_at).getTime() : null;
  const elapsed = startedAt ? Math.max(0, Math.floor((now.getTime() - startedAt) / 1000)) : 0;
  // Strop: cieľová dĺžka + 2 minúty rezervy na rozlúčku a oneskorenia.
  const billable = session.transport === "realtime" ? Math.min(elapsed, session.target_duration_seconds + 120) : 0;
  const newlyBilledSeconds = Math.max(0, billable - session.billed_seconds);

  const result = await getSupabaseAdmin()
    .from("training_sessions")
    .update({
      status: "completed",
      end_reason: endReason,
      ended_at: now.toISOString(),
      billed_seconds: Math.max(session.billed_seconds, billable),
      provider_usage: providerUsage ?? session.provider_usage,
    })
    .eq("id", session.id)
    .eq("user_id", session.user_id)
    .in("status", ["live", "ready"])
    .select("*")
    .single<SessionRow>();
  return { session: must(result, "sessions.finish"), newlyBilledSeconds };
}

export type SessionListItem = SessionRow & {
  projects: { name: string } | null;
  feedback_reports: Pick<ReportRow, "status"> | null;
};

export async function listSessions(options: {
  userId: string;
  projectId?: string;
  mode?: TrainingMode;
  limit?: number;
  onlyCompleted?: boolean;
}): Promise<SessionListItem[]> {
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("training_sessions")
    .select("*, projects(name), feedback_reports(status)")
    .eq("user_id", options.userId)
    .order("created_at", { ascending: false })
    .limit(options.limit ?? 50);
  if (options.projectId) query = query.eq("project_id", options.projectId);
  if (options.mode) query = query.eq("mode", options.mode);
  if (options.onlyCompleted) query = query.eq("status", "completed");
  const result = await query;
  return must(result, "sessions.list") as SessionListItem[];
}

export type SessionWithReport = SessionRow & {
  projects: { name: string } | null;
  feedback_reports: Pick<ReportRow, "status" | "measured" | "assessment"> | null;
};

/** Dokončené tréningy s meraniami a hodnotením (história, grafy, porovnanie). */
export async function listSessionsWithReports(userId: string, sessionIds?: string[]): Promise<SessionWithReport[]> {
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("training_sessions")
    .select("*, projects(name), feedback_reports(status, measured, assessment)")
    .eq("user_id", userId)
    .in("status", ["completed", "abandoned"])
    .order("created_at", { ascending: false })
    .limit(100);
  if (sessionIds) query = query.in("id", sessionIds);
  const result = await query;
  return must(result, "sessions.withReports") as SessionWithReport[];
}

export async function deleteSession(sessionId: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("training_sessions").delete().eq("id", sessionId).select("id");
  check({ error }, "sessions.delete");
  if (!data || data.length === 0) throw new DbError("forbidden", "Živý tréning nemožno zmazať.");
}

export async function getReport(sessionId: string): Promise<ReportRow | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("feedback_reports")
    .select("*")
    .eq("session_id", sessionId)
    .maybeSingle<ReportRow>();
  check({ error }, "reports.get");
  return data;
}

export async function createPendingReport(sessionId: string, userId: string): Promise<void> {
  const { error } = await getSupabaseAdmin()
    .from("feedback_reports")
    .upsert({ session_id: sessionId, user_id: userId, status: "pending" }, { onConflict: "session_id" });
  check({ error }, "reports.createPending");
}

export async function updateReport(
  sessionId: string,
  patch: Partial<Pick<ReportRow, "status" | "measured" | "assessment" | "model" | "prompt_version" | "error_code" | "attempts" | "completed_at">>,
): Promise<void> {
  const { error } = await getSupabaseAdmin().from("feedback_reports").update(patch).eq("session_id", sessionId);
  check({ error }, "reports.update");
}

/* Admin čítania pre generovanie reportu na pozadí (po overení vlastníctva pri finish). */

export async function adminGetSession(sessionId: string): Promise<SessionRow> {
  const result = await getSupabaseAdmin().from("training_sessions").select("*").eq("id", sessionId).single<SessionRow>();
  return must(result, "sessions.adminGet");
}

export async function adminListTurns(sessionId: string): Promise<TurnRow[]> {
  const result = await getSupabaseAdmin()
    .from("conversation_turns")
    .select("*")
    .eq("session_id", sessionId)
    .order("seq")
    .limit(2000);
  return must(result, "turns.adminList") as TurnRow[];
}

export async function adminListAudioMetrics(sessionId: string): Promise<AudioMetricsRow[]> {
  const result = await getSupabaseAdmin()
    .from("audio_delivery_metrics")
    .select("*")
    .eq("session_id", sessionId)
    .order("turn_seq")
    .limit(2000);
  return must(result, "audioMetrics.adminList") as AudioMetricsRow[];
}

export async function adminGetVisual(sessionId: string): Promise<VisualAnalyticsRow | null> {
  const { data, error } = await getSupabaseAdmin()
    .from("visual_analytics")
    .select("*")
    .eq("session_id", sessionId)
    .maybeSingle<VisualAnalyticsRow>();
  check({ error }, "visual.adminGet");
  return data;
}
