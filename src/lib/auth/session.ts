import "server-only";

import { redirect } from "next/navigation";
import { cache } from "react";
import { isAuthConfigured } from "@/config/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AuthUser = { id: string; email: string | null };

/**
 * Aktuálny používateľ z overeného JWT (getClaims overí podpis). Raz za požiadavku.
 * Volať iba vo vnútri <Suspense> (číta cookies).
 */
export const getCurrentUser = cache(async (): Promise<AuthUser | null> => {
  if (!isAuthConfigured()) return null;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getClaims();
  const sub = data?.claims?.sub;
  if (error || typeof sub !== "string") return null;
  const email = data?.claims?.email;
  return { id: sub, email: typeof email === "string" ? email : null };
});

/** Pre stránky: bez prihlásenia presmeruje na prihlásenie. */
export async function requireUser(nextPath?: string): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user) {
    const next = nextPath && nextPath.startsWith("/") ? `?next=${encodeURIComponent(nextPath)}` : "";
    redirect(`/prihlasenie${next}`);
  }
  return user;
}

/** Bezpečná interná cesta na presmerovanie po prihlásení (žiadne externé URL). */
export function safeNextPath(value: unknown, fallback = "/app"): string {
  if (typeof value !== "string") return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  if (value.length > 512) return fallback;
  return value;
}
