import "server-only";

import { check, must } from "@/lib/db/core";
import type { ProfileRow, UserSettingsRow } from "@/lib/db/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function getProfile(userId: string): Promise<ProfileRow | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle<ProfileRow>();
  check({ error }, "profile.get");
  return data;
}

export async function getSettings(userId: string): Promise<UserSettingsRow | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
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
  const supabase = await createSupabaseServerClient();
  const [profile, settings] = await Promise.all([
    supabase.from("profiles").update({ display_name: input.display_name }).eq("id", userId),
    supabase
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
  const supabase = await createSupabaseServerClient();
  const result = await supabase.from("current_consents").select("kind, granted, version, created_at").eq("user_id", userId);
  const rows = must(result, "consents.current") as Array<{ kind: ConsentKind; granted: boolean; version: string; created_at: string }>;
  return Object.fromEntries(rows.map((row) => [row.kind, { granted: row.granted, version: row.version, created_at: row.created_at }]));
}

export async function recordConsent(userId: string, kind: ConsentKind, granted: boolean, version: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("consents").insert({ user_id: userId, kind, granted, version });
  check({ error }, "consents.record");
}

/** Uloží výsledok úvodného kvízu (alebo jeho preskočenie, ak `answers` chýba). */
export async function completeOnboarding(
  userId: string,
  input: {
    answers: Record<string, unknown> | null;
    settings?: { default_mode: UserSettingsRow["default_mode"]; coach_focus: string[] };
  },
): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const profileUpdate: Partial<ProfileRow> = { onboarding_completed_at: new Date().toISOString() };
  if (input.answers) profileUpdate.onboarding_answers = input.answers;
  const [profile, settings] = await Promise.all([
    supabase.from("profiles").update(profileUpdate).eq("id", userId),
    input.settings ? supabase.from("user_settings").update(input.settings).eq("user_id", userId) : Promise.resolve({ error: null }),
  ]);
  check(profile, "profile.onboarding");
  check(settings, "settings.onboarding");
}
