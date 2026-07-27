// El "porqué" del ticker más analizado de la semana.
//
// La tarjeta destacada de /analisis (Tendencias) respondía "¿por qué es la más
// analizada?" con la propia demanda ("lidera las consultas"), que es circular.
// Acá se arma la respuesta REAL: el hecho de mercado que explica la atención
// —resultados, guidance, una operación, un fallo regulatorio— redactado en una
// oración por el modelo A PARTIR DE prensa verificable.
//
// Reglas de la casa que gobiernan este archivo:
//
//  1. NADA SE INVENTA. El motivo tiene que apoyarse en UNA noticia concreta de
//     la whitelist Tier 1/2 (Reuters, Bloomberg, WSJ, CNBC…) que ya alimenta el
//     reporte de equity. El modelo devuelve el índice de la noticia que usó; si
//     ninguna explica la atención, devuelve explica=false y acá se responde
//     null. La tarjeta entonces cae al dato honesto (la demanda de la
//     plataforma), nunca a una causa inferida del precio.
//  2. DESCRIPTIVO, NUNCA RECOMENDACIÓN. Marco legal de recomendaciones
//     públicas: la frase cuenta qué pasó, no qué hacer. El prompt lo prohíbe y
//     además hay un filtro léxico determinístico abajo (defensa en profundidad).
//  3. CARO SÓLO UNA VEZ POR DÍA. Read-through cache en D1 por (símbolo, día
//     URUGUAYO): a lo sumo una generación diaria por ticker (~US$0,0024). Los
//     negativos se cachean corto, por si la prensa aparece más tarde.

import { getMetricsDb, type D1Database } from "@/lib/metrics";
import { fetchGoogleNewsWhitelist, type GNewsItem } from "@/lib/fetchGoogleNewsWhitelist";
import { fetchChartRange } from "@/lib/fetchChartRange";
import { getOpenAIClient } from "@/lib/openai";
import { reportError } from "@/lib/errorReporter";
import { todayUY } from "@/lib/marketHours";

// Mismo modelo pineado que el reporte: una sola llamada por ticker por día hace
// que el costo sea irrelevante, y no queremos otra voz redactando la home.
const MODEL = "gpt-4o-2024-11-20";
const NEWS_MAX = 6;
const GEN_TIMEOUT_MS = 20_000;

// Versión del prompt — parte de la clave del cache. Al tocar SYSTEM/SCHEMA se
// sube y las frases viejas quedan invalidadas al instante, en vez de convivir un
// día con las nuevas. Append-only, igual que CACHE_VERSION en lib/cache.ts.
// v1 (2026-07-26): primera versión.
// v2 (2026-07-26): prohibida la fecha en la oración — el modelo la deducía de la
// publicación de la nota, que no es la del hecho (IBM: nota del 22-jul sobre un
// desplome del 14-jul).
// v3 (2026-07-26): cifras al uso uruguayo ("US$ 5.000 millones", no "5 mil
// millones") y firma sin dominio (Bloomberg, no Bloomberg.com).
const PROMPT_VERSION = "v3";

// Un motivo vive el día; un "no hay explicación" se reintenta a las 3 h (la
// prensa puede publicar después). Sin esto, un ticker que amanece sin cobertura
// se queda mudo hasta la medianoche aunque a las 10:00 salga el comunicado.
const NEGATIVE_TTL_MS = 3 * 60 * 60 * 1000;

export const TREND_CATEGORIES = [
  "Resultados",
  "Guidance",
  "Operación",
  "Regulación",
  "Producto",
  "Gestión",
  "Mercado",
] as const;
export type TrendCategory = (typeof TREND_CATEGORIES)[number];

export interface TrendReason {
  /** Una oración en español: el hecho que explica la atención. */
  reason: string;
  /** Etiqueta corta para el chip de la tarjeta. */
  category: TrendCategory;
  /** La nota que respalda la frase — es lo que la hace verificable. */
  source: {
    title: string;
    publisher: string;
    url: string;
    /** YYYY-MM-DD */
    date: string;
  };
}

// ── Cache en D1 ──────────────────────────────────────────────────────────────

