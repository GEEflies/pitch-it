import type { SessionSummary } from "@/lib/coach/pose/session";

/*
  Video a fotky chýb z posledného nahrávania žijú len v pamäti tejto karty prehliadača.
  Feedback ich ukáže, ak naň používateľ prejde hneď po nahrávaní (klientská navigácia).
*/

type LocalSession = { summary: SessionSummary; videoUrl: string | null };

const sessions = new Map<string, LocalSession>();

export function keepLocalSession(attemptId: string, session: LocalSession) {
  for (const [id, old] of sessions) {
    if (old.videoUrl) URL.revokeObjectURL(old.videoUrl);
    sessions.delete(id);
  }
  sessions.set(attemptId, session);
}

export function getLocalSession(attemptId: string): LocalSession | null {
  return sessions.get(attemptId) ?? null;
}
