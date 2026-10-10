import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { isAuthConfigured } from "@/config/env";
import { readSession, SESSION_COOKIE } from "@/lib/auth/token";

export type AuthUser = { id: string; email: string | null };

/**
 * Aktuálny používateľ z podpísanej cookie relácie. Raz za požiadavku.
 * Volať iba vo vnútri <Suspense> (číta cookies).
 */
export const getCurrentUser = cache(async (): Promise<AuthUser | null> => {
  if (!isAuthConfigured()) return null;
  const session = await readSession((await cookies()).get(SESSION_COOKIE)?.value);
  return session ? { id: session.sub, email: session.email } : null;
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
