import "server-only";

import { check } from "@/lib/db/core";
import { removeUserFiles } from "@/lib/documents/storage";
import { trackEvent } from "@/lib/events/track";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/*
  Práva dotknutej osoby: export údajov a vymazanie (tréningov alebo celého účtu).
  Vymazanie účtu: súbory v úložisku → používateľ v auth (kaskáda zmaže všetky tabuľky).
*/

/** Zmaže všetky tréningy používateľa (prepisy, merania, reporty). Spotreba ostáva kvôli limitom. */
export async function deleteAllSessions(userId: string): Promise<number> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
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
  const { error } = await getSupabaseAdmin().auth.admin.deleteUser(userId);
  if (error) throw new Error(`auth.deleteUser: ${error.message}`);
  // user_id sa v udalostiach nastaví na NULL, udalosť je anonymná.
  await trackEvent(null, "account_deleted", {});
}

/** Export všetkých údajov používateľa (čl. 15 a 20 GDPR) ako JSON. */
export async function exportUserData(userId: string): Promise<Record<string, unknown>> {
  const supabase = await createSupabaseServerClient();
  const tables = [
    ["profil", supabase.from("profiles").select("*").eq("id", userId)],
    ["nastavenia", supabase.from("user_settings").select("*").eq("user_id", userId)],
    ["suhlasy", supabase.from("consents").select("kind, granted, version, created_at").eq("user_id", userId)],
    ["projekty", supabase.from("projects").select("*").eq("owner_id", userId)],
    ["fakty", supabase.from("startup_facts").select("*, projects!inner(owner_id)").eq("projects.owner_id", userId)],
    ["problemy_v_podkladoch", supabase.from("project_issues").select("*, projects!inner(owner_id)").eq("projects.owner_id", userId)],
    ["podklady", supabase.from("documents").select("id, project_id, file_name, file_type, size_bytes, status, slide_count, analysis_summary, created_at").eq("uploaded_by", userId)],
    ["treningy", supabase.from("training_sessions").select("*").eq("user_id", userId)],
    ["prepisy", supabase.from("conversation_turns").select("session_id, seq, speaker, text, started_ms, ended_ms, interrupted, source, created_at").eq("user_id", userId)],
    ["merania_hlasu", supabase.from("audio_delivery_metrics").select("*").eq("user_id", userId)],
    ["merania_kamery", supabase.from("visual_analytics").select("*").eq("user_id", userId)],
    ["reporty", supabase.from("feedback_reports").select("*").eq("user_id", userId)],
    ["cvicenia", supabase.from("exercises").select("*").eq("user_id", userId)],
    ["pokusy", supabase.from("exercise_attempts").select("*").eq("user_id", userId)],
    ["predplatne", supabase.from("subscriptions").select("plan, status, current_period_end, cancel_at_period_end").eq("user_id", userId)],
    ["spotreba", supabase.from("usage_events").select("kind, quantity, session_id, created_at").eq("user_id", userId)],
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
