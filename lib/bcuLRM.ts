// LRM — tasas de corte de las Letras de Regulación Monetaria (BCU) para la tabla
// de renta fija de la página 1 del semanal. A diferencia de las cotizaciones, el
// BCU NO expone esto por API/SOAP; se investigó a fondo (2026-07-21: cotizaciones
// SOAP = sólo monedas; series estadísticas = tasas bancarias, no de subasta;
// Excel `LRM MN <año>.xls` congelado en 2018; carpeta SharePoint de resultados
// con listado 401 y PDFs por serie de 2004). La ÚNICA fuente viva y estructurada
// es el Excel **"Operaciones BCU y MEF local.xlsx"** (hoja "LRM"), linkeado desde
// la página de Instrumentos del BCU y actualizado a diario (datos 2019 → hoy).
// Reproduce EXACTO lo que publica el informe (validado vs 05-22: 34/84/161 días →
// 5,80 / 5,89 / 5,90 %).
//
// Server-only: se llama desde la ruta del panel. www.bcu.gub.uy sirve la cadena
// de certificados INCOMPLETA (manda sólo el leaf *.bcu.gub.uy, sin los
// intermedios) → Node no puede armarla y la verificación falla con
// UNABLE_TO_VERIFY_LEAF_SIGNATURE (el navegador la completa solo vía AIA fetching;
// Node no). NO se desactiva la verificación TLS: se le pasan los dos intermedios
// que faltan como `ca` y la validación queda ENCENDIDA (authorized:true).
// `xlsx` está en serverExternalPackages (no se bundlea).

import https from "node:https";
import tls from "node:tls";
import * as XLSX from "xlsx";

const XLSX_URL =
  "https://www.bcu.gub.uy/Politica-Economica-y-Mercados/Emisiones%20BCU/Operaciones%20BCU%20y%20MEF%20local.xlsx";

