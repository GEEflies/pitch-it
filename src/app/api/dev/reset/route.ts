import { cookies } from "next/headers";

/*
  Iba pre vývoj: zmaže cookies (aj httpOnly reláciu); úložisko a cache
  vyčistí tlačidlo v prehliadači, aby sa dalo testovať ako nový návštevník bez anonymného okna.
*/
export async function POST() {
  if (process.env.NODE_ENV !== "development") return new Response(null, { status: 404 });
  const jar = await cookies();
  for (const cookie of jar.getAll()) jar.delete(cookie.name);
  // Bez hlavičky Clear-Site-Data: v Chrome vie čistenie cache trvať desiatky sekúnd.
  return new Response(null, { status: 204 });
}
