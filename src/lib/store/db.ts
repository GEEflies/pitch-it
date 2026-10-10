import "server-only";

import { getKv } from "@/lib/store/kv";
import { RELATIONS, TABLES, type AccessContext, type Row, type TableSpec } from "@/lib/store/schema";

/*
  Malý dotazovací jazyk nad Redisom s rovnakým tvarom ako predošlý klient Supabase
  (from().select().eq()…), aby dátová vrstva ostala čitateľná a takmer nezmenená.

  Uloženie: riadok ako JSON v `r:<tabuľka>:<pk>`, zoznam všetkých v `a:<tabuľka>`,
  indexy rovnosti v `i:<tabuľka>:<stĺpec>:<hodnota>`, unikátne kľúče v `u:<tabuľka>:<stĺpce>:<hodnoty>`.
  Klient používateľa (`scope: user`) uplatní pravidlá z schema.ts namiesto RLS; admin ich obchádza.
*/

export type StoreError = { code: string; message: string; details?: string };
export type DbResult<T> = { data: T; error: StoreError | null; count: number | null };

type Filter = { column: string; test: (value: unknown) => boolean; eq?: unknown; in?: unknown[] };
type Order = { column: string; ascending: boolean };
type Scope = { kind: "admin" } | { kind: "user"; uid: string };

const fail = (code: string, message: string): StoreError => ({ code, message });

function spec(table: string): TableSpec {
  const found = TABLES[table];
  if (!found) throw new Error(`Neznáma tabuľka ${table}`);
  return found;
}

const keyValue = (row: Row, columns: string[]) => columns.map((c) => String(row[c] ?? "")).join("\u001f");
const rowKey = (table: string, pk: string) => `r:${table}:${pk}`;
const allKey = (table: string) => `a:${table}`;
const indexKey = (table: string, column: string, value: unknown) => `i:${table}:${column}:${String(value)}`;
const uniqueKey = (table: string, columns: string[], row: Row) => `u:${table}:${columns.join(",")}:${keyValue(row, columns)}`;
const hasValues = (row: Row, columns: string[]) => columns.every((c) => row[c] !== null && row[c] !== undefined);

function compare(a: unknown, b: unknown): number {
  if (a === b) return 0;
  if (a === null || a === undefined) return 1;
  if (b === null || b === undefined) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b));
}

const num = (v: unknown) => (typeof v === "number" ? v : typeof v === "string" && v !== "" && !Number.isNaN(Number(v)) ? Number(v) : v);
const cmp = (a: unknown, b: unknown) => {
  const x = num(a);
  const y = num(b);
  return typeof x === "number" && typeof y === "number" ? x - y : String(a ?? "").localeCompare(String(b ?? ""));
};

/** Načítanie a zápis riadkov vrátane indexov. */
class TableIo {
  readonly table: string;
  readonly spec: TableSpec;
  private kv = getKv();

  constructor(table: string) {
    this.table = table;
    this.spec = spec(table);
  }

  pkOf(row: Row) {
    return keyValue(row, this.spec.pk);
  }

  async load(pks: string[]): Promise<Row[]> {
    const values = await this.kv.mget(pks.map((pk) => rowKey(this.table, pk)));
    return values.filter((v): v is string => v !== null).map((v) => JSON.parse(v) as Row);
  }

  async candidates(filters: Filter[]): Promise<Row[]> {
    const { pk, index = [] } = this.spec;
    if (pk.length === 1) {
      const byPk = filters.find((f) => f.column === pk[0] && (f.eq !== undefined || f.in));
      if (byPk) return this.load(byPk.in ? byPk.in.map(String) : [String(byPk.eq)]);
    }
    const indexed = filters.find((f) => index.includes(f.column) && (f.eq !== undefined || f.in));
    if (indexed) {
      const values = indexed.in ?? [indexed.eq];
      const sets = await Promise.all(values.map((v) => this.kv.smembers(indexKey(this.table, indexed.column, v))));
      return this.load([...new Set(sets.flat())]);
    }
    return this.load(await this.kv.smembers(allKey(this.table)));
  }

  /** Overí unikátne kľúče; vráti chybu 23505 pri kolízii s iným riadkom. */
  async claimUnique(row: Row, previous: Row | null): Promise<StoreError | null> {
    const pk = this.pkOf(row);
    const groups = [this.spec.pk, ...(this.spec.unique ?? [])];
    for (const columns of groups) {
      if (!hasValues(row, columns)) continue;
      const key = uniqueKey(this.table, columns, row);
      if (previous && hasValues(previous, columns) && uniqueKey(this.table, columns, previous) === key) continue;
      if (!(await this.kv.setnx(key, pk))) {
        const owner = await this.kv.get(key);
        if (owner !== pk) return fail("23505", `duplicate key value violates unique constraint (${this.table}: ${columns.join(", ")})`);
      }
    }
    return null;
  }