// Intermedios que el BCU NO manda en el handshake (leaf → Abitab SSL OV → Certum
// Global Services CA SHA2 → Certum Trusted Network CA, ésta última ya en el trust
// store de Node). Al pasarlos como `ca` la cadena se completa sin desactivar la
// verificación. VENCEN: Abitab 2027-05-02, Certum GS 2027-06-09 → si el fetch
// empieza a fallar con UNABLE_TO_GET_ISSUER_CERT, refrescar de
// http://repository.certum.pl/abitabov.cer y /gscasha2.cer (DER → PEM con openssl).
const BCU_INTERMEDIATES = [
  `-----BEGIN CERTIFICATE-----
MIIEwTCCA6mgAwIBAgIRAPDVlBXG3stPiI8oN+YGgQ8wDQYJKoZIhvcNAQELBQAw
gYMxCzAJBgNVBAYTAlBMMSIwIAYDVQQKExlVbml6ZXRvIFRlY2hub2xvZ2llcyBT
LkEuMScwJQYDVQQLEx5DZXJ0dW0gQ2VydGlmaWNhdGlvbiBBdXRob3JpdHkxJzAl
BgNVBAMTHkNlcnR1bSBHbG9iYWwgU2VydmljZXMgQ0EgU0hBMjAeFw0xODA4MjIw
NzEwNTlaFw0yNzA1MDIwNzEwNTlaMGMxCzAJBgNVBAYTAlVZMRQwEgYDVQQKDAtB
Yml0YWIgUy5BLjESMBAGA1UECwwJSURkaWdpdGFsMSowKAYDVQQDDCFBYml0YWIg
U1NMIE9yZ2FuaXphdGlvbiBWYWxpZGF0ZWQwggEiMA0GCSqGSIb3DQEBAQUAA4IB
DwAwggEKAoIBAQDRHpKZ1x9MN92GPEzBHOreEaFKQ970cb0DwzwZ9BIFvL39UnNp
CA88BKRI7xUsOso3IiNrikyYvXOdW8VOlYn4nR819ocdmFlDi4fsTUXhPy957jb7
m5HK+AQI5V0G+VQE3Z1KbuUJD5NCpAsWB9917LIQ5+n296wZrGxvKDaJZftxNgBM
UYlAWNnc88R/jFNVcKY3y4VJCEzLMx68K9p1fbV4mpCafXvEgzWzQlpW3/xkBicg
DwoFoL/fkUq89q3kLfJy9IoJJdfD7DtZ+NTe/sOLU64xpyqIkmH/F7zBuGQZ76TQ
rpCI0EWUOKzAk4RJINBE6xjLhdYS/XKTTiYZAgMBAAGjggFNMIIBSTASBgNVHRMB
Af8ECDAGAQH/AgEAMB0GA1UdDgQWBBSGC3U4ncuDuHEGDR9d6I7U6J6QZjAfBgNV
HSMEGDAWgBRUmd2b/+inDqMZnVu+QlffMPyPMjAOBgNVHQ8BAf8EBAMCAQYwOAYD
VR0fBDEwLzAtoCugKYYnaHR0cDovL3N1YmNhLmNybC5jZXJ0dW0ucGwvZ3NjYXNo
YTIuY3JsMG4GCCsGAQUFBwEBBGIwYDAoBggrBgEFBQcwAYYcaHR0cDovL3N1YmNh
Lm9jc3AtY2VydHVtLmNvbTA0BggrBgEFBQcwAoYoaHR0cDovL3JlcG9zaXRvcnku
Y2VydHVtLnBsL2dzY2FzaGEyLmNlcjA5BgNVHSAEMjAwMC4GBFUdIAAwJjAkBggr
BgEFBQcCARYYaHR0cDovL3d3dy5jZXJ0dW0ucGwvQ1BTMA0GCSqGSIb3DQEBCwUA
A4IBAQAiBThwLiKG2RvYPpph0ftYNFf7SaoVQJKWTmYGP7NkGpevtWQS9QkYKPtd
HAm9cPzKA/Las/WrwXin3zXzUUGuPttSSxCI4D9sRTX2RHAUSRBLrFXV/BCjtjlS
ehODXP2CXJsQtQ6SNvDaz4w8iSnrKhJyLgCIW/Q/u6dfkktQxEq+FJ4fWRC+Z8DY
1llk6g6FWBMuLVclLnUzQ0BplhJKUBLA7pd86VsJZStGWcRtW9iaMwsn4QnnLZ0B
h2wLKEzze5KwoLPuY2tm0SHWubPO11HJhoMJ6k+QgJG1XObTBLofuJC1/NpHy72z
xrAnpFWbSDnEYkhrXDMGxTSDdkAv
-----END CERTIFICATE-----`,
  `-----BEGIN CERTIFICATE-----
MIIEzTCCA7WgAwIBAgIRANBLb+XdW9Ih58dM9kaLMUYwDQYJKoZIhvcNAQELBQAw
fjELMAkGA1UEBhMCUEwxIjAgBgNVBAoTGVVuaXpldG8gVGVjaG5vbG9naWVzIFMu
QS4xJzAlBgNVBAsTHkNlcnR1bSBDZXJ0aWZpY2F0aW9uIEF1dGhvcml0eTEiMCAG
A1UEAxMZQ2VydHVtIFRydXN0ZWQgTmV0d29yayBDQTAeFw0xNDA5MTExMjAwMDBa
Fw0yNzA2MDkxMDQ2MzlaMIGDMQswCQYDVQQGEwJQTDEiMCAGA1UEChMZVW5pemV0
byBUZWNobm9sb2dpZXMgUy5BLjEnMCUGA1UECxMeQ2VydHVtIENlcnRpZmljYXRp
b24gQXV0aG9yaXR5MScwJQYDVQQDEx5DZXJ0dW0gR2xvYmFsIFNlcnZpY2VzIENB
IFNIQTIwggEiMA0GCSqGSIb3DQEBAQUAA4IBDwAwggEKAoIBAQDHhvLXeA4kyBVY
Dr12JusjW+/HPPWpBmWnSZC9gadbNXCD/GlHrGruRWrKn0YBasbonXi5FLRon717
aCCDt2+7URnJx4mLGt3X73yH3I+T+COuyTFOuLId68jYV4vfBm1N/N1/KohGr8+R
7eT4f4agfXVQ+gDZT3pGTywqc9IId4uHaFjW+mr5vVfu7WjL8A20jOawvlqV2K4/
qSrjPZsqHlzf46LHgbQEK1EjTPsFrfvAQxvGpHiEIAFsS+1d2xPIEJVIxvq+KyGb
W/0SJIj7/SfYo+ItvJ2a4/G2JfoPF9wTCC0N8U5I/KXxjYYXBcIE9pQ16T24T+dr
MfPG2mYtAgMBAAGjggE+MIIBOjAPBgNVHRMBAf8EBTADAQH/MB0GA1UdDgQWBBRU
md2b/+inDqMZnVu+QlffMPyPMjAfBgNVHSMEGDAWgBQIds3LB/8k9sXN7buQvOKE
N0Z19zAOBgNVHQ8BAf8EBAMCAQYwLwYDVR0fBCgwJjAkoCKgIIYeaHR0cDovL2Ny
bC5jZXJ0dW0ucGwvY3RuY2EuY3JsMGsGCCsGAQUFBwEBBF8wXTAoBggrBgEFBQcw
AYYcaHR0cDovL3N1YmNhLm9jc3AtY2VydHVtLmNvbTAxBggrBgEFBQcwAoYlaHR0
cDovL3JlcG9zaXRvcnkuY2VydHVtLnBsL2N0bmNhLmNlcjA5BgNVHSAEMjAwMC4G
BFUdIAAwJjAkBggrBgEFBQcCARYYaHR0cDovL3d3dy5jZXJ0dW0ucGwvQ1BTMA0G
CSqGSIb3DQEBCwUAA4IBAQDRhC+yVHfF/IFcNNKbkxX1aVsCZ0fa2t+MxyFcs7KO
qW1fGpOOycughOFnbM+lz4Y3gt5RaOFJTm7YVUZZ3751s5tv8nhXeXfrRIpQN7Cu
+Nei457HlDxEUItPlkYnDbdDes/96T19cICd1TmIPekYRXiyuPW4Wgx6vykmk91x
LkJ0y74TzVtUofVF446qXvea95zNpzYCVMg+AOX3ZZyy9XfST6g4um+cw/Idv31d
bnJdBzMOgHH3uw2YMiZQgDqvNRE+wAs+PTFEIKHmBc/t1n3Shvg9e68M+5ZRM8bE
WGqgLqfreTgCsCQcv9MDYw9TFUbS17RdE6NtiPfszTky
-----END CERTIFICATE-----`,
];

