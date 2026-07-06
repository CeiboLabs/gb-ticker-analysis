// Home server — bindings locales que reemplazan a Cloudflare.
//
// Toda la capa de datos del sitio habla contra DOS interfaces mínimas
// (D1Database y R2Bucket, definidas en lib/metrics.ts) resueltas por
// process.env/globalThis. Este módulo implementa esas interfaces sobre
// better-sqlite3 (un archivo .sqlite3) y el filesystem (un directorio por
// bucket), y las registra en globalThis al arrancar el server de Node — el
// resto del código NO cambia: getMetricsDb()/getDocsBucket() encuentran los
// bindings igual que en Cloudflare.
//
// SOLO Node (better-sqlite3 es un addon nativo): lo importa dinámicamente
// instrumentation.ts gateado por NEXT_RUNTIME === "nodejs". Jamás importarlo
// desde código de cliente o rutas.
//
// Datos en DATA_DIR (default ./data):
//   DATA_DIR/bengochea.sqlite3       — la base (WAL)
//   DATA_DIR/r2/docs/...             — PDFs del panel (binding DOCS)
//   DATA_DIR/r2/instagram-media/...  — stills de Instagram (binding INSTAGRAM_MEDIA)

import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import Database from "better-sqlite3";
import type {
  D1Database,
  D1PreparedStatement,
  R2Bucket,
  R2Object,
  R2ObjectBody,
  R2HTTPMetadata,
} from "@/lib/metrics";

// ── D1 sobre better-sqlite3 ──────────────────────────────────────────────────

// better-sqlite3 no acepta undefined ni booleanos como parámetros.
function normalizeParam(v: unknown): unknown {
  if (v === undefined) return null;
  if (typeof v === "boolean") return v ? 1 : 0;
  return v;
}

type D1RunResult = { success: boolean; meta: { changes: number; last_row_id: number } };

class SqliteStatement implements D1PreparedStatement {
  constructor(
    private readonly db: Database.Database,
    private readonly sql: string,
    private readonly params: unknown[] = [],
  ) {}

  bind(...values: unknown[]): D1PreparedStatement {
    return new SqliteStatement(this.db, this.sql, values.map(normalizeParam));
  }

  /** Ejecución sincrónica con la forma de resultado de D1 (la usa también batch). */
  execSync(): { kind: "rows"; results: unknown[] } | { kind: "run"; result: D1RunResult } {
    const stmt = this.db.prepare(this.sql);
    // `reader` distingue SELECT/RETURNING (filas) de INSERT/UPDATE/DELETE puros.
    if (stmt.reader) {
      return { kind: "rows", results: stmt.all(...this.params) };
    }
    const info = stmt.run(...this.params);
    return {
      kind: "run",
      result: { success: true, meta: { changes: info.changes, last_row_id: Number(info.lastInsertRowid) } },
    };
  }

  run(): Promise<unknown> {
    const r = this.execSync();
    return Promise.resolve(r.kind === "run" ? r.result : { success: true, meta: { changes: 0, last_row_id: 0 } });
  }

  all<T = unknown>(): Promise<{ results: T[] }> {
    const stmt = this.db.prepare(this.sql);
    return Promise.resolve({ results: stmt.all(...this.params) as T[] });
  }

  first<T = unknown>(): Promise<T | null> {
    const stmt = this.db.prepare(this.sql);
    const row = stmt.get(...this.params);
    return Promise.resolve((row ?? null) as T | null);
  }
}

class SqliteD1 implements D1Database {
  constructor(private readonly db: Database.Database) {}

  prepare(query: string): D1PreparedStatement {
    return new SqliteStatement(this.db, query);
  }

  /** Como el batch de D1: todas las sentencias en UNA transacción, o ninguna. */
  batch(statements: D1PreparedStatement[]): Promise<unknown[]> {
    const tx = this.db.transaction((stmts: SqliteStatement[]) =>
      stmts.map((s) => {
        const r = s.execSync();
        return r.kind === "run" ? r.result : { success: true, results: r.results, meta: { changes: 0, last_row_id: 0 } };
      }),
    );
    return Promise.resolve(tx(statements as SqliteStatement[]));
  }
}

