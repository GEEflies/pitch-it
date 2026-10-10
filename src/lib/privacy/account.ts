import "server-only";

import { deleteAccount as deleteAccountRecord } from "@/lib/auth/accounts";
import { check } from "@/lib/db/core";
import { removeUserFiles } from "@/lib/documents/storage";
import { trackEvent } from "@/lib/events/track";
import { getUserDb } from "@/lib/store/client";

/*
  Práva dotknutej osoby: export údajov a vymazanie (tréningov alebo celého účtu).
  Vymazanie účtu: súbory v úložisku → účet v auth_users (kaskáda zmaže všetky tabuľky).
*/

/** Zmaže všetky tréningy používateľa (prepisy, merania, reporty). Spotreba ostáva kvôli limitom. */
export async function deleteAllSessions(userId: string): Promise<number> {
  const db = await getUserDb();
  const { data, error } = await db
    .from("training_sessions")
    .delete()
    .eq("user_id", userId)
    .neq("status", "live")
    .select("id");
  check({ error }, "privacy.deleteSessions");
  return data?.length ?? 0;
}

export async function deleteAccount(userId: string): Promise<void> {
  await removeUserFiles(userId);
  await deleteAccountRecord(userId);
  // user_id sa v udalostiach nastaví na NULL, udalosť je anonymná.
  await trackEvent(null, "account_deleted", {});
}

/** Export všetkých údajov používateľa (čl. 15 a 20 GDPR) ako JSON. */
export async function exportUserData(userId: string): Promise<Record<string, unknown>> {
  const db = await getUserDb();
  const tables = [
    ["profil", db.from("profiles").select("*").eq("id", userId)],
    ["nastavenia", db.from("user_settings").select("*").eq("user_id", userId)],
    ["suhlasy", db.from("consents").select("kind, granted, version, created_at").eq("user_id", userId)],
    ["projekty", db.from("projects").select("*").eq("owner_id", userId)],
    ["fakty", db.from("startup_facts").select("*, projects!inner(owner_id)").eq("projects.owner_id", userId)],
    ["problemy_v_podkladoch", db.from("project_issues").select("*, projects!inner(owner_id)").eq("projects.owner_id", userId)],
    ["podklady", db.from("documents").select("id, project_id, file_name, file_type, size_bytes, status, slide_count, analysis_summary, created_at").eq("uploaded_by", userId)],
    ["treningy", db.from("training_sessions").select("*").eq("user_id", userId)],
    ["prepisy", db.from("conversation_turns").select("session_id, seq, speaker, text, started_ms, ended_ms, interrupted, source, created_at").eq("user_id", userId)],
    ["merania_hlasu", db.from("audio_delivery_metrics").select("*").eq("user_id", userId)],
    ["merania_kamery", db.from("visual_analytics").select("*").eq("user_id", userId)],
    ["reporty", db.from("feedback_reports").select("*").eq("user_id", userId)],
    ["cvicenia", db.from("exercises").select("*").eq("user_id", userId)],
    ["pokusy", db.from("exercise_attempts").select("*").eq("user_id", userId)],
    ["predplatne", db.from("subscriptions").select("plan, status, current_period_end, cancel_at_period_end").eq("user_id", userId)],
    ["spotreba", db.from("usage_events").select("kind, quantity, session_id, created_at").eq("user_id", userId)],
  ] as const;

  const results = await Promise.all(tables.map(([, query]) => query));
  const output: Record<string, unknown> = { exportovane: new Date().toISOString(), format: "pitch-it-export-v1" };
  tables.forEach(([name], index) => {
    const result = results[index];
    check(result, `export.${name}`);
    output[name] = result.data;
  });
  return output;
}
