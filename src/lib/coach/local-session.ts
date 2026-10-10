import type { SessionSummary } from "@/lib/coach/pose/session";

/*
  Video a fotky chýb z posledného nahrávania nejdú na server. Držíme ich v pamäti karty
  a kópiu v IndexedDB, aby ich Feedback ukázal aj po obnovení stránky alebo tvrdej navigácii.
  Uložené je vždy len posledné nahrávanie.
*/

type LocalSession = { summary: SessionSummary; videoUrl: string | null };

const DB = "pitchit-local";
const STORE = "sessions";

const sessions = new Map<string, LocalSession>();

function openDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function persist(attemptId: string, session: LocalSession) {
  const video = session.videoUrl ? await fetch(session.videoUrl).then((r) => r.blob()).catch(() => null) : null;
  const db = await openDb();
  if (!db) return;
  try {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    store.clear();
    store.put({ summary: session.summary, video }, attemptId);
    await new Promise((resolve) => {
      tx.oncomplete = tx.onerror = tx.onabort = resolve;
    });
  } catch {
    // bez IndexedDB vydrží len v pamäti karty
  } finally {
    db.close();
  }
}

export function keepLocalSession(attemptId: string, session: LocalSession) {
  for (const [id, old] of sessions) {
    if (old.videoUrl && old.videoUrl !== session.videoUrl) URL.revokeObjectURL(old.videoUrl);
    sessions.delete(id);
  }
  sessions.set(attemptId, session);
  void persist(attemptId, session);
}

/** Posledné nahrávanie z pamäte karty, inak z IndexedDB. */
export async function loadLocalSession(attemptId: string): Promise<LocalSession | null> {
  const cached = sessions.get(attemptId);
  if (cached) return cached;
  const db = await openDb();
  if (!db) return null;
  try {
    const row = await new Promise<{ summary: SessionSummary; video: Blob | null } | undefined>((resolve) => {
      const req = db.transaction(STORE).objectStore(STORE).get(attemptId);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(undefined);
    });
    if (!row) return null;
    const session = { summary: row.summary, videoUrl: row.video?.size ? URL.createObjectURL(row.video) : null };
    sessions.set(attemptId, session);
    return session;
  } catch {
    return null;
  } finally {
    db.close();
  }
}
