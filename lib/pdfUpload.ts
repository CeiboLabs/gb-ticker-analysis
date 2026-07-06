// Lectura y validación de un upload de PDF (multipart) en el edge, compartida
// por las rutas de informes y de documentos del fondo. Defensas, en orden:
// Content-Length temprano → multipart bien formado → tamaño real → magic bytes
// %PDF- (el Content-Type del cliente NO se mira: se miente gratis). La key de
// R2 la genera SIEMPRE el caller server-side; el filename del usuario ni se lee.

import { NextRequest, NextResponse } from "next/server";
import { checkFailedAuthLimit } from "@/lib/rateLimiter";

export const MAX_PDF_BYTES = 15 * 1024 * 1024; // 15 MB

const NO_STORE = { "Cache-Control": "no-store" };

// %PDF- en ASCII.
const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46, 0x2d];

// Tope de uploads por usuario por hora (contador durable en rate_limits, se
// consume en cada intento). Nadie legítimo sube 30 PDFs/hora.
const UPLOADS_HOURLY_MAX = 30;

export type PdfUpload =
  | { ok: true; buf: ArrayBuffer; size: number; form: FormData }
  | { ok: false; res: NextResponse };

export async function readPdfUpload(req: NextRequest, userId: number): Promise<PdfUpload> {
  const fail = (status: 400 | 413 | 415 | 429, error: string, extra?: Record<string, string>): PdfUpload => ({
    ok: false,
    res: NextResponse.json({ error }, { status, headers: { ...NO_STORE, ...(extra ?? {}) } }),
  });

  const gate = await checkFailedAuthLimit(`user-${userId}`, UPLOADS_HOURLY_MAX, "panelup");
  if (!gate.allowed) {
    return fail(429, "rate_limited", { "Retry-After": String(gate.retryAfter) });
  }

  // Rechazo temprano por header antes de leer el body (si el cliente lo manda).
  const declared = parseInt(req.headers.get("content-length") ?? "0", 10);
  if (Number.isFinite(declared) && declared > MAX_PDF_BYTES + 64 * 1024) {
    return fail(413, "muy_grande");
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return fail(400, "bad_request");
  }
  const file = form.get("archivo");
  if (!(file instanceof File)) {
    return fail(400, "falta_archivo");
  }
  if (file.size === 0 || file.size > MAX_PDF_BYTES) {
    return fail(413, "muy_grande");
  }

  const buf = await file.arrayBuffer();
  const head = new Uint8Array(buf.slice(0, PDF_MAGIC.length));
  const esPdf = PDF_MAGIC.every((b, i) => head[i] === b);
  if (!esPdf) {
    return fail(415, "no_es_pdf");
  }
  return { ok: true, buf, size: file.size, form };
}
