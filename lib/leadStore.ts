// Leads del embudo de /analisis — I/O a D1 de lead_activity y las lecturas
// agregadas que consume el panel de la mesa (/admin/leads).
//
// QUÉ PROBLEMA RESUELVE: el peaje del análisis ya captura correos
// (newsletter_subscribers, source='analisis'), pero un correo suelto no le sirve
// a nadie. Lo que convierte a un suscriptor en un llamado es el contexto: qué
// acciones miró, cuántas veces volvió, si mandó a generar análisis nuevos (que
// cuestan plata y son la señal de intención más fuerte que tenemos).
//
// POSTURA DE DATO PERSONAL — el gate vive en el SQL, no en el caller:
// `recordLeadActivity` inserta con un WHERE EXISTS contra newsletter_subscribers
// que exige alta ACTIVA y consent_text IGUAL al vigente. Consecuencias, todas
// buscadas:
//   · Quien se anotó bajo un texto anterior (que no declaraba este registro) NO
//     queda registrado. Se registra recién si se vuelve a anotar bajo el texto
//     nuevo.
//   · Quien se da de baja deja de generar actividad en el mismo instante, sin
//     que ninguna ruta tenga que acordarse de chequearlo.
//   · Un token de leadGate forjado (es un peaje comercial con HMAC, no control
//     de acceso — ver lib/leadGate.ts) no puede inyectar actividad de un correo
//     que no está anotado.
// Poner esa regla en un `if` del caller sería la misma lógica con más lugares
// donde olvidarla; acá es una sola sentencia y viaja con la escritura.

import { getMetricsDb, type D1Database } from "@/lib/metrics";
import { NEWSLETTER_CONSENT_TEXT } from "@/lib/newsletterConsent";

/**
 * Naturaleza de la visita. No valen lo mismo comercialmente: 'fresh' es alguien
 * que mandó a generar un análisis que no existía —eligió el ticker, esperó el
 * minuto y nos costó una llamada a GPT-4o—; 'cache' es lectura de algo ya hecho.
 */
export type LeadActivityKind = "fresh" | "cache";

/**
 * Anota que un lead identificado consultó un ticker. Fire-and-forget: devuelve
 * una promesa que el caller puede soltar o pasar a waitUntil, y NUNCA tira — un
 * problema anotando el embudo no puede tumbar un análisis.
 */
export function recordLeadActivity(
  email: string,
  ticker: string,
  kind: LeadActivityKind,
  /**
   * Veredicto vigente cuando lo vio. Se conoce en los caminos que sirven cache;
   * en una generación fresca todavía no existe al momento de anotar, y queda
   * null. El diff de "cambió desde que lo viste" NO depende de esta columna —eso
   * vive en lead_follow, que sí se sella siempre—: acá es contexto para la mesa,
   * que al mirar el historial ve qué decía la casa en cada visita.
   */
  verdict?: string | null,
): Promise<void> {
  const db = getMetricsDb();
  if (!db) return Promise.resolve();
  const normalizado = email.trim().toLowerCase();
  // Placeholders posicionales (?) y el correo atado DOS veces, en vez de un ?1
  // reutilizado: los parámetros numerados de SQLite no sobreviven la capa
  // better-sqlite3 del home server (lib/homeBindings.ts) — tira "Too many
  // parameter values were provided" y la escritura se pierde en silencio,
  // porque esto es fire-and-forget. Con `?` anda igual en D1 y en SQLite.
  return db
    .prepare(
      "INSERT INTO lead_activity (email, ticker, ts, kind, verdict) " +
      "SELECT ?, ?, ?, ?, ? WHERE EXISTS (" +
      "  SELECT 1 FROM newsletter_subscribers" +
      "  WHERE email = ? AND status = 'active' AND consent_text = ?" +
      ")",
    )
    .bind(
      normalizado, ticker.toUpperCase(), Date.now(), kind, verdict ?? null,
      normalizado, NEWSLETTER_CONSENT_TEXT,
    )
    .run()
    .then(() => undefined)
    .catch((err) => {
      console.error("[leads] activity write failed:", err);
    });
}

// ── Lectura para el panel ────────────────────────────────────────────────────