// ── Bootstrap del esquema ────────────────────────────────────────────────────

// En una base FRESCA se aplica db/schema.sql completo (los ALTER del histórico
// corren bien sobre tablas recién creadas) + la migración del panel (que trae
// el seed de informes; es puro CREATE IF NOT EXISTS / INSERT OR IGNORE). El
// guard por PRAGMA user_version hace el arranque idempotente. Migraciones
// FUTURAS sobre una base ya inicializada: aplicarlas con `sqlite3` CLI y subir
// user_version — documentado en docs/RUNBOOK-home.md.
const SCHEMA_VERSION = 1;

function ensureSchema(db: Database.Database, repoRoot: string): void {
  const version = db.pragma("user_version", { simple: true }) as number;
  if (version >= SCHEMA_VERSION) return;
  const schema = fs.readFileSync(path.join(repoRoot, "db", "schema.sql"), "utf8");
  const panel = fs.readFileSync(path.join(repoRoot, "db", "migrations", "2026-07-04-panel-admin.sql"), "utf8");
  const apply = db.transaction(() => {
    db.exec(schema);
    db.exec(panel);
  });
  apply();
  db.pragma(`user_version = ${SCHEMA_VERSION}`);
  console.log("[home] esquema inicializado (user_version=1)");
}

// ── R2 sobre filesystem ──────────────────────────────────────────────────────

// Las keys las genera SIEMPRE el server (informes/<slug>/<ts>.pdf), pero el
// adaptador igual valida: alfabeto cerrado, sin "..", sin absolutos — un bug
// futuro no se convierte en path traversal.
const KEY_RE = /^[A-Za-z0-9][A-Za-z0-9._/-]*$/;

function keyToPath(root: string, key: string): string | null {
  if (!KEY_RE.test(key) || key.includes("..")) return null;
  const resolved = path.resolve(root, key);
  return resolved.startsWith(root + path.sep) ? resolved : null;
}

type Meta = { contentType?: string; cacheControl?: string };

function fsEtag(stat: fs.Stats): string {
  return `"fs-${stat.size}-${Math.floor(stat.mtimeMs)}"`;
}

function toR2Object(key: string, stat: fs.Stats, meta: Meta): R2Object {
  const httpMetadata: R2HTTPMetadata = { contentType: meta.contentType, cacheControl: meta.cacheControl };
  return {
    key,
    size: stat.size,
    httpEtag: fsEtag(stat),
    httpMetadata,
    writeHttpMetadata(headers: Headers) {
      if (httpMetadata.contentType) headers.set("Content-Type", httpMetadata.contentType);
      if (httpMetadata.cacheControl) headers.set("Cache-Control", httpMetadata.cacheControl);
    },
  };
}

class FsBucket implements R2Bucket {
  constructor(private readonly root: string) {
    fs.mkdirSync(root, { recursive: true });
  }

  private metaPath(filePath: string): string {
    return `${filePath}.meta.json`;
  }

  private readMeta(filePath: string): Meta {
    try {
      return JSON.parse(fs.readFileSync(this.metaPath(filePath), "utf8")) as Meta;
    } catch {
      return {};
    }
  }

  async get(key: string): Promise<R2ObjectBody | null> {
    const filePath = keyToPath(this.root, key);
    if (!filePath) return null;
    let stat: fs.Stats;
    try {
      stat = await fs.promises.stat(filePath);
    } catch {
      return null;
    }
    const base = toR2Object(key, stat, this.readMeta(filePath));
    return {
      ...base,
      get body(): ReadableStream {
        return Readable.toWeb(fs.createReadStream(filePath)) as ReadableStream;
      },
      async arrayBuffer(): Promise<ArrayBuffer> {
        const buf = await fs.promises.readFile(filePath);
        return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
      },
    };
  }

