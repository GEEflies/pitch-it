import "server-only";

import { getOpenAiRealtimeConfig, type OpenAiRealtimeConfig } from "@/config/server-env";
import {
  RealtimeProviderError,
  type RealtimeClientGrant,
  type RealtimeProvider,
  type RealtimeSessionRequest,
} from "@/lib/ai/realtime/types";

const CLIENT_SECRETS_URL = "https://api.openai.com/v1/realtime/client_secrets";
/** Token slúži iba na nadviazanie spojenia; relácia potom beží ďalej. */
const GRANT_TTL_SECONDS = 120;
const REQUEST_TIMEOUT_MS = 10_000;

type ClientSecretResponse = { value?: unknown; expires_at?: unknown };

/** Telo požiadavky na krátkodobý token (exportované kvôli testom). */
export function buildClientSecretBody(config: OpenAiRealtimeConfig, request: RealtimeSessionRequest) {
  const turnDetection =
    request.listening.kind === "conversation"
      ? {
          type: "semantic_vad",
          eagerness: request.listening.eagerness,
          create_response: true,
          interrupt_response: true,
        }
      : {
          type: "semantic_vad",
          eagerness: "low",
          create_response: false,
          interrupt_response: false,
        };

  return {
    expires_after: { anchor: "created_at", seconds: GRANT_TTL_SECONDS },
    session: {
      type: "realtime",
      model: config.model,
      instructions: request.instructions,
      output_modalities: ["audio"],
      max_output_tokens: 1024,
      audio: {
        input: {
          noise_reduction: { type: "near_field" },
          transcription: { model: config.transcriptionModel, language: request.language },
          turn_detection: turnDetection,
        },
        output: { voice: request.voice },
      },
      tools: request.tools.map((tool) => ({
        type: "function",
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      })),
      tool_choice: request.tools.length > 0 ? "auto" : "none",
      include: ["item.input_audio_transcription.logprobs"],
    },
  };
}

export class OpenAiRealtimeProvider implements RealtimeProvider {
  readonly id = "openai" as const;

  constructor(private readonly config: OpenAiRealtimeConfig) {}

  get model(): string {
    return this.config.model;
  }

  async createClientGrant(request: RealtimeSessionRequest): Promise<RealtimeClientGrant> {
    let response: Response;
    try {
      response = await fetch(CLIENT_SECRETS_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          "Content-Type": "application/json",
          "OpenAI-Safety-Identifier": request.safetyIdentifier,
        },
        body: JSON.stringify(buildClientSecretBody(this.config, request)),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        cache: "no-store",
      });
    } catch (error) {
      throw new RealtimeProviderError(
        "unavailable",
        error instanceof Error ? error.message : "Spojenie s poskytovateľom zlyhalo.",
      );
    }

    if (!response.ok) {
      // Telo chyby nelogujeme celé: môže obsahovať časť inštrukcií.
      const code = response.status === 429 ? "rate_limited" : response.status >= 500 ? "unavailable" : "rejected";
      const detail = await response.text().catch(() => "");
      throw new RealtimeProviderError(code, `OpenAI client_secrets ${response.status}: ${detail.slice(0, 300)}`);
    }

    const data = (await response.json()) as ClientSecretResponse;
    if (typeof data.value !== "string" || !data.value.startsWith("ek_")) {
      throw new RealtimeProviderError("unavailable", "Poskytovateľ nevrátil platný krátkodobý token.");
    }
    return {
      provider: "openai",
      model: this.config.model,
      clientSecret: data.value,
      expiresAt:
        typeof data.expires_at === "number" ? data.expires_at : Math.floor(Date.now() / 1000) + GRANT_TTL_SECONDS,
    };
  }
}

/** Aktuálny realtime poskytovateľ alebo null, ak nie je nakonfigurovaný. */
export function getRealtimeProvider(): RealtimeProvider | null {
  const config = getOpenAiRealtimeConfig();
  return config ? new OpenAiRealtimeProvider(config) : null;
}
