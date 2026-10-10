import type { RealtimeEvent, RealtimeUsage } from "@/lib/ai/realtime/types";

/*
  Preklad udalostí OpenAI Realtime (GA) na normalizované udalosti aplikácie.
  Podporuje aj staršie beta názvy (response.audio_transcript.*), ktoré niektoré
  modely ešte posielajú. Neznáme udalosti vracia ako null.
*/

type Raw = Record<string, unknown>;

function str(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function num(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function record(value: unknown): Raw | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Raw) : null;
}

function parseUsage(value: unknown): RealtimeUsage | null {
  const usage = record(value);
  if (!usage) return null;
  const input = record(usage.input_token_details);
  const output = record(usage.output_token_details);
  return {
    inputTokens: num(usage.input_tokens),
    outputTokens: num(usage.output_tokens),
    inputAudioTokens: num(input?.audio_tokens),
    outputAudioTokens: num(output?.audio_tokens),
    cachedTokens: num(input?.cached_tokens),
  };
}

function parseLogprobs(value: unknown): Array<{ logprob: number }> | null {
  if (!Array.isArray(value)) return null;
  const parsed = value
    .map((entry) => record(entry))
    .filter((entry): entry is Raw => entry !== null && typeof entry.logprob === "number")
    .map((entry) => ({ logprob: entry.logprob as number }));
  return parsed.length > 0 ? parsed : null;
}

export function normalizeOpenAiEvent(raw: Raw): RealtimeEvent | null {
  const type = str(raw.type);
  switch (type) {
    case "session.created":
      return { type: "session_ready" };

    case "input_audio_buffer.speech_started": {
      const itemId = str(raw.item_id);
      return itemId ? { type: "founder_speech_started", itemId } : null;
    }
    case "input_audio_buffer.speech_stopped": {
      const itemId = str(raw.item_id);
      return itemId ? { type: "founder_speech_stopped", itemId } : null;
    }
    case "conversation.item.input_audio_transcription.delta": {
      const itemId = str(raw.item_id);
      const delta = str(raw.delta);
      return itemId && delta !== null ? { type: "founder_transcript_delta", itemId, delta } : null;
    }
    case "conversation.item.input_audio_transcription.completed": {
      const itemId = str(raw.item_id);
      return itemId
        ? {
            type: "founder_transcript_final",
            itemId,
            text: str(raw.transcript) ?? "",
            logprobs: parseLogprobs(raw.logprobs),
          }
        : null;
    }
    case "conversation.item.input_audio_transcription.failed": {
      const itemId = str(raw.item_id);
      return itemId ? { type: "founder_transcript_failed", itemId } : null;
    }

    case "response.created": {
      const responseId = str(record(raw.response)?.id);
      return responseId ? { type: "investor_response_started", responseId } : null;
    }
    case "response.output_audio_transcript.delta":
    case "response.audio_transcript.delta": {
      const itemId = str(raw.item_id);
      const delta = str(raw.delta);
      return itemId && delta !== null
        ? { type: "investor_transcript_delta", itemId, responseId: str(raw.response_id), delta }
        : null;
    }
    case "response.output_audio_transcript.done":
    case "response.audio_transcript.done": {
      const itemId = str(raw.item_id);
      return itemId ? { type: "investor_transcript_final", itemId, text: str(raw.transcript) ?? "" } : null;
    }
    case "output_audio_buffer.started":
      return { type: "investor_audio_started", responseId: str(raw.response_id) };
    case "output_audio_buffer.stopped":
      return { type: "investor_audio_stopped", responseId: str(raw.response_id), cleared: false };
    case "output_audio_buffer.cleared":
      return { type: "investor_audio_stopped", responseId: str(raw.response_id), cleared: true };
    case "response.done": {
      const response = record(raw.response);
      const responseId = str(response?.id);
      if (!responseId) return null;
      return {
        type: "investor_response_done",
        responseId,
        status: str(response?.status) ?? "completed",
        usage: parseUsage(response?.usage),
      };
    }
    case "response.function_call_arguments.done": {
      const name = str(raw.name);
      const callId = str(raw.call_id);
      return name && callId
        ? { type: "tool_call", name, callId, argumentsJson: str(raw.arguments) ?? "{}" }
        : null;
    }
    case "error": {
      const error = record(raw.error);
      return {
        type: "provider_error",
        code: str(error?.code),
        message: str(error?.message) ?? "Neznáma chyba poskytovateľa.",
      };
    }
    default:
      return null;
  }
}
