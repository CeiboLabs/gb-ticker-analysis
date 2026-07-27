// Validación de direcciones de correo — CAPA 1: lo que se puede decidir sin red.
//
// Módulo PURO a propósito: cero imports, cero I/O. Lo consumen el formulario
// (client component) y la ruta /api/newsletter, así que no puede arrastrar
// `node:` ni zod al bundle del navegador. El chequeo de MX, que sí necesita red,
// vive aparte en lib/emailMx.ts (sólo server).
//
// Qué resuelve cada pieza, y qué NO:
//
//   · suggestEmailTypo — la de mayor retorno y la que nadie pone. Buena parte de
//     las direcciones inválidas no son mala fe: son dedos. "gmial.com" se
//     corrige y se recupera un lead que hoy se pierde en silencio. SUGIERE, no
//     rechaza: si la persona insiste, su dirección pasa.
//
//   · isDisposableDomain — mata al que evade a propósito. Es un guardarraíl, no
//     un muro: la lista es finita y salen dominios nuevos todo el tiempo. La
//     defensa real contra el correo inventado es la confirmación por click
//     (capa 2), que todavía no existe porque no hay envío de mails.
//
// Lo que ninguna de las dos ataja: pepe1234@gmail.com, dominio real y casilla
// inexistente. Eso sólo lo resuelve la capa 2.

/** Dominios de correo temporal más usados. Guardarraíl, no lista exhaustiva. */
const DISPOSABLE_DOMAINS = new Set([
  "10minutemail.com", "10minutemail.net", "20minutemail.com", "33mail.com",
  "anonbox.net", "burnermail.io", "dispostable.com", "dropmail.me",
  "emailondeck.com", "fakeinbox.com", "fakemail.net", "getairmail.com",
  "getnada.com", "grr.la", "guerrillamail.biz", "guerrillamail.com",
  "guerrillamail.de", "guerrillamail.info", "guerrillamail.net",
  "guerrillamail.org", "guerrillamailblock.com", "harakirimail.com",
  "inboxbear.com", "inboxkitten.com", "jetable.org", "mail-temporaire.fr",
  "mail7.io", "mailcatch.com", "maildrop.cc", "mailforspam.com",
  "mailinator.com", "mailinator.net", "mailnesia.com", "mailsac.com",
  "mailtemp.info", "mintemail.com", "moakt.com", "mohmal.com",
  "mytemp.email", "nowmymail.com", "sharklasers.com", "spam4.me",
  "spamgourmet.com", "temp-mail.io", "temp-mail.org", "tempail.com",
  "tempinbox.com", "tempmail.com", "tempmail.net", "tempmail.plus",
  "tempmailo.com", "tempr.email", "throwawaymail.com", "trashmail.com",
  "trashmail.de", "trashmail.me", "trashmail.net", "yopmail.com",
  "yopmail.fr", "yopmail.net",
]);

/**
 * Dominios frecuentes contra los que se mide el typo. Ojo: esta lista también
 * funciona como ALLOWLIST — un dominio que está acá nunca se marca como error
 * de tipeo. Por eso incluye vecinos legítimos y cercanos entre sí (mail.com,
 * ymail.com, me.com): sin ellos, el corrector le sugeriría "gmail.com" a alguien
 * que escribió bien su dirección de mail.com.
 */
const COMMON_DOMAINS = [
  // Globales
  "gmail.com", "googlemail.com", "hotmail.com", "hotmail.es", "hotmail.com.ar",
  "outlook.com", "outlook.es", "live.com", "live.com.ar", "msn.com",
  "yahoo.com", "yahoo.com.ar", "yahoo.es", "ymail.com", "mail.com",
  "icloud.com", "me.com", "mac.com", "aol.com",
  "proton.me", "protonmail.com", "zoho.com", "gmx.com",
  // Uruguay
  "adinet.com.uy", "vera.com.uy", "montevideo.com.uy", "netgate.com.uy",
  "antel.com.uy", "dedicado.net.uy",
];

const COMMON_SET = new Set(COMMON_DOMAINS);

/** Parte local y dominio, en minúsculas. null si no tiene forma de dirección. */
export function splitEmail(email: string): { local: string; domain: string } | null {
  const at = email.lastIndexOf("@");
  if (at <= 0 || at === email.length - 1) return null;
  return {
    local: email.slice(0, at),
    domain: email.slice(at + 1).trim().toLowerCase(),
  };
}

export function isDisposableDomain(domain: string): boolean {
  return DISPOSABLE_DOMAINS.has(domain.trim().toLowerCase());
}

/** Distancia de Levenshtein con una sola fila de estado. */
function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const fila = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 0; i < a.length; i++) {
    let anterior = fila[0];
    fila[0] = i + 1;
    for (let j = 0; j < b.length; j++) {
      const temp = fila[j + 1];
      fila[j + 1] = a[i] === b[j] ? anterior : Math.min(anterior, fila[j], fila[j + 1]) + 1;
      anterior = temp;
    }
  }
  return fila[b.length];
}

/**
 * ¿Parece un dominio mal tipeado? Devuelve la dirección corregida, o null.
 *
 * El umbral es deliberadamente conservador: un falso positivo le dice a alguien
 * que su propia dirección está mal, lo cual es peor que dejar pasar un typo.
 * Por eso distancia 1 siempre, y distancia 2 sólo en dominios largos (≥ 9), donde
 * dos letras de diferencia ya no son plausiblemente otro dominio real.
 */
export function suggestEmailTypo(email: string): string | null {
  const partes = splitEmail(email);
  if (!partes) return null;
  const { local, domain } = partes;
  if (!domain || COMMON_SET.has(domain)) return null;
  if (isDisposableDomain(domain)) return null; // ése se rechaza, no se corrige

  let mejor: string | null = null;
  let mejorDist = Infinity;
  for (const candidato of COMMON_DOMAINS) {
    const d = levenshtein(domain, candidato);
    if (d < mejorDist) { mejorDist = d; mejor = candidato; }
  }
  if (!mejor) return null;

  const umbral = mejor.length >= 9 ? 2 : 1;
  if (mejorDist === 0 || mejorDist > umbral) return null;

  return `${local}@${mejor}`;
}
