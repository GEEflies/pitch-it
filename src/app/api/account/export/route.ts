import { NextResponse } from "next/server";
import { apiError, rateLimited, requireApiUser } from "@/lib/http/route";
import { exportUserData } from "@/lib/privacy/account";

/** Stiahnutie všetkých údajov účtu ako JSON. */
export async function GET() {
  const user = await requireApiUser();
  if (user instanceof Response) return user;
  const limited = rateLimited(user.id, "export", { limit: 5, windowMs: 60 * 60 * 1000 });
  if (limited) return limited;
  try {
    const data = await exportUserData(user.id);
    return new NextResponse(JSON.stringify(data, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="pitch-it-export-${new Date().toISOString().slice(0, 10)}.json"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[export]", error instanceof Error ? error.message : error);
    return apiError(500, "export_failed", "Export sa nepodaril. Skús to znova.");
  }
}
