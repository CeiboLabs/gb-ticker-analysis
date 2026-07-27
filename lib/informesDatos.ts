// Autocompletado de los cuadros del semanal desde datos de mercado. Traduce el
// catálogo de instrumentos (con su símbolo Yahoo) a los bloques `retornos` que
// consume el artículo. Empieza por lo GLOBAL (índices/cripto/commodities/FX);
// lo regional y lo uruguayo (UI, LRM, bono, serie del dólar) van después —esos
// necesitan fuentes propias.
//
// Los símbolos marcados con `revisar` son el "puñado ambiguo" que hay que
// confirmar con el cliente para que el número dé idéntico al que publican
// (cripto: hora de corte; oro/plata: GLD/SLV vs futuros).

import { serieDiaria, serieDiariaTD, retornoSemanal } from "./marketData";
import { serieBCU, BCU_COD } from "./bcu";
import { subastasLRMSemana } from "./bcuLRM";
import type { Bloque, Dato, GrupoDatos, LineaSerie } from "./informeContenido/tipos";

const diasAtras = (hasta: string, n: number) =>
  new Date(new Date(`${hasta}T00:00:00Z`).getTime() - n * 86_400_000).toISOString().slice(0, 10);

type Item = {
  etiqueta: string;
  symbol: string;
  revisar?: boolean;
  /** Fuente del dato. Default Yahoo; "td" = Twelve Data (FX); "bcu" = BCU (UYU/UI). */
  fuente?: "yahoo" | "td" | "bcu";
  /** Invertir el signo del retorno (FX: el informe muestra la moneda local vs USD). */
  invertir?: boolean;
};
type Grupo = { nombre: string; items: Item[] };

// Cuadro "Retornos de la semana · global" — mismo agrupamiento que el PDF.
export const CATALOGO_GLOBAL: Grupo[] = [
  {
    nombre: "América",
    items: [
      { etiqueta: "Dow Jones", symbol: "^DJI" },
      { etiqueta: "S&P 500", symbol: "^GSPC" },
      // El cliente rotula "Nasdaq 100" pero su número coincide con el COMPOSITE
      // (^IXIC), no con el NDX — validado vs 05-22 (0,45 vs 0,50) y 05-29 (2,39 vs 2,58).
      { etiqueta: "Nasdaq 100", symbol: "^IXIC" },
    ],
  },
  {
    nombre: "Europa",
    items: [
      { etiqueta: "EuroStoxx 50", symbol: "^STOXX50E" },
      { etiqueta: "FTSE 100", symbol: "^FTSE" },
      { etiqueta: "CAC 40", symbol: "^FCHI" },
      { etiqueta: "DAX", symbol: "^GDAXI" },
      { etiqueta: "IBEX", symbol: "^IBEX" },
      { etiqueta: "MIB", symbol: "FTSEMIB.MI" },
      // ^SSMI difiere del valor del cliente por hora de corte del mercado suizo
      // (no es problema de símbolo: el desvío es inconsistente semana a semana).
      { etiqueta: "SMI", symbol: "^SSMI", revisar: true },
    ],
  },
  {
    nombre: "Asia",
    items: [
      { etiqueta: "Nikkei", symbol: "^N225" },
      { etiqueta: "Hang Seng", symbol: "^HSI" },
      // 399001.SZ = Componente de Shenzhen; el cliente usa otro índice de Shenzhen
      // (los alternativos —Composite 399106, etc.— no están en Yahoo). Revisar.
      { etiqueta: "Shenzhen", symbol: "399001.SZ", revisar: true },
      { etiqueta: "ASX 200", symbol: "^AXJO" },
    ],
  },
  {
    nombre: "Materias primas y monedas",
    items: [
      { etiqueta: "BTC", symbol: "BTC-USD", revisar: true }, // 24h: fijar hora de corte
      { etiqueta: "ETH", symbol: "ETH-USD", revisar: true },
      { etiqueta: "Oro", symbol: "GLD", revisar: true }, // ETF que nombra el PDF, no futuro
      { etiqueta: "Plata", symbol: "SLV", revisar: true },
      { etiqueta: "EUR", symbol: "EURUSD=X" },
      { etiqueta: "JPY", symbol: "JPY=X", revisar: true }, // USDJPY vs JPYUSD, definición
    ],
  },
];

