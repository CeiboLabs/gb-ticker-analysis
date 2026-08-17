/**
 * Rótulos del eje de tiempo. Los comparten el gráfico de precio de /analisis y
 * el del fondo, por el mismo motivo que dragRange: el problema es del EJE, no de
 * cada gráfico, y tenerlo dos veces es arreglarlo dos veces.
 *
 * QUÉ ARREGLA
 * lightweight-charts decide DÓNDE va cada marca y después la rotula según su
 * "peso" (año / mes / día), y las dos decisiones no se hablan:
 *
 *   · la posición sale sólo de una distancia en índices —80px de reserva por
 *     rótulo divididos por el ancho de barra—, así que en «Máx» del backtest
 *     (1.127 cierres en 360px) la marca de año del 2-ene-2024 quedaba afuera POR
 *     UN ÍNDICE (250 de separación contra 251 que pedía la reserva) y entraba en
 *     su lugar la del día siguiente, el 3;
 *   · el rótulo lo pone el peso de la marca que entró, y la del 3 de enero es
 *     una marca de DÍA: el eje imprimía «3».
 *
 * Eso es lo que se veía en el teléfono —«3  2023  3  2025  Feb.»—: dos números
 * sueltos, sin mes ni año, en una ventana de cuatro años y medio. Y no es una
 * rareza de «Máx»: el PRIMER punto de cualquier serie recibe un peso adivinado
 * (la librería le inventa un punto anterior a distancia promedio), que en una
 * serie diaria da siempre "día", así que el borde izquierdo imprimía un número
 * suelto en casi todas las ventanas — «16  24  Ago.  11» en 1M, «18  Jun.  12
 * Jul.  14» en 3M, «2024  Abr.  Jul.  Oct.  20» en el backtest por año.
 *
 * LA REGLA
 * El rótulo no se decide por el peso de la marca sino por la VENTANA que se está
 * mirando, y siempre dice lo suficiente para ubicarse solo:
 *
 *   ventana         rótulo                        ejemplo
 *   ──────────────  ────────────────────────────  ──────────────────────────
 *   intradía        hora de Uruguay               11:00  12:00  13:00
 *   ≤ 4 meses       día + mes                     16 jul  24 jul  3 ago
 *   ≤ 13 meses      mes; el año, en su marca      sep  oct  2026  feb  mar
 *   más             mes + año                     ene '23  ene '25  mar '26
 *
 * y en las dos últimas, la marca que cae a mitad de mes dice su fecha («31 dic»)
 * en vez de colapsar al mes, que es lo que la haría repetir el rótulo del vecino.
 *
 * Ninguna combinación pasa de 8 caracteres, que es lo que la librería reserva
 * por rótulo (`TickMarkFormatter`: más largo y las marcas se pisan).
 */
import type { Time } from "lightweight-charts";

/** Meses en la abreviatura del sitio: minúscula y sin punto ("3 feb '25"). */
export const MESES_CORTO = [
  "ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic",
] as const;

const DIA_MS = 86_400_000;

// Las marcas intradía se leen EN HORA DE URUGUAY, igual que el resto de la
// página (la chapa de mercado, la nota de rueda): la rueda es de Nueva York pero
// el reloj que se rotula es el de quien lee.
const partesUY = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Montevideo",
  year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});

interface PartesTiempo {
  anio: number;
  /** 1-12. */
  mes: number;
  dia: number;
  /** "13:30" — vacío en un cierre diario, que no tiene hora. */
  hora: string;
}

/**
 * Fecha de una marca, ya desarmada. Es el único lugar que sabe de husos, y
 * distingue las dos formas en que llega el tiempo a estos gráficos:
 *
 *   · 'YYYY-MM-DD' — un cierre. Se parte a mano y NO con `new Date(cadena)`:
 *     esa cadena se parsea como medianoche UTC, y cualquier lectura local
 *     (getDate) devuelve el día ANTERIOR al oeste de Greenwich. O sea siempre,
 *     acá.
 *   · epoch en segundos — una barra intradía, que sí se convierte a hora de UY.
 */
