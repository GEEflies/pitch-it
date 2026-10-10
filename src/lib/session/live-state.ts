import type { RealtimeEvent } from "@/lib/ai/realtime/types";

/*
  Stavový automat živej relácie. Čistá funkcia: z udalostí poskytovateľa a lokálnych
  udalostí (pripojenie, výpadok, koniec) skladá fázu rozhovoru a ťahy prepisu.
*/

export type Speaker = "investor" | "founder";

export type LiveTurn = {
  seq: number;
  speaker: Speaker;
  itemId: string | null;
  responseId: string | null;
  text: string;
  final: boolean;
  interrupted: boolean;
  /** Prepis sa nepodaril (nezrozumiteľné audio). */
  failed: boolean;
  startedMs: number | null;
  endedMs: number | null;
  source: "realtime" | "text";
};

export type ConnectionStatus = "idle" | "connecting" | "live" | "reconnecting" | "ending" | "ended" | "failed";

export type Phase =
  | "idle"
  /** Investor pripravuje odpoveď. */
  | "investor_thinking"
  | "investor_speaking"
  /** Čaká sa na foundera. */
  | "listening"
  | "founder_speaking"
  /** Founder dohovoril, investor ešte nezačal. */
  | "processing";

export type LiveState = {
  status: ConnectionStatus;
  phase: Phase;
  turns: LiveTurn[];
  nextSeq: number;
  investorSpeaking: boolean;
  activeResponseId: string | null;
  founderItemId: string | null;
  lastInvestorEndMs: number | null;
  reconnectAttempts: number;
  error: string | null;
};

export type LiveAction =
  | { type: "connect_requested" }
  | { type: "connected" }
  | { type: "connection_lost" }
  | { type: "reconnect_failed"; message: string }
  | { type: "end_requested" }
  | { type: "ended" }
  | { type: "failed"; message: string }
  | { type: "dismiss_error" }
  | { type: "realtime"; event: RealtimeEvent; at: number }
  /** Ťah z textového režimu; seq prideľuje server. */
  | { type: "text_turn"; speaker: Speaker; text: string; at: number; seq: number }
  | { type: "investor_thinking" };

export const MAX_RECONNECT_ATTEMPTS = 3;

export function initialLiveState(): LiveState {
  return {
    status: "idle",
    phase: "idle",
    turns: [],
    nextSeq: 0,
    investorSpeaking: false,
    activeResponseId: null,
    founderItemId: null,
    lastInvestorEndMs: null,
    reconnectAttempts: 0,
    error: null,
  };
}

/** Začne novú reláciu s už uloženými ťahmi (napr. po obnovení stránky). */
export function stateWithHistory(turns: LiveTurn[]): LiveState {
  const state = initialLiveState();
  const sorted = [...turns].sort((a, b) => a.seq - b.seq);
  return { ...state, turns: sorted, nextSeq: sorted.length ? sorted[sorted.length - 1].seq + 1 : 0 };
}

function updateTurn(state: LiveState, predicate: (turn: LiveTurn) => boolean, patch: (turn: LiveTurn) => Partial<LiveTurn>): LiveState {
  let changed = false;
  const turns = state.turns.map((turn) => {
    if (!changed && predicate(turn)) {
      changed = true;
      return { ...turn, ...patch(turn) };
    }
    return turn;
  });
  return changed ? { ...state, turns } : state;
}

function appendTurn(state: LiveState, turn: Omit<LiveTurn, "seq">): LiveState {
  return { ...state, turns: [...state.turns, { ...turn, seq: state.nextSeq }], nextSeq: state.nextSeq + 1 };
}

function findLast(turns: LiveTurn[], predicate: (turn: LiveTurn) => boolean): LiveTurn | undefined {
  for (let i = turns.length - 1; i >= 0; i -= 1) if (predicate(turns[i])) return turns[i];
  return undefined;
}

function ensureInvestorTurn(state: LiveState, itemId: string, responseId: string | null, at: number): LiveState {
  if (state.turns.some((turn) => turn.itemId === itemId)) return state;
  return appendTurn(state, {
    speaker: "investor",
    itemId,
    responseId,
    text: "",
    final: false,
    interrupted: false,
    failed: false,
    startedMs: at,
    endedMs: null,
    source: "realtime",
  });
}