/** Una fila de la lista de leads: el suscriptor más su actividad agregada. */
export type LeadRow = {
  /**
   * Declaró ser cliente de la casa. Cambia a QUIÉN va el llamado y qué se le
   * ofrece: a un cliente nunca una apertura —ya la tiene—, sino su asesor. Es la
   * columna que hace que este panel genere una orden esta semana en vez de una
   * apertura en seis meses.
   */
  esCliente: boolean;
  /** Acciones que sigue (no las que miró de paso). */
  siguiendo: string[];
  email: string;
  /** Alta al newsletter (Date.now() del opt-in). */
  ts: number;
  status: "active" | "unsubscribed";
  /** Página donde dejó el correo: 'analisis', 'informes', … */
  source: string | null;
  /** Consultas totales registradas. */
  analisis: number;
  /** De ésas, cuántas fueron generaciones nuevas. */
  frescos: number;
  /** Última consulta registrada, o null si nunca miró nada. */
  ultimaActividad: number | null;
  /** Tickers distintos, del más reciente al más viejo (tope 8). */
  tickers: string[];
  /** Cuántos pedidos de contacto mandó (cualquier motivo). */
  pedidos: number;
  /** Último pedido de contacto, o null. */
  ultimoPedido: number | null;
  /** Motivo del último pedido — 'cuenta-analisis' es el CTA del informe. */
  ultimoMotivo: string | null;
};

type LeadBaseRow = {
  email: string;
  ts: number;
  status: string;
  source: string | null;
  analisis: number | null;
  frescos: number | null;
  ultima_actividad: number | null;
  pedidos: number | null;
  ultimo_pedido: number | null;
  ultimo_motivo: string | null;
  es_cliente: number;
};

/**
 * Lista de leads ordenada por lo que le importa a la mesa: primero quien pidió
 * contacto, después por actividad más reciente. Un suscriptor sin actividad
 * igual aparece (LEFT JOIN) — es un lead frío, no una fila ausente.
 *
 * Los tickers salen en una segunda consulta y no en un GROUP_CONCAT del JOIN
 * principal: mezclarlos con los COUNT de dos tablas distintas multiplica filas y
 * los conteos salen inflados.
 *
 * El cruce con contact_messages va por LOWER(c.email): ahí las direcciones se
 * normalizan recién desde 2026-07-28, así que las filas viejas pueden tener
 * mayúsculas y sin esto no matchearían. La tabla es de envíos humanos (cientos
 * de filas), el scan no se siente.
 */
