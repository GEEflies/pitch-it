import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import type { PGlite } from "@electric-sql/pglite";
import { asAnon, asService, asUser, createDatabase, createUser, expectDbError } from "./harness.ts";

let db: PGlite;

async function createProject(ownerId: string, name = "Startup"): Promise<string> {
  return asUser(db, ownerId, async (tx) => {
    const result = await tx.query<{ id: string }>(
      "insert into public.projects (owner_id, name) values ($1, $2) returning id",
      [ownerId, name],
    );
    return result.rows[0].id;
  });
}

async function createSession(userId: string, projectId: string, status = "ready"): Promise<string> {
  return asService(db, async (tx) => {
    const result = await tx.query<{ id: string }>(
      `insert into public.training_sessions
         (user_id, project_id, mode, investor_key, scenario_key, target_duration_seconds, status, started_at)
       values ($1, $2, 'simulation', 'market', 'first_meeting', 900, $3, now())
       returning id`,
      [userId, projectId, status],
    );
    return result.rows[0].id;
  });
}

before(async () => {
  db = await createDatabase();
});

describe("úvodný kvíz", () => {
  test("používateľ uloží odpovede iba do vlastného profilu a iba ako objekt", async () => {
    const me = await createUser(db);
    const other = await createUser(db);

    await asUser(db, me, async (tx) => {
      await tx.query(
        "update public.profiles set onboarding_answers = $1, onboarding_completed_at = now() where id = $2",
        [JSON.stringify({ version: 1, stage: "seed" }), me],
      );
      const own = await tx.query<{ stage: string }>("select onboarding_answers ->> 'stage' as stage from public.profiles");
      assert.equal(own.rows[0].stage, "seed");

      const foreign = await tx.query("update public.profiles set onboarding_answers = '{}' where id = $1 returning id", [other]);
      assert.equal(foreign.rows.length, 0);

      await assert.rejects(tx.query("update public.profiles set onboarding_answers = '[1]' where id = $1", [me]));
    });
  });
});

describe("registrácia", () => {
  test("trigger vytvorí profil, nastavenia, free plán a súhlasy", async () => {
    const id = await createUser(db, {
      display_name: "  Jana  ",
      accepted_terms: "true",
      age_confirmed: "true",
      consent_version: "2026-10-10",
    });

    await asUser(db, id, async (tx) => {
      const profile = await tx.query<{ display_name: string }>("select display_name from public.profiles");
      assert.equal(profile.rows[0].display_name, "Jana");

      const plan = await tx.query<{ plan: string }>("select plan from public.subscriptions");
      assert.equal(plan.rows[0].plan, "free");

      const consents = await tx.query<{ kind: string }>(
        "select kind from public.current_consents where granted order by kind",
      );
      assert.deepEqual(
        consents.rows.map((row) => row.kind),
        ["age_18", "privacy_notice", "terms"],
      );
    });
  });

  test("bez súhlasov v metadátach nevzniknú žiadne súhlasy", async () => {
    const id = await createUser(db);
    const count = await asUser(db, id, (tx) =>
      tx.query<{ n: number }>("select count(*)::int as n from public.consents"),
    );
    assert.equal(count.rows[0].n, 0);
  });

  test("current_consents vracia posledný stav", async () => {
    const id = await createUser(db);
    await asUser(db, id, async (tx) => {
      await tx.query(
        "insert into public.consents (user_id, kind, granted, version) values ($1, 'camera_analysis', true, 'v1')",
        [id],
      );
      await tx.query(
        "insert into public.consents (user_id, kind, granted, version, created_at) values ($1, 'camera_analysis', false, 'v1', now() + interval '1 second')",
        [id],
      );
      const result = await tx.query<{ granted: boolean }>(
        "select granted from public.current_consents where kind = 'camera_analysis'",
      );
      assert.equal(result.rows[0].granted, false);
    });
  });

  test("súhlas nemožno zapísať za iného používateľa ani ho meniť", async () => {
    const a = await createUser(db);
    const b = await createUser(db);
    await expectDbError(
      asUser(db, a, (tx) =>
        tx.query(
          "insert into public.consents (user_id, kind, granted, version) values ($1, 'terms', true, 'v1')",
          [b],
        ),
      ),
      /row-level security/,
    );
    await expectDbError(
      asUser(db, a, (tx) => tx.query("update public.consents set granted = false")),
      /permission denied/,
    );
  });
});