export function partesDeTiempo(time: Time | string | number): PartesTiempo | null {
  if (typeof time === "string") {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(time);
    return m ? { anio: +m[1], mes: +m[2], dia: +m[3], hora: "" } : null;
  }
  if (typeof time === "number") {
    const d = new Date(time * 1000);
    if (Number.isNaN(d.getTime())) return null;
    const p: Record<string, string> = {};
    for (const { type, value } of partesUY.formatToParts(d)) p[type] = value;
    return {
      anio: +p.year, mes: +p.month, dia: +p.day,
      hora: `${p.hour}:${p.minute}`,
    };
  }
  // BusinessDay ({ year, month, day }) — no lo usa ningún gráfico del sitio, pero
  // es una de las formas que admite `Time` y no cuesta nada contemplarla.
  if (time && typeof time === "object" && "year" in time) {
    return { anio: time.year, mes: time.month, dia: time.day, hora: "" };
  }
  return null;
}

/** 'YYYY-MM-DD' o epoch en segundos → milisegundos, para medir la ventana. */
function aMs(time: string | number): number {
  return typeof time === "number" ? time * 1000 : Date.parse(`${time}T00:00:00Z`);
}

/**
 * Formateador de las marcas del eje, calibrado a la ventana que se dibuja.
 * `tiempos` son los tiempos de la serie —sin ordenar hace falta: se busca el
 * mínimo y el máximo—, en cualquiera de las dos formas que acepta el gráfico.
 *
 * Devuelve `null` para lo que no sepa leer: ahí la librería cae a su formateador
 * de siempre.
 */
export function rotulosEjeTiempo(
  tiempos: readonly (string | number)[],
): (time: Time | string | number, tickMarkType: number) => string | null {
  let desde = Infinity;
  let hasta = -Infinity;
  for (const t of tiempos) {
    const ms = aMs(t);
    if (!Number.isFinite(ms)) continue;
    if (ms < desde) desde = ms;
    if (ms > hasta) hasta = ms;
  }
  const spanDias = Number.isFinite(desde) && Number.isFinite(hasta) ? (hasta - desde) / DIA_MS : 0;

  // Escala de lectura de la ventana, en dos cortes:
  //
  //   · 120 días ≈ 4 meses. Hasta ahí el día ES el dato (1D, 5D, 1M, 3M).
  //   · 400 días ≈ un año y pico. Hasta ahí manda el mes y el año se dice UNA
  //     vez, en la marca de año —«sep  oct  nov  dic  2026  feb  mar»—, que es
  //     la convención de todos los gráficos financieros. Se puede confiar en esa
  //     marca porque en una ventana así SIEMPRE entra: la librería descarta una
  //     marca cuando su vecina está a menos de la reserva de ~80px, y para que
  //     un año entero mida menos que eso hacen falta más de tres cierres por
  //     píxel — en una ventana de un año va uno cada 1,3px.
  //   · De 400 para arriba deja de ser confiable —«Máx» del backtest son 1.127
  //     cierres y en el teléfono se come dos de las cuatro marcas de año—, así
  //     que el año va pegado a cada rótulo: «ene '23  ene '25  mar '26». Sin eso,
  //     el eje decía «2023  2025  mar» y ese «mar» podía ser de 2025 o de 2026.
  const escala = spanDias <= 120 ? "dia" : spanDias <= 400 ? "mes" : "anio";

  return (time, tickMarkType) => {
    const p = partesDeTiempo(time);
    if (!p) return null;
    const mes = MESES_CORTO[p.mes - 1] ?? "";
    // Tipos de marca de la librería: 0 = año, 1 = mes, 2 = día, 3 = hora,
    // 4 = hora con segundos. Los segundos no se rotulan: ni el 1D (barras de 5
    // minutos) ni el 5D (de 30) los tienen.
    if (tickMarkType >= 3) return p.hora || null;
    if (escala === "dia") return `${p.dia} ${mes}`;

    // Una marca de DÍA que cae en los primeros días del mes está marcando el
    // mes: o es el primer cierre del mes, o es la marca de mes que quedó afuera
    // por un índice y entró la del día siguiente (el defecto de arriba). Una que
    // cae a mitad de mes marca una fecha, y la dice — si se la rotulara con su
    // mes a secas el eje repetiría el rótulo del vecino: el backtest 2024 a
    // 1.114px, que termina el 31 de diciembre, cerraba con «… nov  dic  dic».
    if (tickMarkType === 2 && p.dia > 4) return `${p.dia} ${mes}`;

    if (escala === "mes") return tickMarkType === 0 ? String(p.anio) : mes;
    return `${mes} '${String(p.anio).slice(-2)}`;
  };
}
