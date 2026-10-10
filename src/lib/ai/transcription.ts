import "server-only";

import { getOpenAiRealtimeConfig } from "@/config/server-env";

/*
  Prepis krátkej nahrávky z cvičenia (OpenAI Audio API). Nahrávka sa neukladá:
  pošle sa na prepis a zahodí sa.
*/

export class TranscriptionError extends Error {
  constructor(readonly code: "not_configured" | "unavailable" | "rejected", message: string) {
    super(message);
    this.name = "TranscriptionError";
  }
}

export function isTranscriptionConfigured(): boolean {
  return getOpenAiRealtimeConfig() !== null;
}

export async function transcribeAudio(audio: Blob, fileName: string, language: "sk" | "en"): Promise<string> {
  const config = getOpenAiRealtimeConfig();
  if (!config) throw new TranscriptionError("not_configured", "Prepis reči nie je nakonfigurovaný.");

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
