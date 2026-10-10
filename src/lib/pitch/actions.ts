"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { findEventByCode, getPitchAttempt, lastShare, sharePitchAttempts } from "@/lib/db/pitch";
import { trackEvent } from "@/lib/events/track";
import { EVENT_COOKIE } from "@/lib/pitch/event-cookie";

const shareSchema = z.object({
  attemptId: z.string().uuid(),
  name: z.string().trim().min(1, "Doplň meno.").max(80),
  team: z.string().trim().min(1, "Doplň firmu alebo tím.").max(120),
  email: z.string().trim().email("Skontroluj e-mail.").max(200),
});

export type ShareResult = { status: "ok" } | { status: "error"; message: string };

/** Zdieľa pokus s mentorom: uloží meno, tím a e-mail a priradí pokus k akcii. */
export async function sharePitch(input: unknown): Promise<ShareResult> {
  const user = await getCurrentUser();
  if (!user) return { status: "error", message: "Relácia vypršala. Prihlás sa znova." };
  const parsed = shareSchema.safeParse(input);
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? "Skontroluj údaje." };

  try {
    const attempt = await getPitchAttempt(parsed.data.attemptId);
    if (!attempt || attempt.user_id !== user.id) return { status: "error", message: "Pokus sa nenašiel." };
    const code = (await cookies()).get(EVENT_COOKIE)?.value;
    const event = code ? await findEventByCode(code) : null;
    const eventId = event?.id ?? (await lastShare(user.id))?.event_id ?? null;
    await sharePitchAttempts(user.id, attempt.id, { eventId, name: parsed.data.name, team: parsed.data.team, email: parsed.data.email });
    await trackEvent(user.id, "pitch_shared", { event: Boolean(eventId) });
    revalidatePath(`/app/nahravka/${attempt.id}`);
    return { status: "ok" };
  } catch (error) {
    console.error("[pitch.share]", error instanceof Error ? error.message : error);
    return { status: "error", message: "Zdieľanie sa nepodarilo. Skús to znova." };
  }
}