/**
 * Trae los retornos de un catálogo para la semana que cierra en `hasta` (viernes).
 * Los instrumentos sin dato (ej. índices que no están en las fuentes gratuitas) NO
 * se descartan en silencio: van a `faltantes` y se muestran como "s/d" para que el
 * analista los complete y no se publique una tabla a la que le faltan filas.
 */
async function retornosDeCatalogo(catalogo: Grupo[], hasta: string): Promise<GrupoDatos[]> {
  return Promise.all(
    catalogo.map(async (g) => {
      const resultados = await Promise.all(
        g.items.map(async (it) => {
          const serie =
            it.fuente === "bcu"
              ? await serieBCU(Number(it.symbol), diasAtras(hasta, 20), hasta).catch(() => [] as never[])
              : it.fuente === "td"
                ? await serieDiariaTD(it.symbol, hasta).catch(() => [] as never[])
                : await serieDiaria(it.symbol).catch(() => [] as never[]);
          const r = retornoSemanal(serie, hasta);
          const valor = r == null ? null : Number((it.invertir ? -r : r).toFixed(2));
          return { etiqueta: it.etiqueta, valor };
        }),
      );
      const datos: Dato[] = resultados.filter((d): d is Dato => d.valor != null);
      const faltantes = resultados.filter((d) => d.valor == null).map((d) => d.etiqueta);
      return faltantes.length ? { nombre: g.nombre, datos, faltantes } : { nombre: g.nombre, datos };
    }),
  );
}

/** Nota al pie de un cuadro de retornos: agrega la aclaración de "s/d" si faltan. */
function notaRetornos(grupos: GrupoDatos[], base: string): string {
  const hayFaltantes = grupos.some((g) => g.faltantes?.length);
  return hayFaltantes ? `${base} «s/d» = sin fuente automática; completar a mano.` : base;
}

/** Bloque `retornos` global listo para insertar en el artículo. */
export async function retornosGlobal(hasta: string): Promise<Extract<Bloque, { tipo: "retornos" }>> {
  const grupos = await retornosDeCatalogo(CATALOGO_GLOBAL, hasta);
  return {
    tipo: "retornos",
    titulo: "Retornos de la semana · global",
    grupos,
    nota: notaRetornos(grupos, "Variación semanal, en %."),
  };
}

// Cuadro "Retornos de la semana · región" — Monedas + Índices de Latinoamérica.
// Varios `revisar`: los índices de Perú/Colombia y los pares menos líquidos hay
// que confirmarlos contra la fuente del cliente.
export const CATALOGO_REGIONAL: Grupo[] = [
  {
    nombre: "Monedas",
    // FX por Twelve Data (Yahoo es poco fiable en estos pares) y con el signo
    // INVERTIDO: el informe muestra la moneda local vs USD (+ = la moneda local se
    // fortalece), que es −(retorno de USD/XXX). UYU sale flojo (mercado fino) →
    // debería venir del BCU. Confirmar la convención del signo con el cliente.
    items: [
      { etiqueta: "USDCOP", symbol: "USD/COP", fuente: "td", invertir: true },
      { etiqueta: "USDCLP", symbol: "USD/CLP", fuente: "td", invertir: true },
      { etiqueta: "USDMXN", symbol: "USD/MXN", fuente: "td", invertir: true },
      { etiqueta: "USDARS", symbol: "USD/ARS", fuente: "td", invertir: true, revisar: true },
      { etiqueta: "USDPEN", symbol: "USD/PEN", fuente: "td", invertir: true },
      { etiqueta: "USDUYU", symbol: String(BCU_COD.DOLAR), fuente: "bcu", invertir: true }, // BCU: fixing local, exacto
    ],
  },
  {
    nombre: "Índices",
    items: [
      { etiqueta: "IPC MEX", symbol: "^MXX" },
      { etiqueta: "IBOVESPA", symbol: "^BVSP" },
      { etiqueta: "MERVAL", symbol: "^MERV" },
      { etiqueta: "CHILE SLCT", symbol: "^IPSA", revisar: true },
      { etiqueta: "MSCI NUAM PERU", symbol: "^SPBLPGPT", revisar: true },
      { etiqueta: "COLOM COL", symbol: "^COLCAP", revisar: true },
    ],
  },
];