const CREATE_TABLE = `CREATE TABLE IF NOT EXISTS ticker_reason (
  symbol        TEXT NOT NULL,
  day           TEXT NOT NULL,
  prompt_v      TEXT NOT NULL,
  reason        TEXT,
  category      TEXT,
  src_title     TEXT,
  src_publisher TEXT,
  src_url       TEXT,
  src_date      TEXT,
  created_at    INTEGER NOT NULL,
  PRIMARY KEY (symbol, day, prompt_v)
) WITHOUT ROWID`;

type Row = {
  reason: string | null;
  category: string | null;
  src_title: string | null;
  src_publisher: string | null;
  src_url: string | null;
  src_date: string | null;
  created_at: number;
};

let ensured: Promise<void> | null = null;
function ensureTable(db: D1Database): Promise<void> {
  if (!ensured) {
    ensured = db
      .prepare(CREATE_TABLE)
      .run()
      .then(() => undefined)
      .catch((err) => {
        ensured = null;
        throw err;
      });
  }
  return ensured;
}

// El día del cache es el día URUGUAYO, igual que el del informe en lib/cache.ts:
// con UTC la clave rotaba a las 21:00 y el motivo se regeneraba en plena tarde,
// dos convenciones distintas conviviendo en el mismo producto.
const today = todayUY;

function rowToReason(row: Row): TrendReason | null {
  if (!row.reason || !row.category || !row.src_title || !row.src_publisher || !row.src_url) {
    return null;
  }
  return {
    reason: row.reason,
    category: row.category as TrendCategory,
    source: {
      title: row.src_title,
      publisher: row.src_publisher,
      url: row.src_url,
      date: row.src_date ?? "",
    },
  };
}

// ── Contexto de precio ───────────────────────────────────────────────────────
// El modelo necesita saber CUÁNTO se movió y CUÁNDO para elegir bien la noticia:
// entre seis titulares de la semana, el que importa suele ser el del día del
// salto. Se lo damos derivado de la serie, no de una opinión.

interface PriceContext {
  changeMonthPct: number | null;
  biggestMove: { date: string; pct: number } | null;
  lastDate: string | null;
}

async function priceContext(symbol: string): Promise<PriceContext> {
  const empty: PriceContext = { changeMonthPct: null, biggestMove: null, lastDate: null };
  try {
    const payload = await fetchChartRange(symbol, "1M");
    const pts = payload.prices.filter((p) => Number.isFinite(p.value));
    if (pts.length < 2) return empty;

    const first = pts[0].value;
    const last = pts[pts.length - 1].value;
    const changeMonthPct = first ? ((last - first) / first) * 100 : null;

    let biggest: { date: string; pct: number } | null = null;
    for (let i = 1; i < pts.length; i++) {
      const prev = pts[i - 1].value;
      if (!prev) continue;
      const pct = ((pts[i].value - prev) / prev) * 100;
      if (!biggest || Math.abs(pct) > Math.abs(biggest.pct)) {
        biggest = { date: String(pts[i].time), pct };
      }
    }

    return {
      changeMonthPct,
      biggestMove: biggest,
      lastDate: String(pts[pts.length - 1].time),
    };
  } catch {
    return empty;
  }
}

// ── Generación ───────────────────────────────────────────────────────────────

const SYSTEM = `Sos analista de una casa de bolsa uruguaya (Gastón Bengochea & Cía.).
Escribís para inversores en español rioplatense institucional, sobrio y claro.

Te dan un ticker que lidera las consultas de nuestra plataforma esta semana,
titulares de prensa financiera de primer nivel y el movimiento de su precio.
Tu única tarea: explicar EN UNA ORACIÓN el hecho concreto que explica esa
atención.

Reglas innegociables:
- La oración TIENE que apoyarse en uno de los titulares listados. Devolvés su
  índice en "fuente". Si ninguno explica la atención (todos son notas de color,
  listados genéricos o rankings), devolvés explica=false.
- Sólo hechos: qué pasó y con qué magnitud, si la magnitud está en los datos.
  Podés citar el movimiento del precio como consecuencia del hecho, nunca como
  causa.
- SIN FECHAS en la oración ("el 22 de julio", "esta semana", "el martes"). La
  fecha que ves es la de PUBLICACIÓN de la nota, que no tiene por qué ser la del
  hecho, y se muestra aparte junto a la fuente.
- Cifras al uso uruguayo: "US$ 5.000 millones" (punto de miles, nunca "5 mil
  millones" ni "$5B"), "42%", "US$ 1,2 billones" sólo si es realmente billón.
- PROHIBIDO recomendar, sugerir, valorar o proyectar: nada de "oportunidad",
  "barata", "conviene", "atractiva", "podría subir", precios objetivo ni
  adjetivos de opinión. No es una recomendación de inversión.
- Nada de cifras que no estén en los datos que te paso.
- Máximo 180 caracteres, una sola oración, sin comillas, sin el nombre de la
  fuente adentro (la fuente se muestra aparte). Empezá por el hecho, no por
  "La acción...".`;

