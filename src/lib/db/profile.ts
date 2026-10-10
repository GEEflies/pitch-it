import "server-only";

import { check, must } from "@/lib/db/core";
import type { ProfileRow, UserSettingsRow } from "@/lib/db/types";
import { getUserDb } from "@/lib/store/client";

export async function getProfile(userId: string): Promise<ProfileRow | null> {
  const db = await getUserDb();
  const { data, error } = await db.from("profiles").select("*").eq("id", userId).maybeSingle<ProfileRow>();
  check({ error }, "profile.get");
  return data;
}

export async function getSettings(userId: string): Promise<UserSettingsRow | null> {
  const db = await getUserDb();
  const { data, error } = await db
    .from("user_settings")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle<UserSettingsRow>();
  check({ error }, "settings.get");
  return data;
}

export async function updateProfileAndSettings(
  userId: string,
  input: {
    display_name: string | null;
    default_mode: UserSettingsRow["default_mode"];
    coach_focus: string[];
    data_retention_days: UserSettingsRow["data_retention_days"];
  },
): Promise<void> {
  const db = await getUserDb();
  const [profile, settings] = await Promise.all([
    db.from("profiles").update({ display_name: input.display_name }).eq("id", userId),
    db
      .from("user_settings")
      .update({
        default_mode: input.default_mode,
        coach_focus: input.coach_focus,
        data_retention_days: input.data_retention_days,
      })
      .eq("user_id", userId),
  ]);
  check(profile, "profile.update");
  check(settings, "settings.update");
}

export type ConsentKind =
  | "terms"
  | "privacy_notice"
  | "age_18"
  | "microphone_processing"
  | "camera_analysis"
  | "audio_recording"
  | "product_emails";

export async function getCurrentConsents(userId: string): Promise<Partial<Record<ConsentKind, { granted: boolean; version: string; created_at: string }>>> {
  const db = await getUserDb();
  const result = await db.from("consents").select("kind, granted, version, created_at").eq("user_id", userId).order("created_at", { ascending: true });
  const rows = must(result, "consents.current") as Array<{ kind: ConsentKind; granted: boolean; version: string; created_at: string }>;
  // Posledný záznam pre každý druh súhlasu (pôvodne pohľad current_consents).
  return Object.fromEntries(rows.map((row) => [row.kind, { granted: row.granted, version: row.version, created_at: row.created_at }]));
}

export async function recordConsent(userId: string, kind: ConsentKind, granted: boolean, version: string): Promise<void> {
  const db = await getUserDb();
  const { error } = await db.from("consents").insert({ user_id: userId, kind, granted, version });
  check({ error }, "consents.record");
}

/** Uloží výsledok úvodného kvízu (alebo jeho preskočenie, ak `answers` chýba). */
export async function completeOnboarding(
  userId: string,
  input: { answers: Record<string, unknown> | null; notes?: string | null },
): Promise<void> {
  const db = await getUserDb();
  const profileUpdate: Partial<ProfileRow> = { onboarding_completed_at: new Date().toISOString() };
  if (input.answers) profileUpdate.onboarding_answers = input.answers;
  if (input.notes !== undefined) profileUpdate.pitch_notes = input.notes;
  check(await db.from("profiles").update(profileUpdate).eq("id", userId), "profile.onboarding");
}

/** Poznámky k pitchu (zobrazia sa nad kamerou pri nahrávaní). */
export async function savePitchNotes(userId: string, notes: string | null): Promise<void> {
  const db = await getUserDb();
  check(await db.from("profiles").update({ pitch_notes: notes }).eq("id", userId), "profile.notes");
}
