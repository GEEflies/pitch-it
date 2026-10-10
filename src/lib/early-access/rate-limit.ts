import "server-only";

/*
  Rýchly limit v pamäti jednej inštancie servera. Na serverless platformách
  nie je zdieľaný medzi inštanciami, preto ho dopĺňa limit v databáze
  (pozri store.ts). Slúži ako lacná prvá bariéra.
*/
const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 6;
const MAX_KEYS = 5_000;

const attempts = new Map<string, number[]>();

export function consumeAttempt(key: string, now = Date.now()): boolean {
  const recent = (attempts.get(key) ?? []).filter((time) => now - time < WINDOW_MS);

  if (recent.length >= MAX_ATTEMPTS) {
    attempts.set(key, recent);
    return false;
  }

  recent.push(now);
  attempts.set(key, recent);

  if (attempts.size > MAX_KEYS) {
    for (const [storedKey, times] of attempts) {
      if (times.every((time) => now - time >= WINDOW_MS)) attempts.delete(storedKey);
    }
    // Ak je mapa stále plná, zahoď najstaršie záznamy.
    while (attempts.size > MAX_KEYS) {
      const oldest = attempts.keys().next().value;
      if (oldest === undefined) break;
      attempts.delete(oldest);
    }
  }

  return true;
}
