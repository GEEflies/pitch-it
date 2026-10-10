import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { getAnthropicConfig, type AnthropicConfig } from "@/config/server-env";
import { LlmError, type LlmProvider, type StructuredRequest, type StructuredResult } from "@/lib/ai/llm/types";

/*
  Claude cez oficiálne SDK. Štruktúrovaný výstup (zod) a server-side fallback
  pri odmietnutí z bezpečnostných dôvodov ("default" podľa kategórie).
*/

const FALLBACK_BETA = "server-side-fallback-2026-07-01";

export class AnthropicLlmProvider implements LlmProvider {
  readonly id = "anthropic";
  private readonly client: Anthropic;

  constructor(private readonly config: AnthropicConfig) {
    this.client = new Anthropic({
      ...(config.apiKey ? { apiKey: config.apiKey } : {}),
      maxRetries: 2,
      timeout: 5 * 60 * 1000,
    });
  }

  async generateStructured<T>(request: StructuredRequest<T>): Promise<StructuredResult<T>> {
    const model = request.speed === "interactive" ? this.config.fastModel : this.config.model;

    const content = (message: StructuredRequest<T>["messages"][number], index: number) => {
      // Dokumenty patria pred text prvej správy používateľa.
      if (index === 0 && message.role === "user" && request.documents?.length) {
        return [
          ...request.documents.map((document) => ({
            type: "document" as const,
            title: document.title,
            source: { type: "base64" as const, media_type: "application/pdf" as const, data: document.base64 },
          })),
          { type: "text" as const, text: message.content },
        ];
      }
      return message.content;
    };

    try {
      const response = await this.client.beta.messages.parse({
        model,
        max_tokens: request.maxTokens ?? 16_000,
        betas: [FALLBACK_BETA],
        fallbacks: "default",
        system: request.system,
        messages: request.messages.map((message, index) => ({ role: message.role, content: content(message, index) })),
        output_config: {
          effort: request.effort ?? "medium",
          format: betaZodOutputFormat(request.schema),
        },
      });

      if (response.stop_reason === "refusal") {
        throw new LlmError("refusal", "Model požiadavku odmietol.");
      }
      if (response.stop_reason === "max_tokens") {
        throw new LlmError("invalid_output", "Odpoveď modelu bola príliš dlhá a skrátila sa.");
      }
      if (response.parsed_output === null || response.parsed_output === undefined) {
        throw new LlmError("invalid_output", "Model nevrátil platný štruktúrovaný výstup.");
      }

      return {
        data: response.parsed_output as T,
        model: response.model,
        usage: { inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens },
      };
    } catch (error) {
      if (error instanceof LlmError) throw error;
      if (error instanceof Anthropic.RateLimitError) throw new LlmError("rate_limited", "Limit volaní AI je dočasne vyčerpaný.");
      if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
        throw new LlmError("not_configured", "Kľúč pre Anthropic API je neplatný.");
      }
      if (error instanceof Anthropic.BadRequestError) throw new LlmError("bad_request", error.message);
      if (error instanceof Anthropic.APIError) throw new LlmError("unavailable", `Anthropic API ${error.status ?? ""}`);
      if (error instanceof Anthropic.APIConnectionError) throw new LlmError("unavailable", "Spojenie s AI zlyhalo.");
      throw new LlmError("invalid_output", error instanceof Error ? error.message : "Neznáma chyba AI.");
    }
  }
}

let provider: LlmProvider | null | undefined;

/** Aktuálny LLM poskytovateľ alebo null, ak nie je nakonfigurovaný. */
export function getLlmProvider(): LlmProvider | null {
  if (provider !== undefined) return provider;
  const config = getAnthropicConfig();
  provider = config ? new AnthropicLlmProvider(config) : null;
  return provider;
}

export function requireLlmProvider(): LlmProvider {
  const llm = getLlmProvider();
  if (!llm) throw new LlmError("not_configured", "AI analýza nie je nakonfigurovaná (ANTHROPIC_API_KEY).");
  return llm;
}
