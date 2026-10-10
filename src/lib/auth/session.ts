import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";
import { isAuthConfigured } from "@/config/env";
import { readSession, SESSION_COOKIE } from "@/lib/auth/token";
import { adminDb } from "@/lib/store/db";

export type AuthUser = { id: string; email: string | null };

/**
 * Aktuálny používateľ z podpísanej cookie relácie. Raz za požiadavku.
 * Volať iba vo vnútri <Suspense> (číta cookies).
 */
/** Relácia z cookie + kontrola, že účet ešte existuje (relácia po zmene úložiska môže ukazovať do prázdna). */
const readCurrent = cache(async (): Promise<{ user: AuthUser | null; stale: boolean }> => {
  if (!isAuthConfigured()) return { user: null, stale: false };
  // Overenie tokenu číta Date.now(); počkáme na skutočnú požiadavku (Cache Components).
  await connection();
  const session = await readSession((await cookies()).get(SESSION_COOKIE)?.value);
  if (!session) return { user: null, stale: false };
  const { data, error } = await adminDb().from("auth_users").select("id").eq("id", session.sub).maybeSingle();
  // pri výpadku úložiska radšej necháme používateľa prihláseného
  if (!error && !data) return { user: null, stale: true };
  return { user: { id: session.sub, email: session.email }, stale: false };
});

export const getCurrentUser = cache(async (): Promise<AuthUser | null> => (await readCurrent()).user);

/** Pre stránky: bez prihlásenia presmeruje na prihlásenie. */
export async function requireUser(nextPath?: string): Promise<AuthUser> {
  const { user, stale } = await readCurrent();
  // účet už neexistuje: zmaž cookie (inak by proxy vracalo z prihlásenia späť sem) a choď na registráciu
  if (stale) redirect("/api/auth/stara-relacia");
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
