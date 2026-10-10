import "server-only";

import { createHash, createHmac } from "node:crypto";
import { getLlmProvider } from "@/lib/ai/llm/anthropic";
import { LlmError } from "@/lib/ai/llm/types";
import { getRealtimeProvider } from "@/lib/ai/realtime/openai-server";
import { RealtimeProviderError, type ListeningPolicy, type RealtimeClientGrant } from "@/lib/ai/realtime/types";
import { countFillers, countWords, wordsPerMinute } from "@/lib/analytics/speech/text-metrics";
import { checkEntitlement, remainingRealtimeSeconds } from "@/lib/billing/plans";
import { getHashSalt } from "@/config/server-env";
import { DbError } from "@/lib/db/core";
import { loadStartupContext } from "@/lib/db/projects";
import {
  closeStaleSessions,
  createPendingReport,
  finishSession,
  getOwnedSession,
  insertTurns,
  listTurns,
  markSessionLive,
  saveVisualAnalytics,
  touchHeartbeat,
  upsertAudioMetrics,
  type FounderMetricsRecord,
} from "@/lib/db/sessions";
import type { SessionRow, TurnRow } from "@/lib/db/types";
import { getBillingContext, recordUsage } from "@/lib/db/usage";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { trackEvent } from "@/lib/events/track";
import { INVESTOR_STYLES, SCENARIOS, isInvestorKey, isScenarioKey } from "@/lib/investor/catalog";
import { buildHintPrompt, HINT_SYSTEM, hintSchema, type Hint } from "@/lib/investor/hints";
import { buildInvestorInstructions, END_MEETING_TOOL, type TranscriptLine } from "@/lib/investor/instructions";
import { TEXT_CHANNEL_SUFFIX, textInvestorSchema, transcriptToMessages } from "@/lib/investor/text-investor";
import { TIME_WARNING_BEFORE_END_SECONDS } from "@/lib/investor/control";
import type { FinishRequest, TurnPayload } from "@/lib/validation/schemas";

/*
  Serverová logika živej relácie. Každá funkcia najprv overí vlastníctvo relácie
  (getOwnedSession cez RLS), až potom robí systémové zápisy.
*/

export class SessionServiceError extends Error {
  constructor(
    readonly code:
      | "not_found"
      | "session_closed"
      | "limit_reached"
      | "too_many_connections"
      | "realtime_not_configured"
      | "llm_not_configured"
      | "provider_unavailable"
      | "invalid_mode"
      | "rate_limited",
    message: string,
    readonly status = 400,
  ) {
    super(message);
    this.name = "SessionServiceError";
  }
}

const MAX_CONNECTIONS_PER_SESSION = 8;
const MIN_SECONDS_TO_CONNECT = 15;
const MAX_TEXT_TURNS_PER_SESSION = 60;

async function loadOwnedSession(sessionId: string, userId: string): Promise<SessionRow> {
  try {
    return await getOwnedSession(sessionId, userId);
  } catch (error) {
    if (error instanceof DbError && error.code === "not_found") {
      throw new SessionServiceError("not_found", "Tréning neexistuje.", 404);
    }
    throw error;
  }
}

function ensureOpen(session: SessionRow) {
  if (session.status !== "ready" && session.status !== "live") {
    throw new SessionServiceError("session_closed", "Tento tréning už skončil.", 409);
  }
}

/** Stabilný pseudonymný identifikátor pre poskytovateľa AI (nie e-mail, nie surové ID). */
export function safetyIdentifier(userId: string): string {
  const salt = getHashSalt();
  return salt
    ? createHmac("sha256", salt).update(userId).digest("hex")
    : createHash("sha256").update(`pitch-it:${userId}`).digest("hex");
}

function styleAndScenario(session: SessionRow) {
  if (!isInvestorKey(session.investor_key) || !isScenarioKey(session.scenario_key)) {
    throw new SessionServiceError("invalid_mode", "Konfigurácia tréningu nie je platná.");
  }
  return { style: INVESTOR_STYLES[session.investor_key], scenario: SCENARIOS[session.scenario_key] };
}

function toTranscript(turns: TurnRow[]): TranscriptLine[] {
  return turns.map((turn) => ({ speaker: turn.speaker, text: turn.text }));
}

