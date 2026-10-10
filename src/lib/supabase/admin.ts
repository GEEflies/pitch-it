import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabasePublicConfig } from "@/config/env";
import { getSupabaseSecretKey } from "@/config/server-env";

/*
  Admin klient (secret / service_role kľúč) obchádza RLS.
  Používa sa iba v src/lib/db na systémové zápisy po overení vlastníctva
  (stav relácie, merania, reporty, spotreba, udalosti) a pri mazaní účtu.
*/

let client: SupabaseClient | null = null;

export function isAdminConfigured(): boolean {
  return getSupabasePublicConfig() !== null && getSupabaseSecretKey() !== null;
}

export function getSupabaseAdmin(): SupabaseClient {
  if (client) return client;
  const config = getSupabasePublicConfig();
  const secret = getSupabaseSecretKey();
  if (!config || !secret) {
    throw new Error("Supabase admin nie je nakonfigurovaný (SUPABASE_SECRET_KEY).");
  }
  client = createClient(config.url, secret, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return client;
}
