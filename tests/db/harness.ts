import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite, type Transaction } from "@electric-sql/pglite";

const here = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.resolve(here, "../../supabase/migrations");

/** Postgres vo WASM so simulovanou auth/storage schémou a všetkými migráciami. */
export async function createDatabase(): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(readFileSync(path.join(here, "supabase-stub.sql"), "utf8"));
  const files = readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql"))
    .sort();
  for (const file of files) {
    await db.exec(readFileSync(path.join(migrationsDir, file), "utf8"));
  }
  return db;
}

let counter = 0;

/** Vytvorí používateľa v auth.users (spustí trigger handle_new_user). */
export async function createUser(
  db: PGlite,
  meta: Record<string, string> = {},
): Promise<string> {
  counter += 1;
  const id = `00000000-0000-4000-8000-${String(counter).padStart(12, "0")}`;
  await db.query("insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)", [
    id,
    `user${counter}@example.com`,
    JSON.stringify(meta),
  ]);
  return id;
}

/** Spustí dotazy ako prihlásený používateľ (rola authenticated + auth.uid()). */
export async function asUser<T>(
  db: PGlite,
  userId: string,
  run: (tx: Transaction) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [userId]);
    await tx.exec("set local role authenticated");
    return run(tx);
  });
}

export async function asAnon<T>(db: PGlite, run: (tx: Transaction) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.exec("set local role anon");
    return run(tx);
  });
}

/** Serverový (service_role) prístup: obchádza RLS, ale rešpektuje práva. */
export async function asService<T>(db: PGlite, run: (tx: Transaction) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.exec("set local role service_role");
    return run(tx);
  });
}

/** Očakáva chybu databázy so správou obsahujúcou `fragment`. */
export async function expectDbError(promise: Promise<unknown>, fragment: RegExp): Promise<void> {
  try {
    await promise;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!fragment.test(message)) {
      throw new Error(`Očakávaná chyba ${fragment}, prišla: ${message}`);
    }
    return;
  }
  throw new Error(`Očakávaná chyba ${fragment}, dotaz však prešiel.`);
}
