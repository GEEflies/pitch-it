import "server-only";

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

/*
  Úložisko kľúč–hodnota. V produkcii Upstash Redis cez REST (premenné nastaví integrácia
  Upstash na Verceli: KV_REST_API_URL + KV_REST_API_TOKEN, alebo UPSTASH_REDIS_REST_*).
  Bez nich pamäť procesu; pri `next dev` sa ukladá do .data/store.json, aby dáta prežili reštart.
*/

export interface Kv {
  get(key: string): Promise<string | null>;
  mget(keys: string[]): Promise<Array<string | null>>;
  set(key: string, value: string, ttlSeconds?: number): Promise<void>;
  /** Zapíše iba ak kľúč neexistuje. Vráti true pri úspechu. */
  setnx(key: string, value: string): Promise<boolean>;
  del(keys: string[]): Promise<void>;
  sadd(key: string, members: string[]): Promise<void>;
  srem(key: string, members: string[]): Promise<void>;
  smembers(key: string): Promise<string[]>;
}

type RestConfig = { url: string; token: string };

function restConfig(): RestConfig | null {
  const url = (process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL)?.trim();
  const token = (process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN)?.trim();
  return url && token ? { url: url.replace(/\/$/, ""), token } : null;
}

export function isRedisConfigured(): boolean {
  return restConfig() !== null;
}

class RestKv implements Kv {
  private readonly config: RestConfig;

  constructor(config: RestConfig) {
    this.config = config;
  }

  private async call<T>(command: Array<string | number>): Promise<T> {
    const response = await fetch(this.config.url, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.config.token}`, "Content-Type": "application/json" },
      body: JSON.stringify(command),
      cache: "no-store",
    });
    const body = (await response.json().catch(() => null)) as { result?: T; error?: string } | null;
    if (!response.ok || !body || body.error) throw new Error(`kv.${command[0]}: ${body?.error ?? response.status}`);
    return body.result as T;
  }

  get(key: string) {
    return this.call<string | null>(["GET", key]);
  }
  async mget(keys: string[]) {
    if (keys.length === 0) return [];
    const out: Array<string | null> = [];
    for (let i = 0; i < keys.length; i += 500) out.push(...(await this.call<Array<string | null>>(["MGET", ...keys.slice(i, i + 500)])));
    return out;
  }
  async set(key: string, value: string, ttlSeconds?: number) {
    await this.call(ttlSeconds ? ["SET", key, value, "EX", ttlSeconds] : ["SET", key, value]);
  }
  async setnx(key: string, value: string) {
    return (await this.call<string | null>(["SET", key, value, "NX"])) === "OK";
  }
  async del(keys: string[]) {
    if (keys.length) await this.call(["DEL", ...keys]);
  }
  async sadd(key: string, members: string[]) {
    if (members.length) await this.call(["SADD", key, ...members]);
  }
  async srem(key: string, members: string[]) {
    if (members.length) await this.call(["SREM", key, ...members]);
  }
  smembers(key: string) {
    return this.call<string[]>(["SMEMBERS", key]);
  }
}

type MemoryState = { strings: Map<string, { value: string; expires: number | null }>; sets: Map<string, Set<string>> };

class MemoryKv implements Kv {
  private saveTimer: ReturnType<typeof setTimeout> | null = null;

  private readonly state: MemoryState;
  private readonly file: string | null;

  constructor(state: MemoryState, file: string | null) {
    this.state = state;
    this.file = file;
  }

  private persist() {
    if (!this.file || this.saveTimer) return;
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      const data = {
        strings: [...this.state.strings.entries()],
        sets: [...this.state.sets.entries()].map(([k, v]) => [k, [...v]]),
      };
      try {
        mkdirSync(path.dirname(this.file!), { recursive: true });
        writeFileSync(this.file!, JSON.stringify(data));
      } catch (error) {
        console.error("[kv] uloženie zlyhalo:", error instanceof Error ? error.message : error);
      }
    }, 200);
  }

  private read(key: string): string | null {
    const entry = this.state.strings.get(key);
    if (!entry) return null;
    if (entry.expires !== null && entry.expires < Date.now()) {
      this.state.strings.delete(key);
      return null;
    }
    return entry.value;
  }

  async get(key: string) {
    return this.read(key);
  }
  async mget(keys: string[]) {
    return keys.map((key) => this.read(key));
  }
  async set(key: string, value: string, ttlSeconds?: number) {
    this.state.strings.set(key, { value, expires: ttlSeconds ? Date.now() + ttlSeconds * 1000 : null });
    this.persist();
  }
  async setnx(key: string, value: string) {
    if (this.read(key) !== null) return false;
    await this.set(key, value);
    return true;
  }
  async del(keys: string[]) {
    for (const key of keys) {
      this.state.strings.delete(key);
      this.state.sets.delete(key);
    }
    this.persist();
  }
  async sadd(key: string, members: string[]) {
    let set = this.state.sets.get(key);
    if (!set) this.state.sets.set(key, (set = new Set()));
    for (const member of members) set.add(member);
    this.persist();
  }
  async srem(key: string, members: string[]) {
    const set = this.state.sets.get(key);
    if (!set) return;
    for (const member of members) set.delete(member);
    if (set.size === 0) this.state.sets.delete(key);
    this.persist();
  }
  async smembers(key: string) {
    return [...(this.state.sets.get(key) ?? [])];
  }
}

function loadState(file: string | null): MemoryState {
  const state: MemoryState = { strings: new Map(), sets: new Map() };
  if (!file || !existsSync(file)) return state;
  try {
    const data = JSON.parse(readFileSync(file, "utf8")) as { strings: Array<[string, { value: string; expires: number | null }]>; sets: Array<[string, string[]]> };
    for (const [k, v] of data.strings) state.strings.set(k, v);
    for (const [k, v] of data.sets) state.sets.set(k, new Set(v));
  } catch {
    // Poškodený súbor: začneme odznova.
  }
  return state;
}

const globalKv = globalThis as unknown as { __piKv?: Kv; __piKvWarned?: boolean };

export function getKv(): Kv {
  if (globalKv.__piKv) return globalKv.__piKv;
  const config = restConfig();
  if (config) {
    globalKv.__piKv = new RestKv(config);
  } else {
    const file = process.env.NODE_ENV === "development" ? path.join(process.cwd(), ".data", "store.json") : null;
    if (process.env.NODE_ENV === "production" && !globalKv.__piKvWarned) {
      globalKv.__piKvWarned = true;
      console.warn("[kv] Redis nie je nastavený (KV_REST_API_URL, KV_REST_API_TOKEN). Dáta sú iba v pamäti a stratia sa.");
    }
    globalKv.__piKv = new MemoryKv(loadState(file), file);
  }
  return globalKv.__piKv;
}

/** Iba pre testy: čistá pamäť. */
export function resetMemoryKv(): void {
  globalKv.__piKv = new MemoryKv({ strings: new Map(), sets: new Map() }, null);
}