  async write(row: Row, previous: Row | null): Promise<void> {
    const pk = this.pkOf(row);
    const kv = this.kv;
    await kv.set(rowKey(this.table, pk), JSON.stringify(row));
    if (!previous) await kv.sadd(allKey(this.table), [pk]);
    for (const column of this.spec.index ?? []) {
      if (previous && previous[column] === row[column]) continue;
      if (previous && previous[column] !== null && previous[column] !== undefined) await kv.srem(indexKey(this.table, column, previous[column]), [pk]);
      if (row[column] !== null && row[column] !== undefined) await kv.sadd(indexKey(this.table, column, row[column]), [pk]);
    }
    if (previous) {
      for (const columns of this.spec.unique ?? []) {
        if (hasValues(previous, columns) && uniqueKey(this.table, columns, previous) !== uniqueKey(this.table, columns, row)) {
          await kv.del([uniqueKey(this.table, columns, previous)]);
        }
      }
    }
  }

  async erase(row: Row): Promise<void> {
    const pk = this.pkOf(row);
    const kv = this.kv;
    await kv.del([rowKey(this.table, pk)]);
    await kv.srem(allKey(this.table), [pk]);
    for (const column of this.spec.index ?? []) {
      if (row[column] !== null && row[column] !== undefined) await kv.srem(indexKey(this.table, column, row[column]), [pk]);
    }
    for (const columns of [this.spec.pk, ...(this.spec.unique ?? [])]) {
      if (hasValues(row, columns)) await kv.del([uniqueKey(this.table, columns, row)]);
    }
  }
}

/** Zmaže riadok a podľa väzieb kaskádovo aj závislé riadky (alebo im vynuluje odkaz). */
async function deleteWithCascade(table: string, row: Row): Promise<void> {
  const io = new TableIo(table);
  for (const [childTable, childSpec] of Object.entries(TABLES)) {
    for (const ref of childSpec.refs ?? []) {
      if (ref.table !== table) continue;
      const remoteValue = row[spec(table).pk[0]];
      const child = new TableIo(childTable);
      const rows = (await child.candidates([{ column: ref.column, test: (v) => v === remoteValue, eq: remoteValue }])).filter((r) => r[ref.column] === remoteValue);
      for (const childRow of rows) {
        if (childTable === table && child.pkOf(childRow) === io.pkOf(row)) continue;
        if (ref.onDelete === "cascade") await deleteWithCascade(childTable, childRow);
        else await child.write({ ...childRow, [ref.column]: null }, childRow);
      }
    }
  }
  await io.erase(row);
}

function accessContext(uid: string): AccessContext {
  const roles = new Map<string, Promise<string | null>>();
  return {
    uid,
    projectRole(projectId) {
      const id = String(projectId ?? "");
      if (!roles.has(id)) {
        roles.set(
          id,
          (async () => {
            if (!id) return null;
            const [project] = await new TableIo("projects").load([id]);
            if (!project) return null;
            if (project.owner_id === uid) return "owner";
            const [member] = await new TableIo("project_members").load([`${id}\u001f${uid}`]);
            return (member?.role as string | undefined) ?? null;
          })(),
        );
      }
      return roles.get(id)!;
    },
    async ownsEvent(eventId) {
      if (!eventId) return false;
      const [event] = await new TableIo("pitch_events").load([String(eventId)]);
      return event?.organizer_id === uid;
    },
    async liveSession(sessionId) {
      if (!sessionId) return false;
      const [session] = await new TableIo("training_sessions").load([String(sessionId)]);
      return session?.user_id === uid && session.status === "live";
    },
  };
}

type Embed = { table: string; columns: string; inner: boolean; alias: string };

function parseSelect(columns: string): { fields: string[] | null; embeds: Embed[] } {
  const embeds: Embed[] = [];
  const rest = columns.replace(/(\w+)(!inner)?\(([^)]*)\)/g, (_, table: string, inner: string | undefined, cols: string) => {
    embeds.push({ table, columns: cols, inner: Boolean(inner), alias: table });
    return "";
  });
  const parts = rest
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return { fields: parts.includes("*") ? null : parts, embeds };
}

function project(row: Row, fields: string[] | null): Row {
  if (!fields) return { ...row };
  const out: Row = {};
  for (const field of fields) out[field] = row[field] ?? null;
  return out;
}

