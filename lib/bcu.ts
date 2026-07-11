// BCU — cotizaciones (dólar y Unidad Indexada) vía su web service SOAP (GeneXus).
// Server-only: se llama desde la ruta del panel. Con timeout/AbortController.
// El dólar del BCU da EXACTO lo que publica el informe (fixing local); Yahoo sólo
// aproximaba. La UI (que Yahoo no tiene) sale de acá también → el gráfico
// "UI vs USD base=100" de la página 1 se autocompleta.
//
// Grupo 2 = monedas/unidades "arbitraje". Códigos: 2225 = DLS. USA BILLETE,
// 9800 = UNIDAD INDEXADA (descubiertos por el servicio awsbcumonedas).
// OJO: el servicio corta los rangos largos (~6 meses ok, 2 años devuelve vacío) →
// serieBCU fragmenta el pedido en tramos y concatena.

import type { PuntoMercado } from "./marketData";

const BCU_URL = "https://cotizaciones.bcu.gub.uy/wscotizaciones/servlet/awsbcucotizaciones";

/** Códigos de moneda/unidad del BCU (grupo 2). */
export const BCU_COD = { DOLAR: 2225, UI: 9800 } as const;

const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** Un tramo (una sola llamada SOAP). Cierre = TCV (tipo de cambio vendedor). */
async function tramoBCU(codigo: number, desde: string, hasta: string, timeoutMs: number): Promise<PuntoMercado[]> {
  const body =
    `<?xml version="1.0" encoding="utf-8"?>` +
    `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:cot="Cotiza"><soapenv:Body>` +
    `<cot:wsbcucotizaciones.Execute><cot:Entrada>` +
    `<cot:Moneda><cot:item>${codigo}</cot:item></cot:Moneda>` +
    `<cot:FechaDesde>${desde}</cot:FechaDesde><cot:FechaHasta>${hasta}</cot:FechaHasta><cot:Grupo>2</cot:Grupo>` +
    `</cot:Entrada></cot:wsbcucotizaciones.Execute></soapenv:Body></soapenv:Envelope>`;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(BCU_URL, {
      method: "POST",
      headers: { "Content-Type": "text/xml; charset=utf-8", SOAPAction: '"Cotizaaction/AWSBCUCOTIZACIONES.Execute"' },
      body,
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`BCU ${codigo}: HTTP ${res.status}`);
    const xml = await res.text();
    // Parseo por zip Fecha↔TCV: cada `dato` trae una de cada, en orden.
    const fechas = [...xml.matchAll(/<Fecha>([^<]+)<\/Fecha>/g)].map((m) => m[1]);
    const tcvs = [...xml.matchAll(/<TCV>([^<]+)<\/TCV>/g)].map((m) => Number(m[1]));
    const out: PuntoMercado[] = [];
    for (let i = 0; i < Math.min(fechas.length, tcvs.length); i++) {
      if (Number.isFinite(tcvs[i]) && tcvs[i] > 0) out.push({ fecha: fechas[i], close: tcvs[i] });
    }
    return out;
  } finally {
    clearTimeout(t);
  }
}

/**
 * Serie diaria (días hábiles) de un código del BCU entre dos fechas, fragmentando
 * en tramos de ~5 meses (el servicio corta rangos largos). Deduplica y ordena.
 */
export async function serieBCU(codigo: number, desde: string, hasta: string, timeoutMs = 12000): Promise<PuntoMercado[]> {
  const fin = new Date(`${hasta}T00:00:00Z`).getTime();
  const STEP = 150 * 86_400_000; // ~5 meses
  const seen = new Set<string>();
  const out: PuntoMercado[] = [];
  let ini = new Date(`${desde}T00:00:00Z`).getTime();
  while (ini <= fin) {
    const tramoFin = Math.min(ini + STEP, fin);
    const pts = await tramoBCU(codigo, iso(ini), iso(tramoFin), timeoutMs).catch(() => [] as PuntoMercado[]);
    for (const p of pts) {
      if (!seen.has(p.fecha)) {
        seen.add(p.fecha);
        out.push(p);
      }
    }
    ini = tramoFin + 86_400_000;
  }
  out.sort((a, b) => a.fecha.localeCompare(b.fecha));
  return out;
}
