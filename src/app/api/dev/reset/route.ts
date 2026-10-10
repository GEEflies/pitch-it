import { cookies } from "next/headers";

/*
  Iba pre vývoj: zmaže cookies (aj httpOnly reláciu), úložisko a cache prehliadača
  pre localhost, aby sa dalo testovať ako nový návštevník bez anonymného okna.
*/
export async function POST() {
  if (process.env.NODE_ENV !== "development") return new Response(null, { status: 404 });
  const jar = await cookies();
  for (const cookie of jar.getAll()) jar.delete(cookie.name);
  return new Response(null, {
    status: 204,
    headers: { "Clear-Site-Data": '"cache", "cookies", "storage"' },
  });
}