type Operation = "select" | "insert" | "update" | "upsert" | "delete";

export class Query<T = unknown> implements PromiseLike<DbResult<T>> {
  private op: Operation = "select";
  private columns = "*";
  private returning = false;
  private filters: Filter[] = [];
  private orders: Order[] = [];
  private max: number | null = null;
  private offset = 0;
  private cardinality: "many" | "single" | "maybe" = "many";
  private countMode = false;
  private headOnly = false;
  private payload: Row[] = [];
  private patch: Row = {};
  private conflict: string[] | null = null;
  private ignoreDuplicates = false;

  private readonly table: string;
  private readonly scope: Scope;

  constructor(table: string, scope: Scope) {
    this.table = table;
    this.scope = scope;
  }

  select(columns = "*", options?: { count?: "exact"; head?: boolean }): Query<T> {
    if (this.op === "select") this.columns = columns;
    else {
      this.returning = true;
      this.columns = columns;
    }
    if (options?.count) this.countMode = true;
    if (options?.head) this.headOnly = true;
    return this;
  }
  insert(rows: Row | Row[]): Query<T> {
    this.op = "insert";
    this.payload = Array.isArray(rows) ? rows : [rows];
    return this;
  }
  upsert(rows: Row | Row[], options?: { onConflict?: string; ignoreDuplicates?: boolean }): Query<T> {
    this.op = "upsert";
    this.payload = Array.isArray(rows) ? rows : [rows];
    this.conflict = options?.onConflict ? options.onConflict.split(",").map((s) => s.trim()) : null;
    this.ignoreDuplicates = Boolean(options?.ignoreDuplicates);
    return this;
  }
  update(patch: Row): Query<T> {
    this.op = "update";
    this.patch = patch;
    return this;
  }
  delete(): Query<T> {
    this.op = "delete";
    return this;
  }

  private where(column: string, test: (value: unknown) => boolean, extra: Partial<Filter> = {}) {
    this.filters.push({ column, test, ...extra });
    return this;
  }
  eq(column: string, value: unknown) {
    return this.where(column, (v) => v === value || (v !== null && v !== undefined && String(v) === String(value)), { eq: value });
  }
  neq(column: string, value: unknown) {
    return this.where(column, (v) => v !== value && String(v) !== String(value));
  }
  in(column: string, values: readonly unknown[]) {
    const set = new Set(values.map(String));
    return this.where(column, (v) => v !== null && v !== undefined && set.has(String(v)), { in: [...values] });
  }
  is(column: string, value: null | boolean) {
    return this.where(column, (v) => (value === null ? v === null || v === undefined : v === value));
  }
  not(column: string, operator: "is" | "eq", value: unknown) {
    if (operator === "is") return this.where(column, (v) => (value === null ? v !== null && v !== undefined : v !== value));
    return this.neq(column, value);
  }
  gt(column: string, value: unknown) {
    return this.where(column, (v) => v !== null && v !== undefined && cmp(v, value) > 0);
  }
  gte(column: string, value: unknown) {
    return this.where(column, (v) => v !== null && v !== undefined && cmp(v, value) >= 0);
  }
  lt(column: string, value: unknown) {
    return this.where(column, (v) => v !== null && v !== undefined && cmp(v, value) < 0);
  }
  lte(column: string, value: unknown) {
    return this.where(column, (v) => v !== null && v !== undefined && cmp(v, value) <= 0);
  }
  match(values: Row) {
    for (const [column, value] of Object.entries(values)) this.eq(column, value);
    return this;
  }
  order(column: string, options?: { ascending?: boolean }) {
    this.orders.push({ column, ascending: options?.ascending ?? true });
    return this;
  }
  limit(count: number) {
    this.max = count;
    return this;
  }
  range(from: number, to: number) {
    this.offset = from;
    this.max = to - from + 1;
    return this;
  }
  single<R = T>(): Query<R> {
    this.cardinality = "single";
    return this as unknown as Query<R>;
  }
  maybeSingle<R = T>(): Query<R> {
    this.cardinality = "maybe";
    return this as unknown as Query<R>;
  }
  returns<R>(): Query<R> {
    return this as unknown as Query<R>;
  }

  then<A = DbResult<T>, B = never>(onfulfilled?: ((value: DbResult<T>) => A | PromiseLike<A>) | null, onrejected?: ((reason: unknown) => B | PromiseLike<B>) | null): Promise<A | B> {
    return this.run().then(onfulfilled, onrejected);
  }

