// Perfil comercial del lead — lo que separa a un cliente de la casa de un
// prospecto, y de eso depende TODO el ruteo del embudo.
//
// POR QUÉ IMPORTA MÁS DE LO QUE PARECE: los clientes actuales de la casa pasan
// por este sitio cada vez que quieren ver su cartera (el acceso a Consultanet
// está en el nav). La herramienta está a un clic de todos ellos y nadie la usa
// como canal. Y la economía es distinta: a un cliente que investiga una acción no
// se le ofrece abrir una cuenta que ya tiene — se le avisa a su asesor, y eso
// termina en una ORDEN esta semana, no en una apertura en seis meses.
//
// AUTODECLARADO, Y ALCANZA. Lo único que decide es a quién le llega el aviso. Un
// impostor que se declare cliente no gana nada: no accede a datos de nadie, sólo
// hace que la mesa lo llame como si ya lo fuera — y ahí se aclara en diez
// segundos. Pedir verificación acá sería fricción sin beneficio.
//
// SEPARADO de newsletter_subscribers a propósito: esa tabla es la prueba del
// consentimiento (Ley 18.331) y no recibe campos comerciales. Acá van los datos
// que el embudo junta de a uno — perfilado progresivo: primero el correo, después
// si es cliente, después el teléfono, después el nombre. Nunca todo junto.

import type { D1Database } from "@/lib/metrics";

export type LeadProfile = {
  email: string;
  esCliente: boolean;
  nombre: string | null;
  telefono: string | null;
  updatedAt: number;
};

/**
 * Estado del lector. Es lo que hace que un solo informe se lea de cuatro formas
 * distintas, y el orden importa porque decide qué se le ofrece:
 *
 *   · anonimo    — no dejó nada. NUNCA se le habla de abrir una cuenta: se le
 *                  muestra la herramienta y punto. Pedirle lo más grande en la
 *                  visita de menor compromiso es el error que hundía la versión
 *                  anterior de este embudo.
 *   · conocido   — dejó el correo, una o dos consultas. Se le ofrecen funciones
 *                  (seguir, preguntar), no una relación comercial.
 *   · recurrente — tres consultas o dos acciones seguidas. Ya demostró que le
 *                  importa: acá la conversación de cuenta no interrumpe, contesta.
 *   · cliente    — ya es de la casa. Jamás una apertura (ya la tiene): va a su
 *                  asesor, y eso puede terminar en una orden esta semana.
 */
export type EstadoLector = "anonimo" | "conocido" | "recurrente" | "cliente";

export type LectorInfo = {
  email: string | null;
  estado: EstadoLector;
  esCliente: boolean;
  /** Consultas registradas (sólo las que el consentimiento habilita a guardar). */
  analisis: number;
  /** Acciones que sigue. */
  siguiendo: number;
  nombre: string | null;
};

/** Umbrales del salto a "recurrente". Bajos a propósito: tres informes ya son un hábito. */
const UMBRAL_ANALISIS = 3;
const UMBRAL_SEGUIDAS = 2;

export async function estadoLector(db: D1Database | null, email: string | null): Promise<LectorInfo> {
  if (!db || !email) {
    return { email: null, estado: "anonimo", esCliente: false, analisis: 0, siguiendo: 0, nombre: null };
  }
  const e = email.trim().toLowerCase();

  const r = await db
    .prepare(
      "SELECT " +
      "  (SELECT COUNT(*) FROM lead_activity WHERE email = ?) AS analisis, " +
      "  (SELECT COUNT(*) FROM lead_follow WHERE email = ?) AS siguiendo, " +
      "  (SELECT es_cliente FROM lead_profile WHERE email = ?) AS es_cliente, " +
      "  (SELECT nombre FROM lead_profile WHERE email = ?) AS nombre",
    )
    .bind(e, e, e, e)
    .first<{ analisis: number; siguiendo: number; es_cliente: number | null; nombre: string | null }>();

  const analisis = r?.analisis ?? 0;
  const siguiendo = r?.siguiendo ?? 0;
  const cliente = r?.es_cliente === 1;

  // Cliente gana sobre todo lo demás: no importa cuánto navegó, lo que cambia es
  // a quién le llega y qué se le ofrece.
  const estado: EstadoLector = cliente
    ? "cliente"
    : analisis >= UMBRAL_ANALISIS || siguiendo >= UMBRAL_SEGUIDAS
      ? "recurrente"
      : "conocido";

  return { email: e, estado, esCliente: cliente, analisis, siguiendo, nombre: r?.nombre ?? null };
}

export async function leerPerfil(db: D1Database, email: string): Promise<LeadProfile | null> {
  const r = await db
    .prepare("SELECT email, es_cliente, nombre, telefono, updated_at FROM lead_profile WHERE email = ?")
    .bind(email.trim().toLowerCase())
    .first<{ email: string; es_cliente: number; nombre: string | null; telefono: string | null; updated_at: number }>();
  if (!r) return null;
  return {
    email: r.email,
    esCliente: r.es_cliente === 1,
    nombre: r.nombre,
    telefono: r.telefono,
    updatedAt: r.updated_at,
  };
}

export async function esCliente(db: D1Database, email: string): Promise<boolean> {
  const p = await leerPerfil(db, email);
  return p?.esCliente ?? false;
}

/**
 * Marca (o desmarca) que la persona es cliente de la casa. UPSERT: la primera vez
 * crea la fila, después sólo toca esa columna — así el teléfono y el nombre que se
 * hayan juntado antes no se pierden.
 *
 * No guarda IP ni rastro: el registro de quién declaró qué y cuándo ya queda en
 * newsletter_subscribers (el alta) y en contact_messages (los pedidos).
 */
export async function marcarCliente(db: D1Database, email: string, valor: boolean): Promise<void> {
  await db
    .prepare(
      "INSERT INTO lead_profile (email, es_cliente, updated_at) VALUES (?,?,?) " +
      "ON CONFLICT(email) DO UPDATE SET es_cliente = excluded.es_cliente, updated_at = excluded.updated_at",
    )
    .bind(email.trim().toLowerCase(), valor ? 1 : 0, Date.now())
    .run();
}

/**
 * Guarda un dato de contacto suelto. Sólo escribe los campos que vienen, para que
 * el perfilado progresivo pueda sumar de a uno sin borrar lo anterior — un
 * `nombre` nuevo no puede pisar con NULL el teléfono que ya teníamos.
 */
export async function guardarContacto(
  db: D1Database,
  email: string,
  datos: { nombre?: string | null; telefono?: string | null },
): Promise<void> {
  const e = email.trim().toLowerCase();
  const ahora = Date.now();
  await db
    .prepare(
      "INSERT INTO lead_profile (email, es_cliente, nombre, telefono, updated_at) VALUES (?,0,?,?,?) " +
      "ON CONFLICT(email) DO UPDATE SET " +
      "  nombre   = COALESCE(excluded.nombre, lead_profile.nombre), " +
      "  telefono = COALESCE(excluded.telefono, lead_profile.telefono), " +
      "  updated_at = excluded.updated_at",
    )
    .bind(e, datos.nombre ?? null, datos.telefono ?? null, ahora)
    .run();
}
