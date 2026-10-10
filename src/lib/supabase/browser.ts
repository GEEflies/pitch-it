"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

/**
 * Klient v prehliadači (verejný kľúč, chránený RLS). URL a kľúč posiela server ako props,
 * aby nezáviseli od inlinovania NEXT_PUBLIC_ premenných pri builde.
 */
export function getBrowserSupabase(url: string, publishableKey: string): SupabaseClient {
  if (!client) client = createBrowserClient(url, publishableKey);
  return client;
}