describe("projekty a tím", () => {
  test("používateľ vidí iba vlastné projekty", async () => {
    const a = await createUser(db);
    const b = await createUser(db);
    await createProject(a, "A projekt");
    await createProject(b, "B projekt");

    const visible = await asUser(db, a, (tx) =>
      tx.query<{ name: string }>("select name from public.projects"),
    );
    assert.deepEqual(visible.rows.map((row) => row.name), ["A projekt"]);
  });

  test("projekt nemožno založiť za iného vlastníka", async () => {
    const a = await createUser(db);
    const b = await createUser(db);
    await expectDbError(
      asUser(db, a, (tx) =>
        tx.query("insert into public.projects (owner_id, name) values ($1, 'X')", [b]),
      ),
      /row-level security/,
    );
  });

  test("cudzí projekt nemožno upraviť ani zmazať", async () => {
    const a = await createUser(db);
    const b = await createUser(db);
    const projectB = await createProject(b);

    await asUser(db, a, async (tx) => {
      const updated = await tx.query("update public.projects set name = 'hack' where id = $1", [projectB]);
      assert.equal(updated.affectedRows, 0);
      const deleted = await tx.query("delete from public.projects where id = $1", [projectB]);
      assert.equal(deleted.affectedRows, 0);
    });
  });

  test("viewer číta, editor upravuje, nikto nemení vlastníka", async () => {
    const owner = await createUser(db);
    const editor = await createUser(db);
    const viewer = await createUser(db);
    const projectId = await createProject(owner);

    await asUser(db, owner, (tx) =>
      tx.query(
        "insert into public.project_members (project_id, user_id, role) values ($1, $2, 'editor'), ($1, $3, 'viewer')",
        [projectId, editor, viewer],
      ),
    );

    await asUser(db, viewer, async (tx) => {
      const rows = await tx.query("select id from public.projects where id = $1", [projectId]);
      assert.equal(rows.rows.length, 1);
      const updated = await tx.query("update public.projects set name = 'viewer' where id = $1", [projectId]);
      assert.equal(updated.affectedRows, 0);
    });

    await asUser(db, editor, async (tx) => {
      const updated = await tx.query("update public.projects set name = 'Editor' where id = $1", [projectId]);
      assert.equal(updated.affectedRows, 1);
    });

    await expectDbError(
      asUser(db, editor, (tx) =>
        tx.query("update public.projects set owner_id = $1 where id = $2", [editor, projectId]),
      ),
      /permission denied/,
    );

    // Editor nesmie spravovať členov: zmena sa ticho neaplikuje, pridanie skončí chybou.
    const changed = await asUser(db, editor, (tx) =>
      tx.query("update public.project_members set role = 'editor' where user_id = $1", [viewer]),
    );
    assert.equal(changed.affectedRows, 0);
    const outsider = await createUser(db);
    await expectDbError(
      asUser(db, editor, (tx) =>
        tx.query("insert into public.project_members (project_id, user_id, role) values ($1, $2, 'editor')", [
          projectId,
          outsider,
        ]),
      ),
      /row-level security/,
    );
  });

  test("anon nemá prístup k žiadnej tabuľke", async () => {
    for (const table of ["projects", "profiles", "training_sessions", "feedback_reports", "usage_events"]) {
      await expectDbError(
        asAnon(db, (tx) => tx.query(`select * from public.${table}`)),
        /permission denied/,
      );
    }
  });
});

