// BNG Selección Global — backtest de la estrategia (capa de datos).
//
// QUÉ ES Y QUÉ NO ES
// Una SIMULACIÓN: la estrategia de hoy aplicada hacia atrás sobre precios
// históricos, en base 100. No es el valor cuota del Fondo —que todavía no
// comenzó a publicarse— ni el rendimiento de ningún inversor real.
//
// Esa distinción es la razón de ser de este módulo entero, así que está horneada
// en los nombres: las series se llaman `estrategia` y `referencia`, nunca `nav`
// ni `fondo`, y el tipo NO es FundSnapshot aunque lo use por dentro. Si algún día
// alguien conecta esto a la ficha, al valor cuota o a la calculadora, que tenga
// que renombrar cosas primero — el tipeo es la última barandilla.
//
// La página ya tuvo DOS episodios de este mismo problema, los dos revertidos:
// el gráfico del benchmark solo (jul → 3-ago-2026, ver el comentario largo de
// FondoPerformance) y la calculadora con el retorno del fondo fijado en 8%
// anual (ver el comentario de la sección Calculadora en la página). No hay un
// tercero: acá el dato se publica ROTULADO, o no se publica.
//
// EL DATO viene de un Excel del cliente, importado por scripts/fondo-backtest.mts
// a public/fondo/backtest-estrategia.json. Se pide en diferido —sólo se monta en
// pre-lanzamiento— para no cargarle ~33 KB a quien nunca baja hasta Rendimientos.

import { useEffect, useState } from "react";
import { snapshotFromSeries, type FundNavPoint, type FundSnapshot } from "@/lib/fondo";

/** Ruta del asset. ⚠️ Está también en scripts/build-fondo.mts, que lo copia al
 *  deploy estático a mano: el barrido de assets sólo mira el HTML y los CSS, y
 *  esto se pide por fetch. Si cambia acá, cambia allá (hay guarda en el build). */
export const BACKTEST_URL = "/fondo/backtest-estrategia.json";

/** Forma cruda del JSON — columnar, tal como lo escribe el importador. */
type BacktestRaw = {
  fuente: string;
  desde: string;
  hasta: string;
  base: number;
  dias: string[];
  estrategia: number[];
  referencia: number[];
};

export type Backtest = {
  /** Primer y último cierre simulados, 'YYYY-MM-DD'. */
  desde: string;
  hasta: string;
  /** Años calendario presentes en la serie, ascendente. */
  anios: number[];
  estrategia: FundNavPoint[];
  referencia: FundNavPoint[];
  /**
   * Rendimientos por período, por año calendario y estadísticas — de la
   * ESTRATEGIA en `returns`/`calendar`/`stats`, de la REFERENCIA en
   * `benchReturns`/`benchCalendar`.
   *
   * Se calcula con `snapshotFromSeries`, la misma función que arma las tablas
   * del Fondo, y eso es deliberado: si el criterio de un año calendario o de un
   * YTD cambia alguna vez, tiene que cambiar en los dos lados a la vez. Dos
   * implementaciones de "rentabilidad 2024" en la misma página es una que
   * eventualmente contradice a la otra.
   */
  agregados: FundSnapshot;
};

export type BacktestState =
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "ready"; data: Backtest };

// Un punto de la serie tiene la forma de FundNavPoint para poder reusar los
// cómputos de lib/fondo.ts. `aum` va en null: una simulación no tiene patrimonio.
const aPuntos = (dias: string[], valores: number[]): FundNavPoint[] =>
  dias.map((dia, i) => ({ dia, nav: valores[i], aum: null }));

function normalizar(raw: BacktestRaw): Backtest {
  const estrategia = aPuntos(raw.dias, raw.estrategia);
  const referencia = aPuntos(raw.dias, raw.referencia);
  return {
    desde: raw.desde,
    hasta: raw.hasta,
    anios: [...new Set(raw.dias.map((d) => Number(d.slice(0, 4))))].sort((a, b) => a - b),
    estrategia,
    referencia,
    agregados: snapshotFromSeries(estrategia, referencia),
  };
}

// Validación mínima del payload: si el JSON llegara truncado o desalineado, es
// mejor caer al estado de error —la página muestra el aviso de siempre— que
// dibujar una curva con puntos corridos. Un gráfico mal alineado no se ve roto,
// se ve como otro rendimiento.
function esValido(raw: unknown): raw is BacktestRaw {
  if (!raw || typeof raw !== "object") return false;
  const r = raw as Partial<BacktestRaw>;
  return (
    Array.isArray(r.dias) &&
    Array.isArray(r.estrategia) &&
    Array.isArray(r.referencia) &&
    r.dias.length > 1 &&
    r.dias.length === r.estrategia.length &&
    r.dias.length === r.referencia.length &&
    typeof r.desde === "string" &&
    typeof r.hasta === "string"
  );
}

// Promesa cacheada a nivel de módulo — mismo patrón que useFondo: el asset se
// pide una sola vez aunque el componente monte y desmonte.
let cached: Promise<Backtest> | null = null;

