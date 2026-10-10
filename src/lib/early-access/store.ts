import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { EarlyAccessData } from "@/lib/early-access/schema";

const TABLE = "early_access_signups";
const UNIQUE_VIOLATION = "23505";

export class EarlyAccessStoreError extends Error {
  readonly code: "not_configured" | "query_failed";

  constructor(code: "not_configured" | "query_failed", message: string) {
    super(message);
    this.name = "EarlyAccessStoreError";
    this.code = code;
  }
}

type Credentials = { url: string; key: string };

function readCredentials(): Credentials | null {
  const url = process.env.SUPABASE_URL?.trim();
  // Nový „secret“ kľúč alebo starší service_role kľúč. Nikdy nie NEXT_PUBLIC_.
  const key =
    process.env.SUPABASE_SECRET_KEY?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  return url && key ? { url, key } : null;
}

export function isEarlyAccessConfigured(): boolean {
  return readCredentials() !== null;
}

let client: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (client) return client;
  const credentials = readCredentials();
  if (!credentials) {
    throw new EarlyAccessStoreError("not_configured", "Supabase nie je nakonfigurovaný.");
  }
  client = createClient(credentials.url, credentials.key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return client;
}

export type SignupRecord = EarlyAccessData & {
  consentVersion: string;
  ipHash: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
};

/** Počet zápisov z rovnakého (hashovaného) zdroja za posledných N minút. */
export async function countRecentSignups(ipHash: string, minutes: number): Promise<number> {
  const since = new Date(Date.now() - minutes * 60_000).toISOString();
  const { count, error } = await getClient()
    .from(TABLE)
    .select("id", { count: "exact", head: true })
    .eq("ip_hash", ipHash)
    .gte("created_at", since);

  if (error) {
    throw new EarlyAccessStoreError("query_failed", error.message);
  }
  return count ?? 0;
}

/** Uloží zápis. Ak e-mail už existuje, vráti "duplicate" (záznam je uložený). */
export async function insertSignup(record: SignupRecord): Promise<"created" | "duplicate"> {
  const { error } = await getClient().from(TABLE).insert({
    email: record.email,
    stage: record.stage,
    next_meeting: record.nextMeeting,
    consent_version: record.consentVersion,
    consent_at: new Date().toISOString(),
    ip_hash: record.ipHash,
    utm_source: record.utmSource,
    utm_medium: record.utmMedium,
    utm_campaign: record.utmCampaign,
  });

  if (!error) return "created";
  if (error.code === UNIQUE_VIOLATION) return "duplicate";
  throw new EarlyAccessStoreError("query_failed", error.message);
}