function ensureFounderTurn(state: LiveState, itemId: string, at: number): LiveState {
  if (state.turns.some((turn) => turn.itemId === itemId)) return state;
  return appendTurn(state, {
    speaker: "founder",
    itemId,
    responseId: null,
    text: "",
    final: false,
    interrupted: false,
    failed: false,
    startedMs: at,
    endedMs: null,
    source: "realtime",
  });
}

function settlePhase(state: LiveState): Phase {
  if (state.founderItemId) return "founder_speaking";
  if (state.investorSpeaking) return "investor_speaking";
  if (state.activeResponseId) return "investor_thinking";
  return "listening";
}

function reduceRealtime(state: LiveState, event: RealtimeEvent, at: number): LiveState {
  switch (event.type) {
    case "session_ready":
      return state;

    case "founder_speech_started": {
      const next = ensureFounderTurn(state, event.itemId, at);
      return { ...next, founderItemId: event.itemId, phase: "founder_speaking" };
    }
    case "founder_speech_stopped": {
      const next = updateTurn(state, (turn) => turn.itemId === event.itemId, () => ({ endedMs: at }));
      const founderItemId = next.founderItemId === event.itemId ? null : next.founderItemId;
      const settled = { ...next, founderItemId };
      return { ...settled, phase: settled.activeResponseId || settled.investorSpeaking ? settlePhase(settled) : "processing" };
    }
    case "founder_transcript_delta": {
      const next = ensureFounderTurn(state, event.itemId, at);
      return updateTurn(next, (turn) => turn.itemId === event.itemId && !turn.final, (turn) => ({
        text: turn.text + event.delta,
      }));
    }
    case "founder_transcript_final": {
      const next = ensureFounderTurn(state, event.itemId, at);
      return updateTurn(next, (turn) => turn.itemId === event.itemId, (turn) => ({
        text: event.text.trim(),
        final: true,
        endedMs: turn.endedMs ?? at,
      }));
    }
    case "founder_transcript_failed": {
      const next = ensureFounderTurn(state, event.itemId, at);
      return updateTurn(next, (turn) => turn.itemId === event.itemId, (turn) => ({
        final: true,
        failed: true,
        endedMs: turn.endedMs ?? at,
      }));
    }

    case "investor_response_started": {
      const next = { ...state, activeResponseId: event.responseId };
      return { ...next, phase: settlePhase(next) };
    }
    case "investor_transcript_delta": {
      const next = ensureInvestorTurn(state, event.itemId, event.responseId, at);
      return updateTurn(next, (turn) => turn.itemId === event.itemId && !turn.final, (turn) => ({
        text: turn.text + event.delta,
        responseId: turn.responseId ?? event.responseId,
      }));
    }
    case "investor_transcript_final": {
      const next = ensureInvestorTurn(state, event.itemId, state.activeResponseId, at);
      return updateTurn(next, (turn) => turn.itemId === event.itemId, () => ({
        text: event.text.trim(),
        final: true,
      }));
    }
    case "investor_audio_started": {
      const next = { ...state, investorSpeaking: true };
      const withStart = updateTurn(
        next,
        (turn) => turn.speaker === "investor" && turn.responseId === (event.responseId ?? state.activeResponseId) && turn.startedMs === null,
        () => ({ startedMs: at }),
      );
      return { ...withStart, phase: settlePhase(withStart) };
    }
    case "investor_audio_stopped": {
      const last = findLast(state.turns, (turn) => turn.speaker === "investor");
      let next: LiveState = { ...state, investorSpeaking: false, lastInvestorEndMs: at };
      if (last) {
        next = updateTurn(next, (turn) => turn.seq === last.seq, (turn) => ({
          endedMs: at,
          interrupted: turn.interrupted || event.cleared,
        }));
      }
      return { ...next, phase: settlePhase(next) };
    }
    case "investor_response_done": {
      const cancelled = event.status === "cancelled" || event.status === "incomplete";
      let next: LiveState = state;
      for (const turn of state.turns) {
        if (turn.speaker === "investor" && turn.responseId === event.responseId && !turn.final) {
          next = updateTurn(next, (candidate) => candidate.seq === turn.seq, (candidate) => ({
            final: true,
            interrupted: candidate.interrupted || cancelled,
            endedMs: candidate.endedMs ?? at,
          }));
        }
      }
      const activeResponseId = next.activeResponseId === event.responseId ? null : next.activeResponseId;
      const settled = { ...next, activeResponseId };
      return { ...settled, phase: settlePhase(settled) };
    }

    case "tool_call":
      return state;

    case "provider_error":
      return { ...state, error: event.message };
  }
}