function load(): Promise<Backtest> {
  if (!cached) {
    cached = fetch(BACKTEST_URL, { headers: { Accept: "application/json" } })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("bad status"))))
      .then((raw) => {
        if (!esValido(raw)) throw new Error("payload inválido");
        return normalizar(raw);
      })
      .catch((e) => {
        cached = null; // permitir reintento en el próximo montaje
        throw e;
      });
  }
  return cached;
}

/**
 * @param enabled Si es false NO se pide el asset. El llamador lo apaga cuando el
 * Fondo ya publica valor cuota: ahí este bloque no se dibuja y bajar ~33 KB para
 * descartarlos sería el mismo desperdicio que motivó sacar la serie del
 * benchmark del payload de /api/fondo (docs/rendimiento-fondo.md §6.1).
 *
 * Va como flag y no como "llamar al hook condicionalmente" —que no se puede—
 * ni como hook adentro del componente que dibuja: el módulo de performance
 * necesita saber si hay backtest ANTES de decidir qué ocupa el lugar del
 * gráfico, así que la lectura vive arriba y el dato baja por props.
 */
export function useBacktest(enabled = true): BacktestState {
  const [state, setState] = useState<BacktestState>({ kind: "loading" });
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    load()
      .then((data) => { if (alive) setState({ kind: "ready", data }); })
      .catch(() => { if (alive) setState({ kind: "error" }); });
    return () => { alive = false; };
  }, [enabled]);
  return state;
}

// ── Ventanas del gráfico ─────────────────────────────────────────────────────

/**
 * Recorta la serie a un año calendario INCLUYENDO el último cierre del año
 * anterior como primer punto.
 *
 * Ese punto extra no es un detalle: es el ancla. Un año calendario se mide
 * contra el cierre del 31 de diciembre anterior (así lo hace `computeCalendar`
 * en lib/fondo.ts, y así lo hace cualquier ficha de fondo). Si la ventana
 * arrancara en el primer cierre de enero, la curva rebasada a 100 terminaría en
 * un número distinto del que dice la tabla de abajo, por unas décimas — dos
 * cifras para el mismo año en la misma pantalla.
 */
export function ventanaAnio(rows: FundNavPoint[], anio: number): FundNavPoint[] {
  const desde = `${anio}-01-01`;
  const hasta = `${anio}-12-31`;
  const previos = rows.filter((p) => p.dia < desde);
  const ancla = previos.length > 0 ? [previos[previos.length - 1]] : [];
  return [...ancla, ...rows.filter((p) => p.dia >= desde && p.dia <= hasta)];
}

/** Reescala a 100 en el primer punto de la ventana. La serie completa ya viene
 *  en base 100; esto sólo importa para las ventanas por año. */
export function rebase100(rows: FundNavPoint[]): FundNavPoint[] {
  if (rows.length === 0) return rows;
  const base = rows[0].nav;
  if (!base) return rows;
  return rows.map((p) => ({ ...p, nav: (p.nav / base) * 100 }));
}

/** Id de la vista «toda la serie» en el selector del backtest. */
export const BACKTEST_TODO = "todo";

/** ¿El último año de la serie está a medio correr? */
export const ultimoAnioParcial = (data: Backtest) => !data.hasta.endsWith("-12-31");

/**
 * Rótulo de un año en el selector y en la tabla. El último, si está a medio
 * correr, se llama «YTD» y no por su número: es «en lo que va del año», que es
 * como lo pidió el cliente y como ya se llama en el selector del Fondo. Además
 * dice «parcial» por definición, así que no necesita asterisco; qué ventana
 * cubre exactamente lo dice la nota al pie de la tabla.
 *
 * Va condicionado y no fijo: el día que llegue un Excel cerrado al 31 de
 * diciembre, ese año deja de ser YTD y vuelve a rotularse con su número.
 */
export function rotuloAnio(data: Backtest, anio: number): string {
  const ultimo = data.anios[data.anios.length - 1];
  return anio === ultimo && ultimoAnioParcial(data) ? "YTD" : String(anio);
}

/** Opciones del selector de período del backtest: un chip por año + «Todo» al
 *  final, que es el agregado (mismo orden que el del Fondo, donde cierra «Máx»). */
export function periodosBacktest(data: Backtest): { id: string; label: string }[] {
  return [
    ...data.anios.map((a) => ({ id: String(a), label: rotuloAnio(data, a) })),
    { id: BACKTEST_TODO, label: "Todo" },
  ];
}

/**
 * Las dos series ya recortadas y rebasadas para una vista del selector.
 * «Todo» ya viene en base 100 desde el importador; por año se recorta con ancla
 * en el cierre de diciembre anterior y se rebasa ahí (ver ventanaAnio).
 */
export function ventanaVista(data: Backtest, vista: string) {
  if (vista === BACKTEST_TODO) {
    return { estrategia: data.estrategia, referencia: data.referencia };
  }
  const anio = Number(vista);
  return {
    estrategia: rebase100(ventanaAnio(data.estrategia, anio)),
    referencia: rebase100(ventanaAnio(data.referencia, anio)),
  };
}