export async function listLeads(
  db: D1Database,
  { limit = 200, offset = 0 }: { limit?: number; offset?: number } = {},
): Promise<{ rows: LeadRow[]; total: number }> {
  const cap = Math.min(Math.max(limit, 1), 500);

  const totalRes = await db
    .prepare("SELECT COUNT(*) AS n FROM newsletter_subscribers")
    .first<{ n: number }>();

  const base = await db
    .prepare(
      "SELECT s.email, s.ts, s.status, s.source, " +
      "  (SELECT COUNT(*) FROM lead_activity a WHERE a.email = s.email) AS analisis, " +
      "  (SELECT COUNT(*) FROM lead_activity a WHERE a.email = s.email AND a.kind = 'fresh') AS frescos, " +
      "  (SELECT MAX(a.ts) FROM lead_activity a WHERE a.email = s.email) AS ultima_actividad, " +
      "  (SELECT COUNT(*) FROM contact_messages c WHERE LOWER(c.email) = s.email) AS pedidos, " +
      "  (SELECT MAX(c.ts) FROM contact_messages c WHERE LOWER(c.email) = s.email) AS ultimo_pedido, " +
      "  (SELECT c.motivo FROM contact_messages c WHERE LOWER(c.email) = s.email ORDER BY c.ts DESC LIMIT 1) AS ultimo_motivo, " +
      // LEFT JOIN y no subconsulta: es 1:1 por correo y así entra en el mismo
      // barrido. COALESCE porque un lead sin perfil todavía no declaró nada.
      "  COALESCE(p.es_cliente, 0) AS es_cliente " +
      "FROM newsletter_subscribers s " +
      "LEFT JOIN lead_profile p ON p.email = s.email " +
      // Prioridad de trabajo: pidió contacto > tiene actividad > sólo se anotó.
      // COALESCE para que los NULL de "nunca miró nada" caigan al fondo y no
      // arriba (en SQLite NULL ordena primero en DESC).
      // Prioridad de trabajo, en este orden y por esta razón: un CLIENTE que
      // viene investigando algo es una llamada que puede terminar en una orden
      // esta semana; un prospecto que pidió contacto es una apertura en meses.
      // Lo inmediato va arriba.
      "ORDER BY es_cliente DESC, (CASE WHEN pedidos > 0 THEN 1 ELSE 0 END) DESC, " +
      "  COALESCE(ultima_actividad, 0) DESC, s.ts DESC " +
      "LIMIT ? OFFSET ?",
    )
    .bind(cap, Math.max(offset, 0))
    .all<LeadBaseRow>();

  const rows = base.results ?? [];
  if (rows.length === 0) return { rows: [], total: totalRes?.n ?? 0 };

  // Tickers por lead, del más reciente al más viejo. Se pide sólo para la página
  // que se está mostrando.
  const emails = rows.map((r) => r.email);
  const placeholders = emails.map(() => "?").join(",");
  const act = await db
    .prepare(
      `SELECT email, ticker, MAX(ts) AS ult FROM lead_activity ` +
      `WHERE email IN (${placeholders}) GROUP BY email, ticker ORDER BY ult DESC`,
    )
    .bind(...emails)
    .all<{ email: string; ticker: string; ult: number }>();

  const porEmail = new Map<string, string[]>();
  for (const a of act.results ?? []) {
    const lista = porEmail.get(a.email) ?? [];
    if (lista.length < 8) lista.push(a.ticker);
    porEmail.set(a.email, lista);
  }

  // Lo que SIGUE es distinto de lo que miró de paso: seguir es una intención
  // declarada, y es de lo que la mesa habla en el llamado.
  const fol = await db
    .prepare(`SELECT email, ticker FROM lead_follow WHERE email IN (${placeholders}) ORDER BY created_at DESC`)
    .bind(...emails)
    .all<{ email: string; ticker: string }>();
  const siguiendoPorEmail = new Map<string, string[]>();
  for (const f of fol.results ?? []) {
    const lista = siguiendoPorEmail.get(f.email) ?? [];
    if (lista.length < 8) lista.push(f.ticker);
    siguiendoPorEmail.set(f.email, lista);
  }

  return {
    total: totalRes?.n ?? 0,
    rows: rows.map((r) => ({
      email: r.email,
      ts: r.ts,
      status: r.status === "unsubscribed" ? "unsubscribed" : "active",
      source: r.source,
      analisis: r.analisis ?? 0,
      frescos: r.frescos ?? 0,
      ultimaActividad: r.ultima_actividad,
      tickers: porEmail.get(r.email) ?? [],
      pedidos: r.pedidos ?? 0,
      ultimoPedido: r.ultimo_pedido,
      ultimoMotivo: r.ultimo_motivo,
      esCliente: r.es_cliente === 1,
      siguiendo: siguiendoPorEmail.get(r.email) ?? [],
    })),
  };
}

/** Resumen de arriba de la lista: el estado del embudo de un vistazo. */
export type LeadsResumen = {
  /** Cuántos declararon ser clientes de la casa: la cohorte que paga rápido. */
  clientes: number;
  suscriptores: number;
  desdeAnalisis: number;
  conActividad: number;
  pedidosApertura: number;
};

export async function leadsResumen(db: D1Database): Promise<LeadsResumen> {
  const r = await db
    .prepare(
      "SELECT " +
      "  (SELECT COUNT(*) FROM newsletter_subscribers WHERE status = 'active') AS suscriptores, " +
      "  (SELECT COUNT(*) FROM newsletter_subscribers WHERE status = 'active' AND source = 'analisis') AS desde_analisis, " +
      "  (SELECT COUNT(DISTINCT email) FROM lead_activity) AS con_actividad, " +
      "  (SELECT COUNT(*) FROM contact_messages WHERE motivo = 'cuenta-analisis') AS pedidos_apertura, " +
      "  (SELECT COUNT(*) FROM lead_profile WHERE es_cliente = 1) AS clientes",
    )
    .first<{
      suscriptores: number;
      desde_analisis: number;
      con_actividad: number;
      pedidos_apertura: number;
      clientes: number;
    }>();

  return {
    clientes: r?.clientes ?? 0,
    suscriptores: r?.suscriptores ?? 0,
    desdeAnalisis: r?.desde_analisis ?? 0,
    conActividad: r?.con_actividad ?? 0,
    pedidosApertura: r?.pedidos_apertura ?? 0,
  };
}
