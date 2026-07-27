// Validación de correo — CAPA 1, la parte que necesita red: ¿el dominio puede
// recibir mail? SÓLO SERVER (usa node:dns).
//
// Se puede hacer nativo porque el sitio corre en Node en el home server; en
// Cloudflare no había DNS crudo y había que ir por DNS-over-HTTPS. El import es
// dinámico para que ningún bundler intente arrastrar node:dns a otro runtime: si
// no está disponible, la función deja pasar.
//
// POSTURA — FAIL-OPEN, y no es un descuido:
//
//   · Sólo se rechaza ante una respuesta DEFINITIVA del DNS: el dominio no
//     existe (ENOTFOUND/NXDOMAIN) o existe y no tiene forma de recibir correo.
//   · Un timeout, un SERVFAIL o un resolver caído dejan pasar la dirección. Un
//     problema de red nuestro no puede convertirse en "tu correo está mal" para
//     alguien que lo escribió bien.
//
// Y NO se hace verificación SMTP (conectarse al MX y preguntar por la casilla
// con RCPT TO). Parece el paso lógico siguiente y es una trampa: Gmail y Outlook
// responden accept-all justamente para defenderse de eso, greylistean, y las
// pruebas queman la reputación de la IP del server. Ruido, no señal.

type Veredicto = { ok: true } | { ok: false; motivo: "dominio_inexistente" | "sin_correo" };

// Cache por dominio: el 95% de las altas son gmail/hotmail/outlook, así que un
// lookup sirve para siempre. TTL corto igual, por si un dominio se da de alta.
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 h
const cache = new Map<string, { veredicto: Veredicto; ts: number }>();

const TIMEOUT_MS = 2000;

/**
 * ¿Este dominio puede recibir correo? Ver la nota de fail-open: ante la duda,
 * devuelve ok.
 */
export async function domainAcceptsMail(domain: string): Promise<Veredicto> {
  const d = domain.trim().toLowerCase();
  if (!d || !d.includes(".")) return { ok: false, motivo: "dominio_inexistente" };

  const hit = cache.get(d);
  if (hit && Date.now() - hit.ts < CACHE_TTL_MS) return hit.veredicto;

  const veredicto = await resolver(d);
  cache.set(d, { veredicto, ts: Date.now() });
  return veredicto;
}

async function resolver(d: string): Promise<Veredicto> {
  let dns: typeof import("node:dns/promises");
  try {
    dns = await import("node:dns/promises");
  } catch {
    return { ok: true }; // sin node:dns (otro runtime) → no se valida
  }

  const r = new dns.Resolver({ timeout: TIMEOUT_MS, tries: 1 });

  try {
    const mx = await r.resolveMx(d);
    // Algunos dominios devuelven un MX "nulo" (RFC 7505): un solo registro con
    // exchange vacío o ".", que significa EXPLÍCITAMENTE "acá no entra correo".
    const utiles = mx.filter((m) => m.exchange && m.exchange !== ".");
    if (utiles.length > 0) return { ok: true };
    return { ok: false, motivo: "sin_correo" };
  } catch (err) {
    const code = (err as { code?: string })?.code;

    // El dominio no existe: definitivo.
    if (code === "ENOTFOUND" || code === "NXDOMAIN") {
      return { ok: false, motivo: "dominio_inexistente" };
    }

    // Existe pero no tiene MX. NO alcanza para rechazar: por RFC 5321, sin MX el
    // correo se entrega al registro A. Es raro pero legal, así que se comprueba
    // antes de decirle a alguien que su dirección está mal.
    if (code === "ENODATA") {
      try {
        const a = await r.resolve4(d);
        if (a.length > 0) return { ok: true };
      } catch { /* sigue */ }
      try {
        const aaaa = await r.resolve6(d);
        if (aaaa.length > 0) return { ok: true };
      } catch { /* sigue */ }
      return { ok: false, motivo: "sin_correo" };
    }

    // Timeout, SERVFAIL, resolver caído: fail-open.
    return { ok: true };
  }
}