  private ctx: AccessContext | null = null;
  private access() {
    if (this.scope.kind !== "user") return null;
    return (this.ctx ??= accessContext(this.scope.uid));
  }

  private async allowed(rule: keyof Pick<TableSpec, "read" | "insert" | "update" | "remove">, row: Row): Promise<boolean> {
    const ctx = this.access();
    if (!ctx) return true;
    const check = spec(this.table)[rule];
    return check ? Boolean(await check(row, ctx)) : false;
  }

  /** Riadky zodpovedajúce filtrom (vrátane filtrov na vnorené tabuľky „tabuľka.stĺpec“). */
  private async matching(io: TableIo, embeds: Embed[]): Promise<Row[]> {
    const own = this.filters.filter((f) => !f.column.includes("."));
    const nested = this.filters.filter((f) => f.column.includes("."));
    let rows = (await io.candidates(own)).filter((row) => own.every((f) => f.test(row[f.column])));
    if (embeds.length || nested.length) {
      rows = (
        await Promise.all(
          rows.map(async (row) => {
            const out: Row = { ...row };
            for (const embed of embeds) {
              const relation = RELATIONS[embed.table];
              if (!relation) throw new Error(`Neznáma väzba ${embed.table}`);
              const value = row[relation.local];
              const related =
                value === null || value === undefined
                  ? []
                  : (await new TableIo(embed.table).candidates([{ column: relation.remote, test: (v) => v === value, eq: value }])).filter((r) => r[relation.remote] === value);
              const scoped = nested.filter((f) => f.column.startsWith(`${embed.table}.`));
              const match = related.find((r) => scoped.every((f) => f.test(r[f.column.slice(embed.table.length + 1)])));
              if (!match && (embed.inner || scoped.length)) return null;
              out[embed.alias] = match ? project(match, parseSelect(embed.columns).fields) : null;
            }
            return out;
          }),
        )
      ).filter((row): row is Row => row !== null);
    }
    if (this.scope.kind === "user") {
      const visible = await Promise.all(rows.map((row) => this.allowed("read", row)));
      rows = rows.filter((_, i) => visible[i]);
    }
    return rows;
  }

  private shape(rows: Row[], fields: string[] | null, embeds: Embed[]): DbResult<T> {
    const shaped = rows.map((row) => {
      const out = project(row, fields);
      for (const embed of embeds) out[embed.alias] = row[embed.alias] ?? null;
      return out;
    });
    if (this.cardinality === "many") return { data: shaped as T, error: null, count: this.countMode ? shaped.length : null };
    if (shaped.length > 1) return { data: null as T, error: fail("PGRST116", "JSON object requested, multiple rows returned"), count: null };
    if (shaped.length === 0) {
      return this.cardinality === "maybe"
        ? { data: null as T, error: null, count: null }
        : { data: null as T, error: fail("PGRST116", "JSON object requested, 0 rows returned"), count: null };
    }
    return { data: shaped[0] as T, error: null, count: null };
  }

