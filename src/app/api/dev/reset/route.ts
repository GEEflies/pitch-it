import { cookies } from "next/headers";
import { deleteAccount } from "@/lib/privacy/account";
import { readSession, SESSION_COOKIE } from "@/lib/auth/token";

/*
  Iba pre vývoj: zmaže prihlásený účet (aby sa dalo znova registrovať s tým istým e-mailom)
  a všetky cookies (aj httpOnly reláciu); úložisko a cache vyčistí tlačidlo v prehliadači,
  aby sa dalo testovať ako nový návštevník bez anonymného okna.
*/
export async function POST() {
  if (process.env.NODE_ENV !== "development") return new Response(null, { status: 404 });
  const jar = await cookies();
  const session = readSession(jar.get(SESSION_COOKIE)?.value);
  if (session) await deleteAccount(session.sub).catch((error) => console.error("dev reset: account delete failed", error));
  for (const cookie of jar.getAll()) jar.delete(cookie.name);
  // Bez hlavičky Clear-Site-Data: v Chrome vie čistenie cache trvať desiatky sekúnd.
  return new Response(null, { status: 204 });
}
