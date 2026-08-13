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

/** Lee la decisión guardada, o `null` si no hay una válida para esta versión. */
export function leerConsentimiento(): Consentimiento | null {
  try {
    const crudo = localStorage.getItem(CLAVE_CONSENTIMIENTO);
    if (!crudo) return null;
    const c = JSON.parse(crudo);
    if (!c || c.v !== VERSION_CONSENTIMIENTO) return null;
    return { v: c.v, analitica: !!c.analitica, publicidad: !!c.publicidad, ts: c.ts ?? 0 };
  } catch {
    // localStorage puede tirar por modo privado o por almacenamiento bloqueado.
    // Sin decisión legible, la respuesta correcta es la conservadora: no hay
    // consentimiento, se vuelve a preguntar.
    return null;
  }
}