  private async run(): Promise<DbResult<T>> {
    try {
      const io = new TableIo(this.table);
      const { fields, embeds } = parseSelect(this.columns);
      const now = new Date().toISOString();

      if (this.op === "select") {
        let rows = await this.matching(io, embeds);
        const total = rows.length;
        for (const order of [...this.orders].reverse()) {
          rows = [...rows].sort((a, b) => (order.ascending ? 1 : -1) * compare(a[order.column], b[order.column]));
        }
        if (this.offset || this.max !== null) rows = rows.slice(this.offset, this.max === null ? undefined : this.offset + this.max);
        if (this.headOnly) return { data: null as T, error: null, count: total };
        const result = this.shape(rows, fields, embeds);
        return this.countMode ? { ...result, count: total } : result;
      }

      if (this.op === "insert" || this.op === "upsert") {
        const written: Row[] = [];
        for (const input of this.payload) {
          const base: Row = { ...(io.spec.defaults?.() ?? {}), created_at: now, ...(io.spec.updatedAt ? { updated_at: now } : {}) };
          const draft: Row = { ...base, ...input };
          let previous: Row | null = null;
          if (this.op === "upsert") {
            const keys = this.conflict ?? io.spec.pk;
            if (hasValues(draft, keys)) {
              const ownerPk = keys.join() === io.spec.pk.join() ? io.pkOf(draft) : await getKv().get(uniqueKey(this.table, keys, draft));
              if (ownerPk) [previous] = await io.load([ownerPk]);
            }
          }
          if (previous) {
            if (this.ignoreDuplicates) continue;
            const next: Row = { ...previous, ...input, ...(io.spec.updatedAt ? { updated_at: now } : {}) };
            if (!(await this.allowed("update", previous)) || !(await this.allowed("update", next))) return { data: null as T, error: fail("42501", `permission denied for ${this.table}`), count: null };
            const conflict = await io.claimUnique(next, previous);
            if (conflict) return { data: null as T, error: conflict, count: null };
            await io.write(next, previous);
            written.push(next);
            continue;
          }
          if (!(await this.allowed("insert", draft))) return { data: null as T, error: fail("42501", `new row violates row-level security policy for ${this.table}`), count: null };
          const conflict = await io.claimUnique(draft, null);
          if (conflict) {
            if (this.ignoreDuplicates) continue;
            return { data: null as T, error: conflict, count: null };
          }
          await io.write(draft, null);
          written.push(draft);
        }
        if (!this.returning) return { data: null as T, error: null, count: null };
        return this.shape(written, fields, []);
      }

      const rows = await this.matching(io, []);

      if (this.op === "update") {
        const written: Row[] = [];
        for (const row of rows) {
          const next: Row = { ...row, ...this.patch, ...(io.spec.updatedAt ? { updated_at: now } : {}) };
          if (!(await this.allowed("update", row)) || !(await this.allowed("update", next))) continue;
          const conflict = await io.claimUnique(next, row);
          if (conflict) return { data: null as T, error: conflict, count: null };
          await io.write(next, row);
          written.push(next);
        }
        if (!this.returning) return { data: null as T, error: null, count: null };
        return this.shape(written, fields, []);
      }

      const removed: Row[] = [];
      for (const row of rows) {
        if (!(await this.allowed("remove", row))) continue;
        await deleteWithCascade(this.table, row);
        removed.push(row);
      }
      if (!this.returning) return { data: null as T, error: null, count: null };
      return this.shape(removed, fields, []);
    } catch (error) {
      return { data: null as T, error: fail("XX000", error instanceof Error ? error.message : "store error"), count: null };
    }
  }
}

export type RpcName = "can_edit_project" | "close_stale_sessions";

export class Db {
  private readonly scope: Scope;

  constructor(scope: Scope) {
    this.scope = scope;
  }

  from<T = Row[]>(table: string): Query<T> {
    return new Query<T>(table, this.scope);
  }

  get userId(): string | null {
    return this.scope.kind === "user" ? this.scope.uid : null;
  }

  async rpc(name: RpcName, args: Record<string, unknown>): Promise<DbResult<unknown>> {
    try {
      if (name === "can_edit_project") {
        if (this.scope.kind !== "user") return { data: true, error: null, count: null };
        const role = await accessContext(this.scope.uid).projectRole(args.p_project_id);
        return { data: role === "owner" || role === "editor", error: null, count: null };
      }
      return { data: await closeStaleSessions(String(args.p_user_id), 2 * 60_000), error: null, count: null };
    } catch (error) {
      return { data: null, error: fail("XX000", error instanceof Error ? error.message : "rpc"), count: null };
    }
  }
}

/** Uzavrie živé relácie bez signálu a vyúčtuje ich do posledného signálu (pôvodne SQL funkcia). */
async function closeStaleSessions(userId: string, staleAfterMs: number): Promise<number> {
  const admin = new Db({ kind: "admin" });
  const { data } = await admin.from<Row[]>("training_sessions").select("*").eq("user_id", userId).eq("status", "live");
  let closed = 0;
  for (const s of data ?? []) {
    const last = (s.last_heartbeat_at ?? s.started_at ?? s.created_at) as string;
    if (Date.parse(last) >= Date.now() - staleAfterMs) continue;
    const started = s.started_at ? Date.parse(s.started_at as string) : Date.parse(last);
    const seconds = Math.min(Math.max(0, Math.floor((Date.parse(last) - started) / 1000)), Number(s.target_duration_seconds) + 120);
    await admin
      .from("training_sessions")
      .update({ status: "abandoned", end_reason: "abandoned", ended_at: s.last_heartbeat_at ?? new Date().toISOString(), billed_seconds: seconds })
      .eq("id", s.id);
    const billed = Number(s.billed_seconds ?? 0);
    if (seconds > billed) await admin.from("usage_events").insert({ user_id: userId, kind: "realtime_seconds", quantity: seconds - billed, session_id: s.id });
    closed++;
  }
  return closed;
}

export function adminDb(): Db {
  return new Db({ kind: "admin" });
}

export function userDb(uid: string): Db {
  return new Db({ kind: "user", uid });
}
