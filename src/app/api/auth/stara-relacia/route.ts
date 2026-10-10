import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/token";

/** Relácia ukazuje na účet, ktorý už neexistuje: zmaže cookie a pošle na registráciu. */
export async function GET(request: Request) {
  (await cookies()).delete(SESSION_COOKIE);
  return NextResponse.redirect(new URL("/registracia?stary-ucet=1", request.url));
}
