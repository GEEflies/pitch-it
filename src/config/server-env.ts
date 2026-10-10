import "server-only";

/*
  Serverové tajomstvá. Tento modul sa nesmie dostať do klientskeho bundlu.
  Nikdy nedávaj týmto premenným prefix NEXT_PUBLIC_.
*/

function read(name: string): string | null {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

export function getSupabaseSecretKey(): string | null {
  return read("SUPABASE_SECRET_KEY") ?? read("SUPABASE_SERVICE_ROLE_KEY");
}

export type AnthropicConfig = { apiKey: string | null; model: string; fastModel: string };

/**
 * Claude: analýza decku, reporty, nápoveda, textový investor, hodnotenie cvičení.
 * apiKey môže byť null, ak sa SDK autentifikuje inak (napr. `ant auth login` lokálne);
 * pre produkciu nastav ANTHROPIC_API_KEY.
 */
export function getAnthropicConfig(): AnthropicConfig | null {
  const apiKey = read("ANTHROPIC_API_KEY");
  const enabled = apiKey !== null || read("ANTHROPIC_ENABLED") === "true";
  if (!enabled) return null;
  return {
    apiKey,
    model: read("ANTHROPIC_MODEL") ?? "claude-opus-5-5",
    fastModel: read("ANTHROPIC_FAST_MODEL") ?? read("ANTHROPIC_MODEL") ?? "claude-opus-5-5",
  };
}

export type OpenAiRealtimeConfig = {
  apiKey: string;
  model: string;
  transcriptionModel: string;
  voice: string;
};

/** OpenAI Realtime: živý hlasový rozhovor a prepis. */
export function getOpenAiRealtimeConfig(): OpenAiRealtimeConfig | null {
  const apiKey = read("OPENAI_API_KEY");
  if (!apiKey) return null;
  return {
    apiKey,
    model: read("OPENAI_REALTIME_MODEL") ?? "gpt-realtime-2.1",
    transcriptionModel: read("OPENAI_TRANSCRIPTION_MODEL") ?? "gpt-4o-transcribe",
    voice: read("OPENAI_REALTIME_VOICE") ?? "cedar",
  };
}

export type StripeConfig = {
  secretKey: string;
  webhookSecret: string;
  proPriceId: string;
};

export function getStripeConfig(): StripeConfig | null {
  const secretKey = read("STRIPE_SECRET_KEY");
  const webhookSecret = read("STRIPE_WEBHOOK_SECRET");
  const proPriceId = read("STRIPE_PRICE_ID_PRO");
  return secretKey && webhookSecret && proPriceId ? { secretKey, webhookSecret, proPriceId } : null;
}

/** Tajomstvo na HMAC (napr. hash IP pri rate limite). */
export function getHashSalt(): string | null {
  return read("IP_HASH_SALT");
}