describe("podklady a fakty", () => {
  test("viewer nemôže nahrať dokument, editor áno iba so stavom uploaded", async () => {
    const owner = await createUser(db);
    const viewer = await createUser(db);
    const projectId = await createProject(owner);
    await asUser(db, owner, (tx) =>
      tx.query("insert into public.project_members (project_id, user_id, role) values ($1, $2, 'viewer')", [
        projectId,
        viewer,
      ]),
    );

    const insert = (userId: string, status = "uploaded") =>
      asUser(db, userId, (tx) =>
        tx.query(
          `insert into public.documents (project_id, uploaded_by, storage_path, file_name, file_type, size_bytes, sha256, status)
           values ($1, $2, $3, 'deck.pdf', 'pdf', 1000, $4, $5)`,
          [projectId, userId, `${projectId}/${crypto.randomUUID()}.pdf`, "a".repeat(64), status],
        ),
      );

    await expectDbError(insert(viewer), /row-level security/);
    await expectDbError(insert(owner, "ready"), /row-level security/);
    await insert(owner);

    await expectDbError(
      asUser(db, owner, (tx) => tx.query("update public.documents set status = 'ready'")),
      /permission denied/,
    );
  });

  test("cudzie fakty a extrakcie nie sú viditeľné", async () => {
    const a = await createUser(db);
    const b = await createUser(db);
    const projectB = await createProject(b);
    await asUser(db, b, (tx) =>
      tx.query(
        "insert into public.startup_facts (project_id, category, label, value_text, source_type, status) values ($1, 'market', 'TAM', '4,2 mld €', 'user', 'confirmed')",
        [projectB],
      ),
    );

    const facts = await asUser(db, a, (tx) => tx.query("select id from public.startup_facts"));
    assert.equal(facts.rows.length, 0);

    await expectDbError(
      asUser(db, a, (tx) =>
        tx.query(
          "insert into public.startup_facts (project_id, category, label, value_text, source_type, status) values ($1, 'market', 'x', 'y', 'user', 'confirmed')",
          [projectB],
        ),
      ),
      /row-level security/,
    );
  });

  test("údaj od používateľa musí byť potvrdený", async () => {
    const a = await createUser(db);
    const projectId = await createProject(a);
    await expectDbError(
      asUser(db, a, (tx) =>
        tx.query(
          "insert into public.startup_facts (project_id, category, label, value_text, source_type, status) values ($1, 'market', 'x', 'y', 'user', 'needs_review')",
          [projectId],
        ),
      ),
      /startup_facts_user_confirmed/,
    );
  });

  test("úložisko: iba cesta vlastného projektu", async () => {
    const a = await createUser(db);
    const b = await createUser(db);
    const projectA = await createProject(a);
    const projectB = await createProject(b);

    const upload = (userId: string, name: string) =>
      asUser(db, userId, (tx) =>
        tx.query("insert into storage.objects (bucket_id, name) values ('pitch-documents', $1)", [name]),
      );

    await upload(a, `${projectA}/deck.pdf`);
    await expectDbError(upload(a, `${projectB}/deck.pdf`), /row-level security/);
    await expectDbError(upload(a, `nie-je-uuid/deck.pdf`), /row-level security/);
    await expectDbError(upload(a, `../${projectA}/deck.pdf`), /row-level security/);

    const visibleToB = await asUser(db, b, (tx) => tx.query("select name from storage.objects"));
    assert.equal(visibleToB.rows.length, 0);
  });
});

