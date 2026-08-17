// Contrato del consentimiento de cookies — lo comparten DOS lugares que no se
// pueden importar entre sí:
//
//   · el script INLINE que se hornea en el HTML (`lib/medicion.ts`), que corre
//     antes que GTM y no puede importar nada: recibe estos valores interpolados
//     como texto;
//   · el banner de React (`components/institucional/ConsentimientoFondo.tsx`),
//     que los importa de verdad.
//
// Viven acá y sin ninguna importación propia para que el componente de CLIENTE no
// arrastre configuración de build al bundle del browser. Si los dos lados se
// desincronizan, el síntoma es de los peores: el banner dice "aceptaste" y GTM
// sigue en denegado, o al revés — la página afirma una cosa y mide otra.

/** Clave de localStorage. Cambiarla equivale a volver a preguntarle a todo el mundo. */
export const CLAVE_CONSENTIMIENTO = "bng_consent";

/**
 * Versión del contrato. Se sube cuando cambia QUÉ se pregunta —no cuando cambia
 * la redacción—: una decisión tomada sobre otra pregunta no es consentimiento
 * para ésta, así que un `v` viejo se descarta y el banner vuelve a aparecer.
 */
export const VERSION_CONSENTIMIENTO = 1;

/**
 * Cuánto vale una decisión antes de volver a preguntar: DOCE MESES.
 *
 * Hasta el 16-ago-2026 no caducaba nunca — `leerConsentimiento` validaba la
 * versión del contrato y no miraba el `ts` que guarda al lado—, así que quien
 * aceptó una vez quedaba aceptando para siempre. Es la única cosa de la política
 * de cookies que afirmaba algo que no era cierto.
 *
 * El plazo sale del relevamiento del sector (16-ago-2026): Lombard Odier dice
 * doce meses y Pictet trece, y son las dos únicas casas del set que se toman el
 * trabajo de ponerle plazo. Se toma el más corto de los dos. No hay número
 * uruguayo que respetar —la Guía de Cookies y Perfiles de la URCDP no fija
 * vigencia—, así que la referencia es la convención.
 *
 * ⚠️ ESTE VALOR LO LEEN DOS LADOS Y TIENEN QUE COINCIDIR. Acá lo usa
 * `leerConsentimiento`; en `lib/medicion.ts` viaja interpolado como texto dentro
 * del script inline que corre antes que GTM. Si se desincronizan, el modo de
 * falla es silencioso y de los peores: el script inline concede porque para él
 * la decisión sigue viva, y el banner vuelve a preguntar porque para él caducó.
 */
export const VIGENCIA_CONSENTIMIENTO_MS = 365 * 24 * 60 * 60 * 1000;

export type Consentimiento = {
  v: typeof VERSION_CONSENTIMIENTO;
  /** GA4 y cualquier medición de uso del sitio. */
  analitica: boolean;
  /** Pixel de Meta, Google Ads, remarketing. */
  publicidad: boolean;
  /** Cuándo se decidió. Es la prueba que la ley obliga a poder mostrar. */
  ts: number;
};

/**
 * Las señales de Consent Mode v2 que entiende Google, derivadas de la decisión.
 *
 * `functionality_storage` y `security_storage` van siempre concedidas: son las
 * estrictamente necesarias —que la página ande y no la abuse un tercero— y no
 * requieren consentimiento previo bajo ninguna de las guías aplicables.
 */
export function senales(c: { analitica: boolean; publicidad: boolean }) {
  const a = c.publicidad ? "granted" : "denied";
  return {
    ad_storage: a,
    ad_user_data: a,
    ad_personalization: a,
    analytics_storage: c.analitica ? "granted" : "denied",
    functionality_storage: "granted",
    security_storage: "granted",
  } as const;
}

/** Lo que se guarda cuando alguien decide. Único lugar que arma el objeto. */
export function decidir(analitica: boolean, publicidad: boolean): Consentimiento {
  return { v: VERSION_CONSENTIMIENTO, analitica, publicidad, ts: Date.now() };
}

/**
 * Lee la decisión guardada, o `null` si no hay una válida: sin decisión, con un
 * contrato viejo, o vencida.
 *
 * Las tres devuelven `null` y no un error porque para el llamador son lo mismo —
 * no hay consentimiento vigente, hay que preguntar—. La vencida NO se borra: el
 * `setItem` de la próxima decisión la pisa igual, y borrarla acá dejaría a
 * `guardar()` sin nada que pisar si el visitante cierra sin contestar.
 */
export function leerConsentimiento(): Consentimiento | null {
  try {
    const crudo = localStorage.getItem(CLAVE_CONSENTIMIENTO);
    if (!crudo) return null;
    const c = JSON.parse(crudo);
    if (!c || c.v !== VERSION_CONSENTIMIENTO) return null;
    const ts = typeof c.ts === "number" ? c.ts : 0;
    // Un registro sin `ts` legible cae acá y se trata como vencido, que es la
    // respuesta conservadora: sin la fecha no hay prueba de cuándo se consintió,
    // y sin prueba el consentimiento no se puede sostener.
    if (Date.now() - ts > VIGENCIA_CONSENTIMIENTO_MS) return null;
    return { v: c.v, analitica: !!c.analitica, publicidad: !!c.publicidad, ts };
  } catch {
    // localStorage puede tirar por modo privado o por almacenamiento bloqueado.
    // Sin decisión legible, la respuesta correcta es la conservadora: no hay
    // consentimiento, se vuelve a preguntar.
    return null;
  }
}

/**
 * ¿Hubo una decisión y se venció? Sólo para lo que se le MUESTRA al visitante.
 *
 * `leerConsentimiento` devuelve `null` tanto para "nunca eligió" como para
 * "eligió y caducó", y para decidir qué se mide está bien que sean lo mismo —
 * en los dos casos no hay consentimiento vigente—. Pero no son lo mismo para
 * CONTARLO: desde que existe la caducidad (16-ago-2026), el panel le decía
 * "todavía no elegiste" a alguien que sí había elegido, hace trece meses. Es la
 * misma clase de afirmación falsa que la caducidad vino a arreglar.
 *
 * ⚠️ NO usar esto para conceder nada. Una decisión vencida no es consentimiento.
 */
export function hayDecisionVencida(): boolean {
  try {
    const crudo = localStorage.getItem(CLAVE_CONSENTIMIENTO);
    if (!crudo) return false;
    const c = JSON.parse(crudo);
    // Un contrato de otra versión no cuenta como decisión vencida sino como
    // decisión inexistente: se tomó sobre otra pregunta.
    if (!c || c.v !== VERSION_CONSENTIMIENTO || typeof c.ts !== "number") return false;
    return Date.now() - c.ts > VIGENCIA_CONSENTIMIENTO_MS;
  } catch {
    // Sin poder leer, no se puede afirmar que hubo una decisión: la leyenda cae
    // al caso general ("todavía no elegiste"), que es el que no miente.
    return false;
  }
}
