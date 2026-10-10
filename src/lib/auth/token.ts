import { createHmac, timingSafeEqual } from "node:crypto";

/*
  Podpísané tokeny (HMAC-SHA256): cookie relácie, odkazy na obnovu hesla, OAuth stav
  a nahrávanie súborov. Synchrónne (node:crypto), aby overenie relácie nebolo
  „nekešované I/O“ pre Cache Components. Proxy beží v Node.js, takže funguje aj tam.
*/

const DEV_SECRET = "pitchit-dev-secret-change-me-in-production-0000";

/** Tajomstvo na podpis. V produkcii povinné (AUTH_SECRET), v dev náhradné. */
export function authSecret(): string | null {
  const value = process.env.AUTH_SECRET?.trim();
  if (value && value.length >= 32) return value;
  return process.env.NODE_ENV === "production" ? null : DEV_SECRET;
}

const b64url = (data: Buffer | string) => Buffer.from(data).toString("base64url");
const hmac = (secret: string, data: string) => createHmac("sha256", secret).update(data).digest();

/** Podpíše objekt s expiráciou (sekundy). Účel oddeľuje typy tokenov. */
export function signToken(purpose: string, payload: Record<string, unknown>, ttlSeconds: number): string {
  const secret = authSecret();
  if (!secret) throw new Error("AUTH_SECRET nie je nastavený.");
  const body = b64url(JSON.stringify({ ...payload, p: purpose, exp: Math.floor(Date.now() / 1000) + ttlSeconds }));
  return `${body}.${b64url(hmac(secret, body))}`;
}

export function verifyToken<T extends Record<string, unknown>>(purpose: string, token: string | undefined | null): T | null {
  const secret = authSecret();
  if (!secret || !token) return null;
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;
  try {
    const given = Buffer.from(signature, "base64url");
    const expected = hmac(secret, body);
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as T & { p?: string; exp?: number };
    if (payload.p !== purpose || typeof payload.exp !== "number" || payload.exp < Date.now() / 1000) return null;
    return payload;
  } catch {
    return null;
  }
}

export const SESSION_COOKIE = "pi_session";
export const SESSION_TTL = 60 * 60 * 24 * 30;

export type SessionPayload = { sub: string; email: string | null };

export function readSession(token: string | undefined): SessionPayload | null {
  return verifyToken<SessionPayload>("session", token);
}