describe("tréningové relácie", () => {
  test("používateľ nemôže reláciu založiť ani meniť priamo", async () => {
    const a = await createUser(db);
    const projectId = await createProject(a);
    await expectDbError(
      asUser(db, a, (tx) =>
        tx.query(
          "insert into public.training_sessions (user_id, project_id, mode, investor_key, scenario_key, target_duration_seconds) values ($1, $2, 'coach', 'x', 'y', 600)",
          [a, projectId],
        ),
      ),
      /permission denied/,
    );

    const sessionId = await createSession(a, projectId, "live");
    await expectDbError(
      asUser(db, a, (tx) =>
        tx.query("update public.training_sessions set billed_seconds = 0 where id = $1", [sessionId]),
      ),
      /permission denied/,
    );
  });

  test("prepis možno pridať iba do vlastnej živej relácie", async () => {
    const a = await createUser(db);
    const b = await createUser(db);
    const projectA = await createProject(a);
    const projectB = await createProject(b);
    const live = await createSession(a, projectA, "live");
    const done = await createSession(a, projectA, "completed");
    const foreign = await createSession(b, projectB, "live");

    const addTurn = (sessionId: string, seq: number) =>
      asUser(db, a, (tx) =>
        tx.query(
          "insert into public.conversation_turns (session_id, user_id, seq, speaker, text, source) values ($1, $2, $3, 'founder', 'Ahoj', 'realtime')",
          [sessionId, a, seq],
        ),
      );

    await addTurn(live, 0);
    await expectDbError(addTurn(done, 0), /row-level security/);
    await expectDbError(addTurn(foreign, 0), /row-level security/);
    await expectDbError(addTurn(live, 0), /duplicate key/);
  });

  test("reporty a merania sú iba na čítanie a iba vlastné", async () => {
    const a = await createUser(db);
    const b = await createUser(db);
    const projectB = await createProject(b);
    const sessionB = await createSession(b, projectB, "completed");
    await asService(db, (tx) =>
      tx.query("insert into public.feedback_reports (session_id, user_id, status) values ($1, $2, 'ready')", [
        sessionB,
        b,
      ]),
    );

    const visible = await asUser(db, a, (tx) => tx.query("select * from public.feedback_reports"));
    assert.equal(visible.rows.length, 0);

    await expectDbError(
      asUser(db, b, (tx) => tx.query("update public.feedback_reports set status = 'failed'")),
      /permission denied/,
    );
  });

  test("spotrebu nemožno meniť ani mazať", async () => {
    const a = await createUser(db);
    await asService(db, (tx) =>
      tx.query("insert into public.usage_events (user_id, kind, quantity) values ($1, 'realtime_seconds', 600)", [a]),
    );
    await expectDbError(
      asUser(db, a, (tx) => tx.query("delete from public.usage_events")),
      /permission denied/,
    );
    await expectDbError(
      asUser(db, a, (tx) =>
        tx.query("insert into public.usage_events (user_id, kind, quantity) values ($1, 'report', 0)", [a]),
      ),
      /permission denied/,
    );
  });

  test("zmazanie relácie zachová spotrebu", async () => {
    const a = await createUser(db);
    const projectId = await createProject(a);
    const sessionId = await createSession(a, projectId, "completed");
    await asService(db, (tx) =>
      tx.query(
        "insert into public.usage_events (user_id, kind, quantity, session_id) values ($1, 'realtime_seconds', 300, $2)",
        [a, sessionId],
      ),
    );

    await asUser(db, a, (tx) => tx.query("delete from public.training_sessions where id = $1", [sessionId]));

    const usage = await asUser(db, a, (tx) =>
      tx.query<{ quantity: number; session_id: string | null }>("select quantity, session_id from public.usage_events"),
    );
    assert.equal(usage.rows[0].quantity, 300);
    assert.equal(usage.rows[0].session_id, null);
  });

  test("živú reláciu nemožno zmazať", async () => {
    const a = await createUser(db);
    const projectId = await createProject(a);
    const sessionId = await createSession(a, projectId, "live");
    const deleted = await asUser(db, a, (tx) =>
      tx.query("delete from public.training_sessions where id = $1", [sessionId]),
    );
    assert.equal(deleted.affectedRows, 0);
  });

  test("close_stale_sessions uzavrie a vyúčtuje opustenú reláciu", async () => {
    const a = await createUser(db);
    const projectId = await createProject(a);
    const sessionId = await asService(db, async (tx) => {
      const result = await tx.query<{ id: string }>(
        `insert into public.training_sessions
           (user_id, project_id, mode, investor_key, scenario_key, target_duration_seconds, status, started_at, last_heartbeat_at)
         values ($1, $2, 'simulation', 'market', 'first_meeting', 900, 'live', now() - interval '20 minutes', now() - interval '15 minutes')
         returning id`,
        [a, projectId],
      );
      return result.rows[0].id;
    });

    await expectDbError(
      asUser(db, a, (tx) => tx.query("select public.close_stale_sessions($1)", [a])),
      /permission denied/,
    );

    const closed = await asService(db, (tx) =>
      tx.query<{ n: number }>("select public.close_stale_sessions($1) as n", [a]),
    );
    assert.equal(closed.rows[0].n, 1);

    const session = await asService(db, (tx) =>
      tx.query<{ status: string; billed_seconds: number }>(
        "select status, billed_seconds from public.training_sessions where id = $1",
        [sessionId],
      ),
    );
    assert.equal(session.rows[0].status, "abandoned");
    assert.ok(Math.abs(session.rows[0].billed_seconds - 300) <= 2);

    const usage = await asService(db, (tx) =>
      tx.query<{ total: number }>(
        "select coalesce(sum(quantity), 0)::int as total from public.usage_events where session_id = $1",
        [sessionId],
      ),
    );
    assert.ok(Math.abs(usage.rows[0].total - 300) <= 2);
  });
});

