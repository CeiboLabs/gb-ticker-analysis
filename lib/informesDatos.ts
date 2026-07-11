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
import type { Bloque, GrupoDatos, LineaSerie } from "./informeContenido/tipos";

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
      { etiqueta: "Nasdaq 100", symbol: "^NDX" },
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
      { etiqueta: "SMI", symbol: "^SSMI" },
    ],
  },
  {
    nombre: "Asia",
    items: [
      { etiqueta: "Nikkei", symbol: "^N225" },
      { etiqueta: "Hang Seng", symbol: "^HSI" },
      { etiqueta: "Shenzhen", symbol: "399001.SZ" },
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

/** Trae los retornos de un catálogo para la semana que cierra en `hasta` (viernes). */
async function retornosDeCatalogo(catalogo: Grupo[], hasta: string): Promise<GrupoDatos[]> {
  return Promise.all(
    catalogo.map(async (g) => {
      const datos = await Promise.all(
        g.items.map(async (it) => {
          const serie =
            it.fuente === "bcu"
              ? await serieBCU(Number(it.symbol), diasAtras(hasta, 20), hasta).catch(() => [] as never[])
              : it.fuente === "td"
                ? await serieDiariaTD(it.symbol, hasta).catch(() => [] as never[])
                : await serieDiaria(it.symbol).catch(() => [] as never[]);
          const r = retornoSemanal(serie, hasta);
          if (r == null) return null;
          const valor = it.invertir ? -r : r;
          return { etiqueta: it.etiqueta, valor: Number(valor.toFixed(2)) };
        }),
      );
      return { nombre: g.nombre, datos: datos.filter((d): d is { etiqueta: string; valor: number } => d != null) };
    }),
  );
}

/** Bloque `retornos` global listo para insertar en el artículo. */
export async function retornosGlobal(hasta: string): Promise<Extract<Bloque, { tipo: "retornos" }>> {
  const grupos = await retornosDeCatalogo(CATALOGO_GLOBAL, hasta);
  return { tipo: "retornos", titulo: "Retornos de la semana · global", grupos, nota: "Variación semanal, en %." };
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
    nota: "Variación semanal, en moneda local salvo pares de divisas.",
  };
}

/** Rebasea una serie a 100 en su primer punto (para el gráfico UI vs USD base=100). */
function rebase100(puntos: LineaSerie["puntos"]): LineaSerie["puntos"] {
  const base = puntos[0]?.v;
  if (!base) return puntos;
  return puntos.map((p) => ({ t: p.t, v: Number(((p.v / base) * 100).toFixed(2)) }));
}

/**
 * Los dos gráficos de línea de la página 1 —la evolución del dólar y "UI vs USD
 * (base = 100)"— desde el BCU (lo que antes "esperaba el Excel"). Ambas series se
 * traen una sola vez, ~2 años hasta `hasta`. El dólar del BCU da EXACTO el cierre
 * que publica el informe.
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
  ];
}

/**
 * Todos los bloques que se autocompletan para la semana que cierra en `hasta`: los
 * dos gráficos de línea de la página 1 (BCU), el cuadro regional y el global. El
 * analista los ubica en su sección y escribe la prosa alrededor.
 */
export async function datosDelSemanal(hasta: string): Promise<Bloque[]> {
  const [uruguayos, regional, global] = await Promise.all([
    bloquesUruguayos(hasta),
    retornosRegional(hasta),
    retornosGlobal(hasta),
  ]);
  return [...uruguayos, regional, global];
}
