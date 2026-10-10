import { NextResponse, type NextRequest } from "next/server";
import { readSession, SESSION_COOKIE } from "@/lib/auth/token";

const AUTH_PAGES = new Set(["/prihlasenie", "/registracia"]);
/** Zamknuté časti (Môj startup, AI investor) a zrušené reporty: vedú späť na prehľad. */
const LOCKED_PREFIXES = ["/app/projekty", "/app/trening", "/app/miestnost", "/app/historia"];

/*
  Optimistické presmerovania podľa cookie relácie. Nie je to autorizácia:
  každá stránka, server action aj route handler overuje používateľa sám.
*/
export async function proxy(request: NextRequest) {
  const isSignedIn = Boolean(await readSession(request.cookies.get(SESSION_COOKIE)?.value));
  const { pathname, search } = request.nextUrl;

  if (pathname.startsWith("/app") && !isSignedIn) {
    const url = request.nextUrl.clone();
    url.pathname = "/prihlasenie";
    url.search = "";
    url.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(url);
  }

  if (LOCKED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    const url = request.nextUrl.clone();
    url.pathname = "/app";
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (AUTH_PAGES.has(pathname) && isSignedIn) {
    const url = request.nextUrl.clone();
    url.pathname = "/app";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/app/:path*", "/prihlasenie", "/registracia"],
};