  async put(
    key: string,
    value: ArrayBuffer | ArrayBufferView | ReadableStream | string | null,
    options?: { httpMetadata?: R2HTTPMetadata },
  ): Promise<R2Object | null> {
    const filePath = keyToPath(this.root, key);
    if (!filePath) throw new Error(`[home] key R2 inválida: ${key}`);
    await fs.promises.mkdir(path.dirname(filePath), { recursive: true });

    let buf: Buffer;
    if (value === null) {
      buf = Buffer.alloc(0);
    } else if (typeof value === "string") {
      buf = Buffer.from(value, "utf8");
    } else if (value instanceof ArrayBuffer) {
      buf = Buffer.from(value);
    } else if (ArrayBuffer.isView(value)) {
      buf = Buffer.from(value.buffer, value.byteOffset, value.byteLength);
    } else {
      buf = Buffer.from(await new Response(value).arrayBuffer());
    }

    // Escritura atómica: tmp + rename (un GET concurrente nunca ve un PDF a medias).
    const tmp = `${filePath}.tmp-${process.pid}-${Date.now()}`;
    await fs.promises.writeFile(tmp, buf);
    await fs.promises.rename(tmp, filePath);
    if (options?.httpMetadata) {
      await fs.promises.writeFile(this.metaPath(filePath), JSON.stringify(options.httpMetadata));
    }
    const stat = await fs.promises.stat(filePath);
    return toR2Object(key, stat, options?.httpMetadata ?? {});
  }

  async delete(keys: string | string[]): Promise<void> {
    for (const key of Array.isArray(keys) ? keys : [keys]) {
      const filePath = keyToPath(this.root, key);
      if (!filePath) continue;
      await fs.promises.rm(filePath, { force: true });
      await fs.promises.rm(this.metaPath(filePath), { force: true });
    }
  }

  async list(options?: { prefix?: string; limit?: number; cursor?: string }): Promise<{
    objects: R2Object[];
    truncated: boolean;
    cursor?: string;
  }> {
    const prefix = options?.prefix ?? "";
    const limit = options?.limit ?? 1000;
    const objects: R2Object[] = [];
    const walk = (dir: string): void => {
      let entries: fs.Dirent[];
      try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
      } catch {
        return;
      }
      for (const e of entries) {
        if (objects.length >= limit) return;
        const full = path.join(dir, e.name);
        if (e.isDirectory()) {
          walk(full);
        } else if (e.isFile() && !e.name.endsWith(".meta.json") && !e.name.includes(".tmp-")) {
          const key = path.relative(this.root, full).split(path.sep).join("/");
          if (!key.startsWith(prefix)) continue;
          objects.push(toR2Object(key, fs.statSync(full), this.readMeta(full)));
        }
      }
    };
    walk(this.root);
    return { objects, truncated: false };
  }
}

// ── Registro en globalThis ───────────────────────────────────────────────────

// Singleton por proceso: el dev server puede re-evaluar módulos (HMR), pero la
// conexión SQLite y los bindings se crean una sola vez.
declare global {
  var __homeBindingsReady: boolean | undefined;
}

export function registerHomeBindings(): void {
  const g = globalThis as unknown as Record<string, unknown>;
  if (globalThis.__homeBindingsReady) return;

  const repoRoot = process.cwd();
  const dataDir = path.resolve(repoRoot, process.env.DATA_DIR ?? "data");
  fs.mkdirSync(dataDir, { recursive: true });

  const sqlite = new Database(path.join(dataDir, "bengochea.sqlite3"));
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("busy_timeout = 5000");
  sqlite.pragma("synchronous = NORMAL");
  ensureSchema(sqlite, repoRoot);

  g.METRICS_DB = new SqliteD1(sqlite);
  g.DOCS = new FsBucket(path.join(dataDir, "r2", "docs"));
  g.INSTAGRAM_MEDIA = new FsBucket(path.join(dataDir, "r2", "instagram-media"));
  globalThis.__homeBindingsReady = true;
  console.log(`[home] bindings locales listos (datos en ${dataDir})`);
}