// Columnas 0-based de la hoja "LRM" (encabezado en la fila 10): Fecha=0, Plazo=4,
// Vencimiento=6, "Tasa de corte"=26 (fracción: 0.058 = 5,8 %).
const COL = { fecha: 0, plazo: 4, vto: 6, tasaCorte: 26 } as const;

export type SubastaLRM = { fecha: string; plazo: number; vto: string; tasa: number };

// Serial de fecha de Excel (sistema 1900) → ISO YYYY-MM-DD, DETERMINISTA y sin
// timezone (25569 = días entre la época de Excel 1899-12-30 y 1970-01-01). Se lee
// el serial crudo en vez de un Date con cellDates: SheetJS arma el Date a
// medianoche LOCAL, y comparar ese instante contra una medianoche UTC dejaba
// afuera las subastas del propio viernes (su 00:00 local cae después del 00:00Z).
export const serialToISO = (serial: number): string =>
  new Date(Math.round((serial - 25569) * 86_400_000)).toISOString().slice(0, 10);

/** Descarga el xlsx del BCU con verificación TLS completa (intermedios como ca). */
function descargarXlsx(timeoutMs = 15000): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const req = https.get(
      XLSX_URL,
      {
        ca: [...tls.rootCertificates, ...BCU_INTERMEDIATES],
        headers: { "User-Agent": "Mozilla/5.0 (informes-bot)" },
      },
      (res) => {
        if (res.statusCode !== 200) {
          res.resume();
          reject(new Error(`BCU xlsx: HTTP ${res.statusCode}`));
          return;
        }
        const chunks: Buffer[] = [];
        res.on("data", (c: Buffer) => chunks.push(c));
        res.on("end", () => resolve(Buffer.concat(chunks)));
        res.on("error", reject);
      },
    );
    req.on("error", reject);
    req.setTimeout(timeoutMs, () => req.destroy(new Error("BCU xlsx: timeout")));
  });
}

