import { NextResponse, type NextRequest } from "next/server";
import { findAccount, resetStamp, startSession } from "@/lib/auth/accounts";
import { safeNextPath } from "@/lib/auth/session";
import { verifyToken } from "@/lib/auth/token";

/*
  Odkaz z e-mailu na obnovu hesla: overí podpísaný token, prihlási a pošle na nové heslo.
  Token prestane platiť po hodine alebo po zmene hesla.
*/
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const next = safeNextPath(searchParams.get("next"), "/nove-heslo");
  const payload = await verifyToken<{ sub: string; stamp: string }>("reset", searchParams.get("token"));
  const account = payload ? await findAccount(payload.sub) : null;
  if (!payload || !account || resetStamp(account) !== payload.stamp) {
    return NextResponse.redirect(new URL("/prihlasenie?chyba=odkaz", request.url));
  }
  await startSession(account);
  return NextResponse.redirect(new URL(next, request.url));
}
