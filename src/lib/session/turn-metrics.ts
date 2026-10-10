import { responseLatencyMs, summarizeVoice, type VoiceFrame } from "@/lib/analytics/audio/voice-summary";
import type { LiveTurn } from "@/lib/session/live-state";
import type { FounderTurnMetrics, TurnPayload } from "@/lib/validation/schemas";

/*
  Zostavenie meraní pre ťah foundera z rámcov mikrofónu a časov udalostí.
  Okno je o kúsok širšie ako udalosti VAD, ktoré prichádzajú s oneskorením.
*/

const LEAD_MS = 1_500;
const TAIL_MS = 400;
const CONTEXT_MS = 30_000;

function previousInvestorEnd(turns: LiveTurn[], seq: number): number | null {
  for (let i = turns.length - 1; i >= 0; i -= 1) {
    const turn = turns[i];
    if (turn.seq < seq && turn.speaker === "investor") return turn.endedMs;
  }
  return null;
}

export function buildFounderMetrics(
  turn: LiveTurn,
  allTurns: LiveTurn[],
  frames: VoiceFrame[],
  transcriptConfidence: number | null,
): FounderTurnMetrics | null {
  if (turn.speaker !== "founder" || turn.source !== "realtime" || turn.startedMs === null) return null;
  const end = turn.endedMs ?? turn.startedMs;
  const start = Math.max(0, turn.startedMs - LEAD_MS);
  const windowFrames = frames.filter((frame) => frame.t >= start && frame.t < end + TAIL_MS);
  const context = frames.filter((frame) => frame.t >= start - CONTEXT_MS && frame.t < start);
  const summary = summarizeVoice(windowFrames, start, end + TAIL_MS, context);

  // Ak lokálna detekcia reč nezachytila (napr. nefunkčný analyzátor), použijeme čas z VAD poskytovateľa.
  const fallbackMs = Math.max(0, end - turn.startedMs);
  const speechMs = summary.speechMs > 0 ? summary.speechMs : fallbackMs;
  const investorEnd = previousInvestorEnd(allTurns, turn.seq);

  return {
    speechMs: Math.round(speechMs),
    pauseCount: summary.pauseCount,
    pauseTotalMs: Math.round(summary.pauseTotalMs),
    longestPauseMs: Math.round(summary.longestPauseMs),
    responseLatencyMs:
      investorEnd !== null && summary.segments.length > 0
        ? responseLatencyMs(investorEnd, summary.segments)
        : null,
    volumeVariabilityDb: summary.volumeVariabilityDb,
    pitchVariabilitySemitones: summary.pitchVariabilitySemitones,
    pitchReliable: summary.pitchReliable,
    transcriptConfidence,
  };
}

export function toTurnPayload(turn: LiveTurn, metrics: FounderTurnMetrics | null): TurnPayload {
  const clampMs = (value: number | null) => (value === null ? null : Math.max(0, Math.round(value)));
  return {
    seq: turn.seq,
    speaker: turn.speaker,
    text: turn.text.slice(0, 20_000),
    startedMs: clampMs(turn.startedMs),
    endedMs: clampMs(turn.endedMs),
    interrupted: turn.interrupted,
    source: turn.source,
    providerItemId: turn.itemId,
    metrics,
  };
}