const SCHEMA = {
  name: "trend_reason",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      explica: {
        type: "boolean",
        description: "true si algún titular explica realmente la atención sobre el ticker",
      },
      motivo: {
        type: "string",
        description: "Una oración factual en español rioplatense, máx 180 caracteres",
      },
      categoria: { type: "string", enum: [...TREND_CATEGORIES] },
      fuente: {
        type: "integer",
        description: "Índice (base 0) del titular en el que se apoya el motivo",
      },
    },
    required: ["explica", "motivo", "categoria", "fuente"],
  },
} as const;

// Filtro léxico: el prompt ya prohíbe el registro de recomendación, pero esta
// frase va en una home institucional y una sola metida rompe el marco legal.
// Si aparece cualquiera de estos, se descarta la generación entera.
//
// Apunta a lo que le habla al LECTOR —consejo, juicio de valor, pronóstico—, no
// a los verbos del hecho. Un filtro por verbo suelto ("compra", "invertir en")
// mataba justamente las mejores notas: "IBM compra HRL Laboratories" y "AMD
// invertir en Anthropic" son operaciones, no recomendaciones.
const BANNED = [
  "recomend",
  "convien[ea]",
  "oportunidad de (compra|inversi[oó]n)",
  "atractiv",
  "barat[oa]",
  "sobrevalorad|infravalorad|subvalorad",
  "precio objetivo|price target",
  "deber[íi]as|compr[aá]lo|vend[eé]lo|(compr[aá]|vend[eé]) (la|las) acci[oó]n",
  "podr[íi]a (subir|caer|dispararse|desplomarse|duplicar)",
  "apuesta segura|imperdible|no te lo pierdas",
];
const BANNED_RE = new RegExp(BANNED.join("|"), "i");