function elapsedSeconds(session: SessionRow, now = Date.now()): number {
  return session.started_at ? Math.max(0, Math.floor((now - new Date(session.started_at).getTime()) / 1000)) : 0;
}

export type ConnectResult = {
  grant: RealtimeClientGrant;
  /** Koľko sekúnd od začiatku relácie smie relácia trvať. */
  sessionLimitSeconds: number;
  elapsedSeconds: number;
  listening: ListeningPolicy;
  interruptAfterSeconds: number | null;
  targetAnswerSeconds: number;
  timeWarningAtSeconds: number;
};

export async function connectRealtime(userId: string, sessionId: string, resume: boolean): Promise<ConnectResult> {
  if (!resume) await closeStaleSessions(userId);
  const session = await loadOwnedSession(sessionId, userId);
  ensureOpen(session);
  if (session.connection_count >= MAX_CONNECTIONS_PER_SESSION) {
    throw new SessionServiceError("too_many_connections", "Príliš veľa pokusov o pripojenie. Pokračuj v textovom režime.", 429);
  }

  const provider = getRealtimeProvider();
  if (!provider) {
    throw new SessionServiceError("realtime_not_configured", "Hlasový režim nie je nakonfigurovaný.", 503);
  }

  const billing = await getBillingContext(userId);
  const elapsed = elapsedSeconds(session);
  // Bežiaca relácia ešte nie je vyúčtovaná, preto ju odpočítame od zostatku.
  const quotaLeft = remainingRealtimeSeconds(billing.plan, billing.usage) - (session.status === "live" ? elapsed : 0);
  const planCap = billing.plan.limits.maxSessionMinutes * 60;
  const sessionLimitSeconds = Math.min(session.target_duration_seconds, planCap, elapsed + Math.max(0, quotaLeft));
  if (sessionLimitSeconds - elapsed < MIN_SECONDS_TO_CONNECT) {
    throw new SessionServiceError("limit_reached", "Minúty hlasového tréningu sú na tento mesiac vyčerpané.", 402);
  }

  const { style, scenario } = styleAndScenario(session);
  const { context } = await loadStartupContext(session.project_id);
  const turns = resume || session.status === "live" ? await listTurns(session.id) : [];

  const listening: ListeningPolicy =
    session.mode === "delivery"
      ? { kind: "listen_only" }
      : { kind: "conversation", eagerness: scenario.key === "demo_day_qa" ? "medium" : "low" };

  const instructions = buildInvestorInstructions({
    style,
    scenario,
    mode: session.mode,
    context,
    durationMinutes: Math.round(session.target_duration_seconds / 60),
    channel: "voice",
    resumeTranscript: turns.length > 0 ? toTranscript(turns) : undefined,
  });

  let grant: RealtimeClientGrant;
  try {
    grant = await provider.createClientGrant({
      instructions,
      voice: style.voice,
      language: session.language,
      listening,
      safetyIdentifier: safetyIdentifier(userId),
      tools:
        session.mode === "delivery"
          ? []
          : [
              {
                name: END_MEETING_TOOL,
                description: "Ukončí investorské stretnutie po rozlúčke.",
                parameters: {
                  type: "object",
                  properties: { dovod: { type: "string", description: "Krátky dôvod ukončenia." } },
                  required: [],
                  additionalProperties: false,
                },
              },
            ],
    });
  } catch (error) {
    if (error instanceof RealtimeProviderError) {
      console.error("[realtime] grant zlyhal:", error.code, error.message.slice(0, 200));
      throw new SessionServiceError(
        error.code === "rate_limited" ? "rate_limited" : "provider_unavailable",
        "Hlasová služba je momentálne nedostupná. Skús to o chvíľu alebo pokračuj textom.",
        503,
      );
    }
    throw error;
  }

  const live = await markSessionLive(session, { id: provider.id, model: provider.model }, "realtime");
  if (session.status === "ready") {
    await trackEvent(userId, "session_started", {
      mode: session.mode,
      investor: session.investor_key,
      scenario: session.scenario_key,
      transport: "realtime",
      repeated: Boolean(session.previous_session_id),
    });
    if (session.previous_session_id) await trackEvent(userId, "session_repeated", { mode: session.mode });
  }

  return {
    grant,
    sessionLimitSeconds,
    elapsedSeconds: elapsedSeconds(live),
    listening,
    interruptAfterSeconds: session.mode === "delivery" ? null : style.interruptAfterSeconds,
    targetAnswerSeconds: scenario.targetAnswerSeconds,
    timeWarningAtSeconds: Math.max(0, sessionLimitSeconds - TIME_WARNING_BEFORE_END_SECONDS),
  };
}

