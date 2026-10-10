import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabasePublicConfig } from "@/config/env";

/**
 * Obnoví reláciu Supabase pred vykreslením stránky a zapíše nové cookies do odpovede.
 * Vráti aj to, či je používateľ prihlásený (iba optimistická kontrola pre presmerovanie;
 * skutočnú autorizáciu robí každá stránka, akcia a route handler).
 */
export async function refreshSession(
  request: NextRequest,
): Promise<{ response: NextResponse; isSignedIn: boolean }> {
  let response = NextResponse.next({ request });
  const config = getSupabasePublicConfig();
  if (!config) return { response, isSignedIn: false };

  const supabase = createServerClient(config.url, config.publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
        for (const [key, value] of Object.entries(headers)) response.headers.set(key, value);
      },
    },
  });

  // getClaims overí podpis JWT; nevolať nič medzi createServerClient a týmto riadkom.
  const { data } = await supabase.auth.getClaims();
  return { response, isSignedIn: Boolean(data?.claims?.sub) };
}