function sanitize(motivo: string): string | null {
  const clean = motivo.replace(/\s+/g, " ").replace(/^["“']|["”']$/g, "").trim();
  if (clean.length < 20 || clean.length > 220) return null;
  if (BANNED_RE.test(clean)) return null;
  return clean;
}

// Google News firma algunas fuentes con el dominio ("Bloomberg.com",
// "Investing.com"). Al pie de la tarjeta va la marca, no la URL.
function prettyPublisher(p: string): string {
  return p.replace(/\.(com|net|org|co\.uk|co)$/i, "").trim() || p;
}

function newsBlock(items: GNewsItem[]): string {
  return items
    .map((n, i) => {
      const desc = n.description ? `\n   ${n.description.slice(0, 320)}` : "";
      return `[${i}] ${n.publishedAt} · ${n.publisher}\n   ${n.title}${desc}`;
    })
    .join("\n");
}

function priceBlock(pc: PriceContext): string {
  const lines: string[] = [];
  if (pc.changeMonthPct != null) {
    lines.push(`Variación del último mes: ${pc.changeMonthPct >= 0 ? "+" : ""}${pc.changeMonthPct.toFixed(1)}%`);
  }
  if (pc.biggestMove) {
    lines.push(
      `Mayor salto diario del mes: ${pc.biggestMove.pct >= 0 ? "+" : ""}${pc.biggestMove.pct.toFixed(1)}% el ${pc.biggestMove.date}`,
    );
  }
  return lines.length ? lines.join("\n") : "Sin serie de precio disponible.";
}

// Tri-estado deliberado:
//   TrendReason → hay motivo respaldado
//   null        → se evaluó la prensa y NINGUNA nota explica la atención
//   undefined   → no se pudo evaluar (no llegó prensa). Distinto de null: el RSS
//                 de Google devuelve vacío ante un 429 o un hipo de red, y
//                 cachear eso como "no hay motivo" deja la tarjeta muda tres
//                 horas por una falla de un segundo. Este caso NO se persiste.
async function generate(
  symbol: string,
  resolveName: () => Promise<string>,
): Promise<TrendReason | null | undefined> {
  const companyName = await resolveName();
  const [news, pc] = await Promise.all([
    fetchGoogleNewsWhitelist(symbol, companyName, NEWS_MAX),
    priceContext(symbol),
  ]);

  if (news.length === 0) return undefined;

  const user = `Ticker: ${symbol} — ${companyName}
Fecha de hoy: ${today()}

Precio:
${priceBlock(pc)}

Titulares (prensa Tier 1/2, últimos días):
${newsBlock(news)}`;

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), GEN_TIMEOUT_MS);
  let raw: string | null | undefined;
  try {
    const completion = await getOpenAIClient().chat.completions.create(
      {
        model: MODEL,
        temperature: 0.2,
        max_tokens: 200,
        response_format: { type: "json_schema", json_schema: SCHEMA },
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: user },
        ],
      },
      { signal: ac.signal },
    );
    raw = completion.choices[0]?.message?.content;
    // Única línea de log de todo el módulo, y sólo en el camino que cuesta plata:
    // deja el consumo real a la vista en los logs del server (a lo sumo un puñado
    // de líneas por día). Si aparece seguido, algo del cache se rompió.
    const u = completion.usage;
    if (u) {
      console.log(
        `[trendReason] ${symbol} generado · ${u.prompt_tokens} in + ${u.completion_tokens} out tokens`,
      );
    }
  } finally {
    clearTimeout(timer);
  }

  if (!raw) return null;

  let parsed: { explica?: boolean; motivo?: string; categoria?: string; fuente?: number };
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (!parsed.explica) return null;

  const item = typeof parsed.fuente === "number" ? news[parsed.fuente] : undefined;
  if (!item) return null; // sin nota que la respalde, la frase no se publica

  const motivo = typeof parsed.motivo === "string" ? sanitize(parsed.motivo) : null;
  if (!motivo) return null;

  const category = (TREND_CATEGORIES as readonly string[]).includes(parsed.categoria ?? "")
    ? (parsed.categoria as TrendCategory)
    : "Mercado";

  return {
    reason: motivo,
    category,
    source: {
      title: item.title,
      publisher: prettyPublisher(item.publisher),
      url: item.link,
      date: item.publishedAt,
    },
  };
}

// ── Entrada pública ──────────────────────────────────────────────────────────

// Generaciones en vuelo: dos visitas simultáneas a la landing no tienen que
// pagar dos veces la misma frase.
const inflight = new Map<string, Promise<TrendReason | null>>();

// Segunda capa de cache, en memoria del proceso y DELANTE de D1.
//
// No es un lujo: sin binding de METRICS_DB (dev sin inicializar, deploy con el
// binding mal seteado) el read-through de D1 no existe y CADA visita a /analisis
// pagaría una generación. Esta capa acota el peor caso a una por proceso y por
// (símbolo, día), aun sin base. De paso ahorra la ida a D1 en cada visita, que
// es lo que ocurre el 99,9% de las veces.
//
// `evaluado: false` = no se pudo evaluar (no llegó prensa). Se recuerda corto,
// sólo para no repetir la vuelta a Google/Yahoo en cada visita mientras el RSS
// está caído; no llega a haber llamada al modelo en ese camino.
type Memo = { value: TrendReason | null; at: number; evaluado: boolean };
const memo = new Map<string, Memo>();
const MEMO_MISS_TTL_MS = 15 * 60 * 1000;
const MEMO_MAX = 64;

function memoKey(sym: string, day: string): string {
  return `${sym}|${day}|${PROMPT_VERSION}`;
}

