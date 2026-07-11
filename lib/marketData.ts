// Datos de mercado para autocompletar los cuadros del informe semanal. Fuente:
// Yahoo Finance (endpoint chart, sin API key). Server-only: se llama desde una
// ruta del panel, nunca desde el cliente. Con timeout y AbortController —igual
// que el resto de los upstreams del proyecto— para no colgar nunca.
//
// OJO: es la fuente para la Opción A (dato confiable, puede diferir unos puntos
// del Bloomberg del cliente). El analista revisa antes de publicar. Para prod
// conviene una API con key (Twelve Data/FMP); el fetcher está aislado acá para
// cambiar de proveedor sin tocar el resto.

export type PuntoMercado = { fecha: string; close: number };

const HOST = "https://query2.finance.yahoo.com/v8/finance/chart";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36";

/** Serie diaria de cierres de un símbolo Yahoo (ej. "^GSPC", "BTC-USD", "EURUSD=X"). */
export async function serieDiaria(
  symbol: string,
  range = "3mo",
  timeoutMs = 8000,
): Promise<PuntoMercado[]> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const url = `${HOST}/${encodeURIComponent(symbol)}?range=${range}&interval=1d`;
    const res = await fetch(url, { headers: { "User-Agent": UA }, signal: ctrl.signal });
    if (!res.ok) throw new Error(`Yahoo ${symbol}: HTTP ${res.status}`);
    const j = (await res.json()) as {
      chart?: { result?: [{ timestamp?: number[]; indicators?: { quote?: [{ close?: (number | null)[] }] } }] };
    };
    const r = j?.chart?.result?.[0];
    const ts = r?.timestamp ?? [];
    const cl = r?.indicators?.quote?.[0]?.close ?? [];
    const out: PuntoMercado[] = [];
    for (let i = 0; i < ts.length; i++) {
      const c = cl[i];
      if (c == null || !Number.isFinite(c)) continue;
      out.push({ fecha: new Date(ts[i] * 1000).toISOString().slice(0, 10), close: c });
    }
    return out;
  } finally {
    clearTimeout(t);
  }
}

/** Cierre en `dia` o el día hábil inmediato anterior (hasta 5 días atrás). */
function cierreEnOAntes(map: Map<string, number>, dia: string, offsetDias = 0): number | null {
  const base = new Date(`${dia}T00:00:00Z`).getTime();
  for (let k = 0; k < 5; k++) {
    const key = new Date(base - (offsetDias + k) * 86_400_000).toISOString().slice(0, 10);
    const v = map.get(key);
    if (v != null) return v;
  }
  return null;
}

/**
 * Retorno % de la semana que cierra en `hasta` (viernes del informe): cierre de
 * `hasta` contra el cierre de 7 días antes. Devuelve null si falta algún dato.
 */
export function retornoSemanal(serie: PuntoMercado[], hasta: string): number | null {
  const map = new Map(serie.map((p) => [p.fecha, p.close]));
  const fin = cierreEnOAntes(map, hasta, 0);
  const ini = cierreEnOAntes(map, hasta, 7);
  if (fin == null || ini == null || ini === 0) return null;
  return (fin / ini - 1) * 100;
}

// ── Twelve Data (sólo para FX: Yahoo es poco fiable en pares exóticos) ────────
// Free tier alcanza de sobra (usamos ~6 pares por informe). Key en .env.local.

const TD_HOST = "https://api.twelvedata.com/time_series";

/**
 * Serie diaria de un símbolo Twelve Data (ej. "USD/COP") en una ventana de ~3
 * semanas alrededor de `hasta` — suficiente para el retorno semanal, y sirve
 * también para backfill de informes viejos (a diferencia de outputsize, que sólo
 * da los últimos días). Requiere TWELVEDATA_API_KEY.
 */
export async function serieDiariaTD(symbol: string, hasta: string, timeoutMs = 8000): Promise<PuntoMercado[]> {
  const key = process.env.TWELVEDATA_API_KEY;
  if (!key) throw new Error("Falta TWELVEDATA_API_KEY");
  const fin = new Date(`${hasta}T00:00:00Z`).getTime();
  const dia = (ms: number) => new Date(ms).toISOString().slice(0, 10);
  const url =
    `${TD_HOST}?symbol=${encodeURIComponent(symbol)}&interval=1day` +
    `&start_date=${dia(fin - 20 * 86_400_000)}&end_date=${dia(fin + 2 * 86_400_000)}&order=ASC&apikey=${key}`;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`TwelveData ${symbol}: HTTP ${res.status}`);
    const j = (await res.json()) as { status?: string; message?: string; values?: { datetime: string; close: string }[] };
    if (j.status !== "ok" || !Array.isArray(j.values)) throw new Error(`TwelveData ${symbol}: ${j.message ?? "sin datos"}`);
    return j.values
      .map((v) => ({ fecha: v.datetime, close: Number(v.close) }))
      .filter((p) => Number.isFinite(p.close));
  } finally {
    clearTimeout(t);
  }
}
