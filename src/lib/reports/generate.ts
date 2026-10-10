import "server-only";

import { getLlmProvider } from "@/lib/ai/llm/anthropic";
import { LlmError } from "@/lib/ai/llm/types";
import { checkEntitlement } from "@/lib/billing/plans";
import { fetchStartupContext } from "@/lib/db/context";
import { createExercisesFromReport } from "@/lib/db/exercises";
import {
  adminGetSession,
  adminGetVisual,
  adminListAudioMetrics,
  adminListTurns,
  updateReport,
} from "@/lib/db/sessions";
import { toNumber, type SessionRow } from "@/lib/db/types";
import { getAdminBillingContext, recordUsage } from "@/lib/db/usage-admin";
import { INVESTOR_STYLES, SCENARIOS, isInvestorKey, isScenarioKey } from "@/lib/investor/catalog";
import { ASSESSMENT_VERSION, assessmentSchema, validateAssessmentEvidence } from "@/lib/reports/assessment";
import { computeMeasurements } from "@/lib/reports/measured";
import { REPORT_SYSTEM, buildReportPrompt } from "@/lib/reports/prompt";
import { getAdminDb } from "@/lib/store/client";

/*
  Generovanie reportu na pozadí (after()). Vlastníctvo relácie overil route handler
  pred naplánovaním, preto sa tu číta admin klientom.

  Poradie: najprv objektívne merania (vždy, aj bez AI), potom AI hodnotenie obsahu.
  Ak AI nie je dostupná, report ostane s meraniami a stavom not_configured / failed.
*/

const MIN_FOUNDER_WORDS = 25;

function durationSeconds(session: SessionRow): number | null {
  if (!session.started_at || !session.ended_at) return null;
  return Math.max(0, Math.round((new Date(session.ended_at).getTime() - new Date(session.started_at).getTime()) / 1000));
}

export async function generateReport(sessionId: string): Promise<void> {
  const session = await adminGetSession(sessionId);
  const [turns, audio, visual] = await Promise.all([
    adminListTurns(sessionId),
    adminListAudioMetrics(sessionId),
    adminGetVisual(sessionId),
  ]);

  const scenario = isScenarioKey(session.scenario_key) ? SCENARIOS[session.scenario_key] : null;
  const style = isInvestorKey(session.investor_key) ? INVESTOR_STYLES[session.investor_key] : null;

  const measurements = computeMeasurements({
    transport: session.transport,
    durationSeconds: durationSeconds(session),
    targetAnswerSeconds: scenario?.targetAnswerSeconds ?? 60,
    turns: turns.map((turn) => ({
      seq: turn.seq,
      speaker: turn.speaker,
      text: turn.text,
      startedMs: turn.started_ms,
      endedMs: turn.ended_ms,
      interrupted: turn.interrupted,
      source: turn.source,
    })),
    audio: audio.map((row) => ({
      turnSeq: row.turn_seq,
      speechMs: row.speech_ms,
      wordsPerMinute: toNumber(row.words_per_minute),
      responseLatencyMs: row.response_latency_ms,
      pauseCount: row.pause_count,
      pauseTotalMs: row.pause_total_ms,
      longestPauseMs: row.longest_pause_ms,
      volumeVariability: toNumber(row.volume_variability),
      pitchVariabilitySemitones: toNumber(row.pitch_variability_semitones),
      pitchReliable: row.pitch_reliable,
      transcriptConfidence: toNumber(row.transcript_confidence),
    })),
    visual: visual
      ? {
          framesAnalyzed: visual.frames_analyzed,
          faceVisibleRatio: toNumber(visual.face_visible_ratio),
          faceCenteredRatio: toNumber(visual.face_centered_ratio),
          facingCameraRatio: toNumber(visual.facing_camera_ratio),
          gazeTowardCameraRatio: toNumber(visual.gaze_toward_camera_ratio),
          headMovementIndex: toNumber(visual.head_movement_index),
          upperBodyVisibleRatio: toNumber(visual.upper_body_visible_ratio),
          postureStabilityIndex: toNumber(visual.posture_stability_index),
          handsVisibleRatio: toNumber(visual.hands_visible_ratio),
          gestureActivityIndex: toNumber(visual.gesture_activity_index),
          framingIssues: visual.framing_issues,
        }
      : null,
  });

  await updateReport(sessionId, { status: "generating", measured: measurements as unknown as Record<string, unknown> });

  if (measurements.totals.founderWords < MIN_FOUNDER_WORDS || !style || !scenario) {
    await updateReport(sessionId, {
      status: "insufficient_data",
      completed_at: new Date().toISOString(),
      error_code: !style || !scenario ? "invalid_config" : "too_short",
    });
    return;
  }

  const llm = getLlmProvider();
  if (!llm) {
    await updateReport(sessionId, { status: "not_configured", completed_at: new Date().toISOString() });
    return;
  }

  const billing = await getAdminBillingContext(session.user_id);
  if (!checkEntitlement(billing.plan, billing.usage, "report").allowed) {
    await updateReport(sessionId, {
      status: "failed",
      error_code: "limit_reached",
      completed_at: new Date().toISOString(),
    });
    return;
  }

  const { context } = await fetchStartupContext(getAdminDb(), session.project_id);
  const transcript = turns.map((turn) => ({
    seq: turn.seq,
    speaker: turn.speaker,
    text: turn.text,
    interrupted: turn.interrupted,
  }));

  try {
    const result = await llm.generateStructured({
      purpose: "report",
      system: REPORT_SYSTEM,
      messages: [
        {
          role: "user",
          content: buildReportPrompt({ mode: session.mode, style, scenario, context, transcript, measurements }),
        },
      ],
      schema: assessmentSchema,
      effort: "high",
      maxTokens: 16_000,
    });

    const founderTurns = new Map(turns.filter((turn) => turn.speaker === "founder").map((turn) => [turn.seq, turn.text]));
    const investorSeqs = new Set(turns.filter((turn) => turn.speaker === "investor").map((turn) => turn.seq));
    const assessment = validateAssessmentEvidence(result.data, founderTurns, investorSeqs);

    await updateReport(sessionId, {
      status: "ready",
      assessment,
      model: result.model,
      prompt_version: ASSESSMENT_VERSION,
      completed_at: new Date().toISOString(),
      error_code: null,
    });
    await recordUsage(session.user_id, "report", 1, session.id);
    await createExercisesFromReport(session, assessment);
  } catch (error) {
    const code = error instanceof LlmError ? error.code : "unexpected";
    console.error("[report] generovanie zlyhalo:", code, error instanceof Error ? error.message.slice(0, 200) : "");
    await updateReport(sessionId, { status: "failed", error_code: code, completed_at: new Date().toISOString() });
  }
}

/** Bezpečný obal pre after(): chyba nesmie zhodiť proces, report ostane vo failed. */
export async function generateReportSafely(sessionId: string): Promise<void> {
  try {
    await generateReport(sessionId);
  } catch (error) {
    console.error("[report] neočakávaná chyba:", error instanceof Error ? error.message.slice(0, 200) : "");
    try {
      await updateReport(sessionId, { status: "failed", error_code: "unexpected", completed_at: new Date().toISOString() });
    } catch {
      // Ak zlyhá aj zápis stavu, report ostane v stave generating a dá sa spustiť znova.
    }
  }
}