/** Uloží dokončené ťahy a merania founderových ťahov. */
export async function recordTurns(userId: string, sessionId: string, turns: TurnPayload[]): Promise<void> {
  const session = await loadOwnedSession(sessionId, userId);
  if (session.status !== "live") {
    throw new SessionServiceError("session_closed", "Tréning neprebieha, ťahy sa nedajú uložiť.", 409);
  }
  await insertTurns(session.id, userId, turns);

  const metrics: FounderMetricsRecord[] = turns
    .filter((turn) => turn.speaker === "founder" && turn.metrics)
    .map((turn) => {
      const fillers = countFillers(turn.text);
      const words = countWords(turn.text);
      return {
        turnSeq: turn.seq,
        wordCount: words,
        wordsPerMinute: wordsPerMinute(words, turn.metrics!.speechMs),
        fillerCount: fillers.total,
        fillers: fillers.byPhrase,
        metrics: turn.metrics!,
      };
    });
  await upsertAudioMetrics(session.id, userId, metrics);
  await touchHeartbeat(session.id, userId);
}

export async function heartbeat(userId: string, sessionId: string): Promise<void> {
  const session = await loadOwnedSession(sessionId, userId);
  if (session.status === "live") await touchHeartbeat(session.id, userId);
}

export type FinishOutcome = { session: SessionRow; reportQueued: boolean };

/** Ukončí reláciu, vyúčtuje čas a založí report. Idempotentné. */
export async function finishTraining(userId: string, sessionId: string, request: FinishRequest): Promise<FinishOutcome> {
  const session = await loadOwnedSession(sessionId, userId);
  if (session.status === "completed") return { session, reportQueued: false };
  if (session.status !== "live" && session.status !== "ready") {
    throw new SessionServiceError("session_closed", "Tréning už bol uzavretý.", 409);
  }

  const { session: finished, newlyBilledSeconds } = await finishSession(
    session,
    request.endReason,
    request.providerUsage ? { ...request.providerUsage, model: session.realtime_model } : null,
  );
  await recordUsage(userId, "realtime_seconds", newlyBilledSeconds, session.id);

  if (request.visual && session.camera_enabled && request.visual.framesAnalyzed > 0) {
    await saveVisualAnalytics(session.id, userId, request.visual);
  }

  await createPendingReport(session.id, userId);
  if (session.exercise_id) {
    // Mini simulácia alebo prednes z cvičenia: absolvovanie uzavrie cvičenie.
    await getSupabaseAdmin()
      .from("exercises")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", session.exercise_id)
      .eq("user_id", userId)
      .eq("status", "open");
  }
  await trackEvent(userId, "session_completed", {
    mode: session.mode,
    end_reason: request.endReason,
    duration_s: elapsedSeconds(session),
    camera: session.camera_enabled,
  });
  return { session: finished, reportQueued: true };
}

export type TextTurnResult = {
  founder: { seq: number; text: string } | null;
  investor: { seq: number; text: string };
  ended: boolean;
};