/**
 * Vuelca la hoja "LRM" a filas crudas. El Excel declara el rango de TODA la hoja
 * (~1 M de filas) → se recorta al rango real antes de volcar, si no `sheet_to_json`
 * escanea el millón de filas vacías (9 s vs 5 ms).
 */
function filasLRM(buf: Buffer): unknown[][] {
  // Sin cellDates: las fechas quedan como serial crudo (number) → conversión
  // determinista con serialToISO (ver comentario arriba).
  const wb = XLSX.read(buf, { type: "buffer", sheets: ["LRM"] });
  const ws = wb.Sheets["LRM"];
  if (!ws) return [];
  let maxR = 0;
  for (const k of Object.keys(ws)) {
    if (k[0] === "!") continue;
    const r = XLSX.utils.decode_cell(k).r;
    if (r > maxR) maxR = r;
  }
  ws["!ref"] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: maxR, c: 29 } });
  return XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, blankrows: false }) as unknown[][];
}

// Cache del volcado: el Excel se actualiza a diario, TTL 30 min evita re-bajar
// 3,7 MB en cada clic del panel (y es cortés con el BCU).
let cache: { ts: number; filas: unknown[][] } | null = null;
const TTL_MS = 30 * 60_000;

async function leerFilas(): Promise<unknown[][]> {
  if (cache && Date.now() - cache.ts < TTL_MS) return cache.filas;
  const filas = filasLRM(await descargarXlsx());
  cache = { ts: Date.now(), filas };
  return filas;
}

/**
 * Subastas de LRM con Fecha dentro de la semana (7 días) que cierra en `hasta`,
 * ordenadas por plazo. Vacío si el BCU no responde o no hubo subastas esa semana.
 */
/**
 * Filtra las subastas de la semana (7 días que cierran en `hasta`, viernes) de las
 * filas crudas de la hoja "LRM", ordenadas por plazo. Pura → testeable sin red.
 */
export function filtrarSubastasLRM(filas: unknown[][], hasta: string): SubastaLRM[] {
  const finMs = Date.parse(`${hasta}T00:00:00Z`);
  const iniISO = new Date(finMs - 6 * 86_400_000).toISOString().slice(0, 10); // lunes de la semana
  const out: SubastaLRM[] = [];
  for (const fila of filas) {
    const f = fila[COL.fecha];
    const tasa = fila[COL.tasaCorte];
    const plazo = fila[COL.plazo];
    if (typeof f !== "number" || typeof tasa !== "number" || typeof plazo !== "number") continue;
    const fecha = serialToISO(f);
    if (fecha < iniISO || fecha > hasta) continue; // comparación por fecha-calendario
    const vto = fila[COL.vto];
    out.push({ fecha, plazo, vto: typeof vto === "number" ? serialToISO(vto) : "", tasa: Number((tasa * 100).toFixed(2)) });
  }
  out.sort((a, b) => a.plazo - b.plazo);
  return out;
}

export async function subastasLRMSemana(hasta: string): Promise<SubastaLRM[]> {
  return filtrarSubastasLRM(await leerFilas(), hasta);
}
