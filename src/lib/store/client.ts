import "server-only";

import { getCurrentUser } from "@/lib/auth/session";
import { adminDb, userDb, type Db } from "@/lib/store/db";

/*
  Prístup k dátam. `getUserDb` uplatní pravidlá prístupu prihláseného používateľa
  (náhrada RLS), `getAdminDb` ich obchádza: iba v src/lib po overení vlastníctva.
*/

export type { Db };

export async function getUserDb(): Promise<Db> {
  const user = await getCurrentUser();
  return userDb(user?.id ?? "anonymous");
}

export function getAdminDb(): Db {
  return adminDb();
}