/** Jeden ťah textového režimu: uloží odpoveď foundera a vygeneruje repliku investora. */
export async function textTurn(userId: string, sessionId: string, message: string | null): Promise<TextTurnResult> {
  let session = await loadOwnedSession(sessionId, userId);
  ensureOpen(session);
  if (session.mode === "delivery") {
    throw new SessionServiceError("invalid_mode", "Prednes pitchu v textovom režime nie je dostupný.");
  }

  const llm = getLlmProvider();
  if (!llm) throw new SessionServiceError("llm_not_configured", "Textový režim nie je nakonfigurovaný.", 503);

  const billing = await getBillingContext(userId);
  const entitlement = checkEntitlement(billing.plan, billing.usage, "text_turn");
  if (!entitlement.allowed) {
    throw new SessionServiceError("limit_reached", "Limit textových ťahov je na tento mesiac vyčerpaný.", 402);
  }

  if (session.status === "ready") {
    session = await markSessionLive(session, null, "text");
    await trackEvent(userId, "session_started", {
      mode: session.mode,
      investor: session.investor_key,
      scenario: session.scenario_key,
      transport: "text",
      repeated: Boolean(session.previous_session_id),
    });
  }

  const turns = await listTurns(session.id);
  if (turns.length >= MAX_TEXT_TURNS_PER_SESSION) {
    throw new SessionServiceError("limit_reached", "Tento tréning dosiahol maximálny počet ťahov. Ukonči ho a pozri si report.", 409);
  }
  let nextSeq = turns.length > 0 ? turns[turns.length - 1].seq + 1 : 0;
  const elapsed = elapsedSeconds(session);

  let founder: TextTurnResult["founder"] = null;
  const transcript = toTranscript(turns);
  if (message && message.trim()) {
    founder = { seq: nextSeq, text: message.trim() };
    await insertTurns(session.id, userId, [
      {
        seq: nextSeq,
        speaker: "founder",
        text: founder.text,
        startedMs: elapsed * 1000,
        endedMs: elapsed * 1000,
        interrupted: false,
        source: "text",
        providerItemId: null,
        metrics: null,
      },
    ]);
    transcript.push({ speaker: "founder", text: founder.text });
    nextSeq += 1;
  }

  const { style, scenario } = styleAndScenario(session);
  const { context } = await loadStartupContext(session.project_id);
  const system =
    buildInvestorInstructions({
      style,
      scenario,
      mode: session.mode,
      context,
      durationMinutes: Math.round(session.target_duration_seconds / 60),
      channel: "text",
    }) + TEXT_CHANNEL_SUFFIX;

  const limit = session.target_duration_seconds;
  let reply;
  try {
    reply = await llm.generateStructured({
      purpose: "text_investor",
      system,
      messages: transcriptToMessages(transcript, {
        timeUp: elapsed >= limit,
        timeAlmostUp: elapsed >= limit - TIME_WARNING_BEFORE_END_SECONDS,
      }),
      schema: textInvestorSchema,
      effort: "low",
      maxTokens: 2_000,
      speed: "interactive",
    });
  } catch (error) {
    if (error instanceof LlmError) {
      console.error("[text-investor]", error.code);
      throw new SessionServiceError("provider_unavailable", "Investor teraz neodpovedá. Skús odoslať správu znova.", 503);
    }
    throw error;
  }

  const investorText = reply.data.reply.trim();
  await insertTurns(session.id, userId, [
    {
      seq: nextSeq,
      speaker: "investor",
      text: investorText,
      startedMs: elapsedSeconds(session) * 1000,
      endedMs: elapsedSeconds(session) * 1000,
      interrupted: false,
      source: "text",
      providerItemId: null,
      metrics: null,
    },
  ]);
  await recordUsage(userId, "text_turn", 1, session.id);
  await touchHeartbeat(session.id, userId);

  return { founder, investor: { seq: nextSeq, text: investorText }, ended: reply.data.end_meeting };
}

/** Nápoveda k otázke investora (iba režim tréningu). */
export async function generateHint(userId: string, sessionId: string, question: string): Promise<Hint> {
  const session = await loadOwnedSession(sessionId, userId);
  ensureOpen(session);
  if (session.mode !== "coach") {
    throw new SessionServiceError("invalid_mode", "Nápoveda je dostupná iba v režime tréningu s nápovedou.");
  }
  const llm = getLlmProvider();
  if (!llm) throw new SessionServiceError("llm_not_configured", "Nápoveda nie je nakonfigurovaná.", 503);

  const billing = await getBillingContext(userId);
  if (!checkEntitlement(billing.plan, billing.usage, "hint").allowed) {
    throw new SessionServiceError("limit_reached", "Limit nápovied je na tento mesiac vyčerpaný.", 402);
  }

  const { context } = await loadStartupContext(session.project_id);
  try {
    const result = await llm.generateStructured({
      purpose: "hint",
      system: HINT_SYSTEM,
      messages: [{ role: "user", content: buildHintPrompt(question, context) }],
      schema: hintSchema,
      effort: "low",
      maxTokens: 2_000,
      speed: "interactive",
    });
    await recordUsage(userId, "hint", 1, session.id);
    return result.data;
  } catch (error) {
    if (error instanceof LlmError) {
      console.error("[hint]", error.code);
      throw new SessionServiceError("provider_unavailable", "Nápovedu sa nepodarilo pripraviť. Skús to znova.", 503);
    }
    throw error;
  }
}
