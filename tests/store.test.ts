import { beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import { adminDb, userDb } from "../src/lib/store/db.ts";
import { resetMemoryKv } from "../src/lib/store/kv.ts";
import { checkPassword, hashPassword } from "../src/lib/auth/password.ts";
import { signToken, verifyToken } from "../src/lib/auth/token.ts";

const A = "00000000-0000-4000-8000-00000000000a";
const B = "00000000-0000-4000-8000-00000000000b";

async function seedUser(id: string, email: string) {
  const db = adminDb();
  await db.from("auth_users").insert({ id, email, password_hash: null });
  await db.from("profiles").insert({ id, display_name: email });
}

describe("úložisko v Redise (pamäť)", () => {
  beforeEach(async () => {
    resetMemoryKv();
    await seedUser(A, "a@x.sk");
    await seedUser(B, "b@x.sk");
  });

  test("predvolené hodnoty, filtre, poradie a počet", async () => {
    const db = adminDb();
    await db.from("pitch_attempts").insert([
      { user_id: A, audience: "investor", target_seconds: 60, created_at: "2026-01-02" },
      { user_id: A, audience: "team", target_seconds: 30, created_at: "2026-01-01" },
      { user_id: B, audience: "team", target_seconds: 30 },
    ]);
    const { data } = await db.from("pitch_attempts").select("audience, status").eq("user_id", A).order("created_at");
    assert.deepEqual(data, [
      { audience: "team", status: "analyzing" },
      { audience: "investor", status: "analyzing" },
    ]);
    const { count } = await db.from("pitch_attempts").select("id", { count: "exact", head: true }).eq("user_id", A).lte("created_at", "2026-01-01");
    assert.equal(count, 1);
    const none = await db.from("pitch_attempts").select("*").is("event_id", null).not("user_id", "is", null);
    assert.equal((none.data as unknown[]).length, 3);
  });

  test("unikátny kľúč vráti 23505 a upsert s ignoreDuplicates riadok nezmení", async () => {
    const db = adminDb();
    const first = await db.from("pitch_events").insert({ organizer_id: A, name: "X", code: "ABC123" });
    assert.equal(first.error, null);
    const dup = await db.from("pitch_events").insert({ organizer_id: B, name: "Y", code: "ABC123" });
    assert.equal(dup.error?.code, "23505");
    const email = await db.from("auth_users").insert({ email: "a@x.sk" });
    assert.equal(email.error?.code, "23505");
  });

  test("klient používateľa vidí iba svoje riadky a zdieľané pokusy svojej akcie", async () => {
    const admin = adminDb();
    const { data: event } = await admin.from("pitch_events").insert({ organizer_id: B, name: "Demo day", code: "DEMO01" }).select("*").single<{ id: string }>();
    await admin.from("pitch_attempts").insert([
      { user_id: A, audience: "investor", target_seconds: 60 },
      { user_id: A, audience: "investor", target_seconds: 60, event_id: event!.id, shared_at: new Date().toISOString() },
    ]);
    const mine = await userDb(A).from("pitch_attempts").select("id");
    assert.equal((mine.data as unknown[]).length, 2);
    const mentor = await userDb(B).from("pitch_attempts").select("id");
    assert.equal((mentor.data as unknown[]).length, 1);
    const stranger = await userDb(B).from("profiles").select("*").eq("id", A);
    assert.deepEqual(stranger.data, []);
    const write = await userDb(B).from("pitch_events").insert({ organizer_id: B, name: "Z", code: "ZZZ999" });
    assert.equal(write.error?.code, "42501");
  });

  test("mazanie účtu kaskádovo zmaže dáta a vo voľných väzbách nastaví null", async () => {
    const admin = adminDb();
    const { data: event } = await admin.from("pitch_events").insert({ organizer_id: B, name: "E", code: "EEE111" }).select("id").single<{ id: string }>();
    await admin.from("pitch_attempts").insert({ user_id: A, audience: "team", target_seconds: 30, event_id: event!.id });
    await admin.from("product_events").insert({ user_id: A, name: "pitch_analyzed" });
    await admin.from("auth_users").delete().eq("id", B);
    const attempt = await admin.from("pitch_attempts").select("event_id").eq("user_id", A).single<{ event_id: string | null }>();
    assert.equal(attempt.data?.event_id, null);
    await admin.from("auth_users").delete().eq("id", A);
    assert.deepEqual((await admin.from("pitch_attempts").select("id")).data, []);
    assert.deepEqual((await admin.from("profiles").select("id")).data, []);
    const events = (await admin.from("product_events").select("user_id")).data as Array<{ user_id: string | null }>;
    assert.deepEqual(events, [{ user_id: null }]);
  });

  test("vnorená tabuľka s !inner filtruje podľa väzby", async () => {
    const admin = adminDb();
    const { data: project } = await admin.from("projects").insert({ owner_id: A, name: "P" }).select("id").single<{ id: string }>();
    await admin.from("startup_facts").insert({ project_id: project!.id, category: "market", label: "Trh", value_text: "1", source_type: "user", status: "confirmed" });
    const rows = await userDb(A).from("startup_facts").select("*, projects!inner(owner_id)").eq("projects.owner_id", A);
    assert.equal((rows.data as unknown[]).length, 1);
    const other = await userDb(B).from("startup_facts").select("*, projects!inner(owner_id)").eq("projects.owner_id", B);
    assert.equal((other.data as unknown[]).length, 0);
  });
});

describe("prihlasovanie bez externej služby", () => {
  test("heslo sa overí iba správne", async () => {
    const stored = await hashPassword("tajneheslo123");
    assert.equal(await checkPassword("tajneheslo123", stored), true);
    assert.equal(await checkPassword("ine-heslo", stored), false);
  });

  test("podpísaný token nesmie prejsť s iným účelom ani po úprave", async () => {
    const token = await signToken("session", { sub: A, email: "a@x.sk" }, 60);
    assert.equal((await verifyToken<{ sub: string }>("session", token))?.sub, A);
    assert.equal(await verifyToken("reset", token), null);
    assert.equal(await verifyToken("session", token.slice(0, -2) + "xx"), null);
  });
});
