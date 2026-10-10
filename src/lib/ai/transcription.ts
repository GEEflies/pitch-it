import "server-only";

import { getMistralTranscriptionConfig, getOpenAiRealtimeConfig } from "@/config/server-env";

/*
  Prepis krátkej nahrávky z cvičenia (OpenAI Audio API, bez kľúča Mistral Voxtral).
  Nahrávka sa neukladá: pošle sa na prepis a zahodí sa.
*/

export class TranscriptionError extends Error {
  constructor(readonly code: "not_configured" | "unavailable" | "rejected", message: string) {
    super(message);
    this.name = "TranscriptionError";
  }
}

export function isTranscriptionConfigured(): boolean {
  return getOpenAiRealtimeConfig() !== null || getMistralTranscriptionConfig() !== null;
}

export async function transcribeAudio(audio: Blob, fileName: string, language: "sk" | "en"): Promise<string> {
  const config = getOpenAiRealtimeConfig();
  if (!config) return (await transcribeWithMistral(audio, fileName)).text;

  const form = new FormData();
  form.set("file", audio, fileName);
  form.set("model", config.transcriptionModel);
  form.set("language", language);
  form.set("response_format", "json");

  let response: Response;
  try {
    response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${config.apiKey}` },
      body: form,
      signal: AbortSignal.timeout(60_000),
    });
  } catch {
    throw new TranscriptionError("unavailable", "Služba prepisu je nedostupná.");
  }
  if (!response.ok) {
    throw new TranscriptionError(response.status >= 500 ? "unavailable" : "rejected", `Prepis zlyhal (${response.status}).`);
  }
  const data = (await response.json()) as { text?: unknown };
  return typeof data.text === "string" ? data.text.trim() : "";
}

export type TimedTranscript = { text: string; words: Array<{ word: string; start: number; end: number }> };

/**
 * Prepis so slovnými časmi (Whisper, verbose_json). Potrebné na pauzy a tempo nahraného pitchu.
 * Model gpt-4o-transcribe časy slov nevracia, preto tu je pevne whisper-1.
 */
export async function transcribeWithWords(audio: Blob, fileName: string, language: "sk" | "en"): Promise<TimedTranscript> {
  const config = getOpenAiRealtimeConfig();
  if (!config) return transcribeWithMistral(audio, fileName);

  const form = new FormData();
  form.set("file", audio, fileName);
  form.set("model", "whisper-1");
  form.set("language", language);
  form.set("response_format", "verbose_json");
  form.append("timestamp_granularities[]", "word");
  form.append("timestamp_granularities[]", "segment");
  // Nápoveda, aby model zachoval zaváhania (inak ich vynecháva).
  form.set("prompt", "Ehm, takže, akože… vlastne, no, eee.");

  let response: Response;
  try {
    response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${config.apiKey}` },
      body: form,
      signal: AbortSignal.timeout(90_000),
    });
  } catch {
    throw new TranscriptionError("unavailable", "Služba prepisu je nedostupná.");
  }
  if (!response.ok) {
    throw new TranscriptionError(response.status >= 500 ? "unavailable" : "rejected", `Prepis zlyhal (${response.status}).`);
  }
  const data = (await response.json()) as { text?: unknown; words?: unknown };
  const words = Array.isArray(data.words)
    ? data.words
        .filter((w): w is { word: string; start: number; end: number } =>
          typeof w === "object" && w !== null && typeof (w as { word?: unknown }).word === "string" && typeof (w as { start?: unknown }).start === "number" && typeof (w as { end?: unknown }).end === "number",
        )
        .map((w) => ({ word: w.word.trim(), start: w.start, end: w.end }))
    : [];
  return { text: typeof data.text === "string" ? data.text.trim() : "", words };
}

/**
 * Mistral Voxtral so slovnými časmi (granularita „word“ vracia slová ako segmenty).
 * Slovenčinu ako `language` nepodporuje, jazyk rozpozná sám.
 */
async function transcribeWithMistral(audio: Blob, fileName: string): Promise<TimedTranscript> {
  const config = getMistralTranscriptionConfig();
  if (!config) throw new TranscriptionError("not_configured", "Prepis reči nie je nakonfigurovaný.");

  const form = new FormData();
  form.set("file", audio, fileName);
  form.set("model", config.model);
  form.set("timestamp_granularities", "word");

  let response: Response;
  try {
    response = await fetch("https://api.mistral.ai/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${config.apiKey}` },
      body: form,
      signal: AbortSignal.timeout(90_000),
    });
  } catch {
    throw new TranscriptionError("unavailable", "Služba prepisu je nedostupná.");
  }
  if (!response.ok) {
    throw new TranscriptionError(response.status >= 500 ? "unavailable" : "rejected", `Prepis zlyhal (${response.status}).`);
  }
  const data = (await response.json()) as { text?: unknown; segments?: unknown };
  const words = Array.isArray(data.segments)
    ? data.segments
        .filter((w): w is { text: string; start: number; end: number } =>
          typeof w === "object" && w !== null && typeof (w as { text?: unknown }).text === "string" && typeof (w as { start?: unknown }).start === "number" && typeof (w as { end?: unknown }).end === "number",
        )
        .map((w) => ({ word: w.text.trim(), start: w.start, end: w.end }))
        .filter((w) => w.word)
    : [];
  return { text: typeof data.text === "string" ? data.text.trim() : "", words };
}