/** Bloque `retornos` regional listo para insertar en el artículo. */
export async function retornosRegional(hasta: string): Promise<Extract<Bloque, { tipo: "retornos" }>> {
  const grupos = await retornosDeCatalogo(CATALOGO_REGIONAL, hasta);
  return {
    tipo: "retornos",
    titulo: "Retornos de la semana · región",
    grupos,
    nota: notaRetornos(grupos, "Variación semanal, en moneda local salvo pares de divisas."),
  };
}

/** Rebasea una serie a 100 en su primer punto (para el gráfico UI vs USD base=100). */
function rebase100(puntos: LineaSerie["puntos"]): LineaSerie["puntos"] {
  const base = puntos[0]?.v;
  if (!base) return puntos;
  return puntos.map((p) => ({ t: p.t, v: Number(((p.v / base) * 100).toFixed(2)) }));
}

/** Valor de la serie en `dia` o el día hábil inmediato anterior (hasta 8 días atrás). */
function valorEnOAntes(puntos: LineaSerie["puntos"], dia: string): number | null {
  const map = new Map(puntos.map((p) => [p.t, p.v]));
  const base = new Date(`${dia}T00:00:00Z`).getTime();
  for (let k = 0; k < 8; k++) {
    const v = map.get(new Date(base - k * 86_400_000).toISOString().slice(0, 10));
    if (v != null) return v;
  }
  return null;
}

/** Retorno % entre el cierre en/antes de `desde` y el cierre en/antes de `hasta`. */
function retornoEntre(puntos: LineaSerie["puntos"], desde: string, hasta: string): number | null {
  const ini = valorEnOAntes(puntos, desde);
  const fin = valorEnOAntes(puntos, hasta);
  if (ini == null || fin == null || ini === 0) return null;
  return Number(((fin / ini - 1) * 100).toFixed(2));
}

/**
 * La mini-tabla dólar/UI de la P1: el retorno de cada uno en tres ventanas, todo
 * de la MISMA serie del BCU que ya bajaron los gráficos (cero fetch extra):
 * — «Período»: sobre todo el tramo de los gráficos de arriba (mismo período ⇒ el
 *   número cuadra con la línea). El PDF viejo usaba una base fija más antigua, así
 *   que este valor puede diferir del histórico; se ata al gráfico a propósito.
 * — «En el año»: contra el cierre del 31-dic del año anterior (YTD).
 * — «1 año»: contra el cierre de 365 días atrás (validado EXACTO vs el 05-22).
 */
export function miniTablaDolarUI(
  usd: LineaSerie["puntos"],
  ui: LineaSerie["puntos"],
  hasta: string,
): Extract<Bloque, { tipo: "tabla" }> {
  const finAnioAnterior = `${Number(hasta.slice(0, 4)) - 1}-12-31`;
  const hace1Anio = diasAtras(hasta, 365);
  const periodo = (p: LineaSerie["puntos"]) => {
    const a = p[0]?.v;
    const b = p[p.length - 1]?.v;
    return a && b ? Number(((b / a - 1) * 100).toFixed(2)) : null;
  };
  const celda = (n: number | null): string | number => (n == null ? "s/d" : n);
  return {
    tipo: "tabla",
    titulo: "Dólar y Unidad Indexada · retorno",
    columnas: [{ titulo: "Ventana" }, { titulo: "USD", delta: true }, { titulo: "UI", delta: true }],
    filas: [
      ["Período", celda(periodo(usd)), celda(periodo(ui))],
      ["En el año", celda(retornoEntre(usd, finAnioAnterior, hasta)), celda(retornoEntre(ui, finAnioAnterior, hasta))],
      ["1 año", celda(retornoEntre(usd, hace1Anio, hasta)), celda(retornoEntre(ui, hace1Anio, hasta))],
    ],
    nota: "Variación del dólar y de la UI por ventana. «Período» = tramo de los gráficos. Fuente: BCU — revisar antes de publicar.",
  };
}

