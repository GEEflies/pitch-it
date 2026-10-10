import { NextResponse, type NextRequest } from "next/server";
import { refreshSession } from "@/lib/supabase/proxy-session";

const AUTH_PAGES = new Set(["/prihlasenie", "/registracia"]);

/** Presmerovanie, ktoré si zachová práve obnovené cookies relácie. */
function redirectWithCookies(url: URL, from: NextResponse): NextResponse {
  const redirect = NextResponse.redirect(url);
  for (const cookie of from.cookies.getAll()) redirect.cookies.set(cookie);
  return redirect;
}

/*
  Obnova relácie a optimistické presmerovania. Nie je to autorizácia:
  každá stránka, server action aj route handler overuje používateľa sám.
*/
export async function proxy(request: NextRequest) {
  const { response, isSignedIn } = await refreshSession(request);
  const { pathname, search } = request.nextUrl;

  if (pathname.startsWith("/app") && !isSignedIn) {
    const url = request.nextUrl.clone();
    url.pathname = "/prihlasenie";
    url.search = "";
    url.searchParams.set("next", `${pathname}${search}`);
    return redirectWithCookies(url, response);
  }

  if (AUTH_PAGES.has(pathname) && isSignedIn) {
    const url = request.nextUrl.clone();
    url.pathname = "/app";
    url.search = "";
    return redirectWithCookies(url, response);
  }

  return response;
}

export const config = {
  matcher: ["/app/:path*", "/api/:path*", "/prihlasenie", "/registracia", "/auth/:path*"],
};
