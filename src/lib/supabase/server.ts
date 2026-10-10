import "server-only";

import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { getSupabasePublicConfig } from "@/config/env";

export class SupabaseNotConfiguredError extends Error {
  constructor() {
    super("Supabase nie je nakonfigurovaný (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY).");
    this.name = "SupabaseNotConfiguredError";
  }
}

/**
 * Klient s reláciou prihláseného používateľa. Všetky dotazy podliehajú RLS.
 * V Server Components sa cookies nedajú zapísať; obnovu tokenu rieši proxy.ts.
 */
export async function createSupabaseServerClient(): Promise<SupabaseClient> {
  const config = getSupabasePublicConfig();
  if (!config) throw new SupabaseNotConfiguredError();

  const cookieStore = await cookies();
  return createServerClient(config.url, config.publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Volané zo Server Component: zápis nie je povolený, token obnoví proxy.
        }
      },
    },
  });
}