/**
 * Los dos gráficos de línea de la página 1 —la evolución del dólar y "UI vs USD
 * (base = 100)"— más la mini-tabla de retornos dólar/UI, todo desde el BCU (lo que
 * antes "esperaba el Excel"). Ambas series se traen una sola vez, ~2 años hasta
 * `hasta`, y alimentan tanto las líneas como la tabla. El dólar del BCU da EXACTO
 * el cierre que publica el informe.
 */
export async function bloquesUruguayos(hasta: string): Promise<Bloque[]> {
  const desde = diasAtras(hasta, 730);
  const [usdRaw, uiRaw] = await Promise.all([
    serieBCU(BCU_COD.DOLAR, desde, hasta).catch(() => []),
    serieBCU(BCU_COD.UI, desde, hasta).catch(() => []),
  ]);
  const usd = usdRaw.map((p) => ({ t: p.fecha, v: p.close }));
  const ui = uiRaw.map((p) => ({ t: p.fecha, v: p.close }));
  const NOTA = "Fuente: BCU — revisar antes de publicar.";
  return [
    {
      tipo: "serie",
      titulo: "USD",
      subtitulo: "Evolución del dólar · cierre diario",
      lineas: [{ nombre: "USD", enfasis: "primaria", puntos: usd }],
      nota: NOTA,
    },
    {
      tipo: "serie",
      titulo: "UI vs USD (base = 100)",
      subtitulo: "Reescalados a 100 al inicio del período",
      lineas: [
        { nombre: "USD", enfasis: "primaria", puntos: rebase100(usd) },
        { nombre: "UI", enfasis: "secundaria", puntos: rebase100(ui) },
      ],
      nota: NOTA,
    },
    miniTablaDolarUI(usd, ui, hasta),
  ];
}

/**
 * Tabla "Tasas de corte · LRM": las subastas de Letras de Regulación Monetaria de
 * la semana, del Excel de operaciones del BCU (ver lib/bcuLRM). Devuelve null si
 * el BCU no responde o no hubo subastas → el bloque no se inserta y el analista lo
 * carga a mano; nunca rompe el resto de los datos (por eso el try/catch).
 */
export async function bloqueLRM(hasta: string): Promise<Extract<Bloque, { tipo: "tabla" }> | null> {
  try {
    const subastas = await subastasLRMSemana(hasta);
    if (subastas.length === 0) return null;
    return {
      tipo: "tabla",
      titulo: "Tasas de corte · LRM",
      columnas: [{ titulo: "Plazo (días)" }, { titulo: "Tasa", sufijo: " %" }],
      filas: subastas.map((s) => [s.plazo, s.tasa]),
      nota: "Letras de Regulación Monetaria en pesos · tasa de corte por subasta de la semana. Fuente: BCU — revisar antes de publicar.",
    };
  } catch {
    return null;
  }
}

/**
 * Todos los bloques que se autocompletan para la semana que cierra en `hasta`: la
 * tabla de tasas de corte de LRM, los dos gráficos de línea + la mini-tabla dólar/
 * UI de la página 1 (BCU), y los cuadros de retornos regional y global. El analista
 * los ubica en su sección y escribe la prosa alrededor.
 */
export async function datosDelSemanal(hasta: string): Promise<Bloque[]> {
  const [lrm, uruguayos, regional, global] = await Promise.all([
    bloqueLRM(hasta),
    bloquesUruguayos(hasta),
    retornosRegional(hasta),
    retornosGlobal(hasta),
  ]);
  return [...(lrm ? [lrm] : []), ...uruguayos, regional, global];
}