describe("cvičenia a nastavenia", () => {
  test("používateľ mení iba stav cvičenia, nie jeho zadanie", async () => {
    const a = await createUser(db);
    const exerciseId = await asService(db, async (tx) => {
      const result = await tx.query<{ id: string }>(
        "insert into public.exercises (user_id, category, kind, title, prompt, origin) values ($1, 'market', 'answer_drill', 'Trh', 'Aký je váš trh?', 'library') returning id",
        [a],
      );
      return result.rows[0].id;
    });

    await asUser(db, a, (tx) =>
      tx.query("update public.exercises set status = 'completed', completed_at = now() where id = $1", [exerciseId]),
    );
    await expectDbError(
      asUser(db, a, (tx) => tx.query("update public.exercises set prompt = 'iné' where id = $1", [exerciseId])),
      /permission denied/,
    );
  });

  test("purge_expired_sessions maže podľa nastavenej doby uchovávania", async () => {
    const a = await createUser(db);
    const projectId = await createProject(a);
    await asUser(db, a, (tx) => tx.query("update public.user_settings set data_retention_days = 30"));
    const oldSession = await createSession(a, projectId, "completed");
    const newSession = await createSession(a, projectId, "completed");
    await asService(db, (tx) =>
      tx.query("update public.training_sessions set created_at = now() - interval '40 days' where id = $1", [
        oldSession,
      ]),
    );

    await asService(db, (tx) => tx.query("select public.purge_expired_sessions()"));

    const remaining = await asUser(db, a, (tx) =>
      tx.query<{ id: string }>("select id from public.training_sessions"),
    );
    assert.deepEqual(remaining.rows.map((row) => row.id), [newSession]);
  });
});

describe("zmazanie účtu", () => {
  test("zmaže všetky údaje používateľa a anonymizuje udalosti", async () => {
    const a = await createUser(db, { accepted_terms: "true", consent_version: "v1" });
    const projectId = await createProject(a);
    const sessionId = await createSession(a, projectId, "completed");
    await asService(db, async (tx) => {
      await tx.query(
        "insert into public.conversation_turns (session_id, user_id, seq, speaker, text, source) values ($1, $2, 0, 'founder', 'text', 'realtime')",
        [sessionId, a],
      );
      await tx.query("insert into public.product_events (user_id, name) values ($1, 'session_completed')", [a]);
      await tx.query("insert into public.usage_events (user_id, kind, quantity) values ($1, 'report', 1)", [a]);
    });

    await asService(db, async (tx) => {
      // V Supabase: auth.admin.deleteUser(); tu priamo zmažeme riadok v auth.users.
      await tx.exec("reset role");
      await tx.query("delete from auth.users where id = $1", [a]);
    });

    const leftovers = await asService(db, (tx) =>
      tx.query<{ n: number }>(
        `select (
           (select count(*) from public.profiles where id = $1) +
           (select count(*) from public.projects where owner_id = $1) +
           (select count(*) from public.training_sessions where user_id = $1) +
           (select count(*) from public.conversation_turns where user_id = $1) +
           (select count(*) from public.consents where user_id = $1) +
           (select count(*) from public.usage_events where user_id = $1) +
           (select count(*) from public.subscriptions where user_id = $1)
         )::int as n`,
        [a],
      ),
    );
    assert.equal(leftovers.rows[0].n, 0);

    const events = await asService(db, (tx) =>
      tx.query<{ user_id: string | null }>(
        "select user_id from public.product_events where name = 'session_completed' order by id desc limit 1",
      ),
    );
    assert.equal(events.rows[0].user_id, null);
  });
});