function memoSet(key: string, m: Memo): void {
  // Purga barata: las claves viejas son de días pasados y ya no se consultan.
  if (memo.size >= MEMO_MAX) {
    const hoy = today();
    for (const k of memo.keys()) if (!k.includes(`|${hoy}|`)) memo.delete(k);
  }
  memo.set(key, m);
}

/**
 * Motivo por el que `symbol` concentra la atención, o null si no hay una
 * explicación respaldada por prensa. Read-through: D1 primero, modelo después.
 * Nunca lanza — el llamador degrada a la línea de demanda.
 *
 * `resolveName` es perezoso a propósito: la razón social sólo hace falta para
 * armar la query de prensa, o sea únicamente cuando hay que generar. El nombre
 * NO se toma del cliente — entra crudo al prompt, y un `?name=` manipulado sería
 * inyección directa.
 */
export async function getTrendReason(
  symbol: string,
  resolveName: () => Promise<string>,
): Promise<TrendReason | null> {
  const sym = symbol.toUpperCase();
  const db = getMetricsDb();
  const day = today();
  const key = memoKey(sym, day);

  // 1. Memoria del proceso — el caso normal, sin tocar nada.
  const hit = memo.get(key);
  if (hit) {
    if (hit.evaluado) {
      // El negativo caduca antes que el día: la prensa puede llegar tarde.
      if (hit.value || Date.now() - hit.at < NEGATIVE_TTL_MS) return hit.value;
    } else if (Date.now() - hit.at < MEMO_MISS_TTL_MS) {
      return null;
    }
  }

  // 2. D1 — sobrevive reinicios y deploys, y comparte el resultado entre procesos.
  if (db) {
    try {
      await ensureTable(db);
      const row = await db
        .prepare(
          `SELECT reason, category, src_title, src_publisher, src_url, src_date, created_at
             FROM ticker_reason WHERE symbol = ? AND day = ? AND prompt_v = ?`,
        )
        .bind(sym, day, PROMPT_VERSION)
        .first<Row>();
      if (row) {
        const cached = rowToReason(row);
        const at = Number(row.created_at);
        if (cached || Date.now() - at < NEGATIVE_TTL_MS) {
          memoSet(key, { value: cached, at, evaluado: true });
          return cached;
        }
      }
    } catch (err) {
      reportError("trendReason/cache-read", err, { symbol: sym });
    }
  }

  // 3. Recién acá se paga: prensa + modelo.
  const pending = inflight.get(key);
  if (pending) return pending;

  const task = (async () => {
    let result: TrendReason | null | undefined;
    try {
      result = await generate(sym, resolveName);
    } catch (err) {
      reportError("trendReason/generate", err, { symbol: sym });
      return null; // fallo de upstream: no lo persistimos como "no hay motivo"
    }

    // Sin prensa que evaluar no hay veredicto que persistir — pero sí se recuerda
    // corto en memoria, para no repetir la vuelta a Google/Yahoo en cada visita
    // mientras el RSS esté caído. (Ese camino corta antes de llamar al modelo.)
    if (result === undefined) {
      memoSet(key, { value: null, at: Date.now(), evaluado: false });
      return null;
    }

    memoSet(key, { value: result, at: Date.now(), evaluado: true });

    if (db) {
      try {
        await db
          .prepare(
            `INSERT INTO ticker_reason
               (symbol, day, prompt_v, reason, category, src_title, src_publisher, src_url, src_date, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(symbol, day, prompt_v) DO UPDATE SET
               reason = excluded.reason, category = excluded.category,
               src_title = excluded.src_title, src_publisher = excluded.src_publisher,
               src_url = excluded.src_url, src_date = excluded.src_date,
               created_at = excluded.created_at`,
          )
          .bind(
            sym,
            day,
            PROMPT_VERSION,
            result?.reason ?? null,
            result?.category ?? null,
            result?.source.title ?? null,
            result?.source.publisher ?? null,
            result?.source.url ?? null,
            result?.source.date ?? null,
            Date.now(),
          )
          .run();
      } catch (err) {
        reportError("trendReason/cache-write", err, { symbol: sym });
      }
    }

    return result;
  })().finally(() => {
    inflight.delete(key);
  });

  inflight.set(key, task);
  return task;
}