export function liveReducer(state: LiveState, action: LiveAction): LiveState {
  switch (action.type) {
    case "connect_requested":
      return { ...state, status: "connecting", error: null };

    case "connected":
      return {
        ...state,
        status: "live",
        reconnectAttempts: 0,
        error: null,
        phase: state.phase === "idle" ? "investor_thinking" : settlePhase(state),
      };

    case "connection_lost": {
      if (state.status === "ending" || state.status === "ended") return state;
      const attempts = state.reconnectAttempts + 1;
      // Rozpracované ťahy uzavrieme, aby sa uložilo aspoň to, čo zaznelo.
      const turns = state.turns.map((turn) =>
        turn.final ? turn : { ...turn, final: true, interrupted: true, endedMs: turn.endedMs ?? null },
      );
      return {
        ...state,
        turns,
        status: attempts > MAX_RECONNECT_ATTEMPTS ? "failed" : "reconnecting",
        reconnectAttempts: attempts,
        phase: "idle",
        investorSpeaking: false,
        activeResponseId: null,
        founderItemId: null,
        error:
          attempts > MAX_RECONNECT_ATTEMPTS
            ? "Spojenie sa nepodarilo obnoviť. Môžeš pokračovať v textovom režime alebo tréning ukončiť."
            : null,
      };
    }

    case "reconnect_failed":
      return state.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS
        ? { ...state, status: "failed", error: action.message }
        : { ...state, status: "reconnecting", error: action.message };

    case "end_requested":
      return { ...state, status: "ending" };

    case "ended": {
      const turns = state.turns.map((turn) => (turn.final ? turn : { ...turn, final: true }));
      return { ...state, turns, status: "ended", phase: "idle", investorSpeaking: false, founderItemId: null };
    }

    case "failed":
      return { ...state, status: "failed", error: action.message, phase: "idle", investorSpeaking: false };

    case "dismiss_error":
      return { ...state, error: null };

    case "investor_thinking":
      return { ...state, phase: "investor_thinking" };

    case "text_turn": {
      if (state.turns.some((turn) => turn.seq === action.seq)) return state;
      const turn: LiveTurn = {
        seq: action.seq,
        speaker: action.speaker,
        itemId: null,
        responseId: null,
        text: action.text.trim(),
        final: true,
        interrupted: false,
        failed: false,
        startedMs: action.at,
        endedMs: action.at,
        source: "text",
      };
      const next = {
        ...state,
        turns: [...state.turns, turn].sort((a, b) => a.seq - b.seq),
        nextSeq: Math.max(state.nextSeq, action.seq + 1),
      };
      return {
        ...next,
        status: state.status === "idle" || state.status === "connecting" ? "live" : state.status,
        phase: action.speaker === "founder" ? "investor_thinking" : "listening",
        lastInvestorEndMs: action.speaker === "investor" ? action.at : state.lastInvestorEndMs,
      };
    }

    case "realtime":
      if (state.status === "ended" || state.status === "failed") return state;
      return reduceRealtime(state, action.event, action.at);
  }
}

/** Ťahy, ktoré sú hotové a ešte neboli uložené. */
export function turnsReadyToPersist(state: LiveState, isKnown: (seq: number) => boolean): LiveTurn[] {
  return state.turns.filter(
    (turn) => turn.final && !isKnown(turn.seq) && (turn.text.length > 0 || turn.failed || turn.interrupted),
  );
}
