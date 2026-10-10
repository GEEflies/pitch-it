/*
  Rozhranie realtime hlasového poskytovateľa. Server vydá krátkodobé oprávnenie,
  klient si s ním otvorí spojenie. Aplikácia pracuje iba s normalizovanými udalosťami,
  takže výmena poskytovateľa znamená novú implementáciu, nie zmenu UI.
*/

export type RealtimeProviderId = "openai";

/** Ako má poskytovateľ reagovať na reč foundera. */
export type ListeningPolicy =
  /** Rozhovor: investor odpovedá po skončení ťahu, founder ho môže prerušiť. */
  | { kind: "conversation"; eagerness: "low" | "medium" | "high" | "auto" }
  /** Prednes: iba prepis, investor nereaguje. */
  | { kind: "listen_only" };

export type RealtimeSessionRequest = {
  instructions: string;
  voice: string;
  language: "sk" | "en";
  listening: ListeningPolicy;
  /** Bezpečný identifikátor používateľa pre poskytovateľa (hash, nie e-mail). */
  safetyIdentifier: string;
  tools: RealtimeToolDefinition[];
};

export type RealtimeToolDefinition = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
};

/** Čo dostane prehliadač. Nikdy neobsahuje API kľúč, iba krátkodobý token. */
export type RealtimeClientGrant = {
  provider: RealtimeProviderId;
  model: string;
  clientSecret: string;
  /** Unix čas v sekundách. */
  expiresAt: number;
};

export class RealtimeProviderError extends Error {
  constructor(
    readonly code: "not_configured" | "rate_limited" | "rejected" | "unavailable",
    message: string,
  ) {
    super(message);
    this.name = "RealtimeProviderError";
  }
}

export interface RealtimeProvider {
  readonly id: RealtimeProviderId;
  readonly model: string;
  createClientGrant(request: RealtimeSessionRequest): Promise<RealtimeClientGrant>;
}

/* ───────────── Normalizované udalosti na strane klienta ───────────── */

export type RealtimeEvent =
  | { type: "session_ready" }
  | { type: "founder_speech_started"; itemId: string }
  | { type: "founder_speech_stopped"; itemId: string }
  | { type: "founder_transcript_delta"; itemId: string; delta: string }
  | {
      type: "founder_transcript_final";
      itemId: string;
      text: string;
      logprobs: Array<{ logprob: number }> | null;
    }
  | { type: "founder_transcript_failed"; itemId: string }
  | { type: "investor_response_started"; responseId: string }
  | { type: "investor_transcript_delta"; itemId: string; responseId: string | null; delta: string }
  | { type: "investor_transcript_final"; itemId: string; text: string }
  | { type: "investor_audio_started"; responseId: string | null }
  | { type: "investor_audio_stopped"; responseId: string | null; cleared: boolean }
  | {
      type: "investor_response_done";
      responseId: string;
      status: "completed" | "cancelled" | "failed" | "incomplete" | string;
      usage: RealtimeUsage | null;
    }
  | { type: "tool_call"; name: string; callId: string; argumentsJson: string }
  | { type: "provider_error"; code: string | null; message: string };

export type RealtimeUsage = {
  inputTokens: number;
  outputTokens: number;
  inputAudioTokens: number;
  outputAudioTokens: number;
  cachedTokens: number;
};

export type ConnectionState = "connecting" | "connected" | "lost" | "closed";

export interface RealtimeConnection {
  connect(options: {
    grant: RealtimeClientGrant;
    microphone: MediaStreamTrack;
    output: HTMLAudioElement;
  }): Promise<void>;
  onEvent(listener: (event: RealtimeEvent) => void): () => void;
  onStateChange(listener: (state: ConnectionState) => void): () => void;
  /** Požiada investora o odpoveď s riadiacou poznámkou. */
  requestResponse(note: string): void;
  /** Pošle textovú správu foundera (napr. keď nefunguje mikrofón). */
  sendFounderText(text: string): void;
  /** Ukončí ťah foundera a nechá investora prerušiť (simulované prerušenie). */
  interruptFounder(note: string): void;
  /** Po prerušení vráti bežné správanie: founder môže opäť prerušiť investora. */
  restoreBargeIn(eagerness: "low" | "medium" | "high" | "auto"): void;
  /** Zastaví hovoriaceho investora. */
  cancelInvestor(): void;
  /** Potvrdí volanie nástroja. */
  acknowledgeTool(callId: string, output: string): void;
  setMicrophoneEnabled(enabled: boolean): void;
  close(): void;
}
