// Publicación de los datos del fondo al hosting cPanel.
//
// GET  → ¿hay cambios sin publicar? + cuándo/quién publicó la última vez.
// POST → publica: sube fondo.json, documentos.json y los PDFs que cambiaron.
//
// LO QUE VIAJA SON LOS BYTES EXACTOS DE /api/fondo
// El cuerpo lo produce `respuestaFondo()` — el MISMO código que sirve la ruta
// pública y que corría en el worker de Cloudflare. No hay un serializador
// paralelo que pueda divergir: es la misma función con otra base abajo.
//
// POR QUÉ LA AUDITORÍA SE ESCRIBE PASE O FALLE
// Una publicación fallida es información operativa: si el hosting rechaza la
// firma o no responde, eso tiene que quedar en `admin_audit` para poder mirarlo
// después. Un registro que sólo guarda los éxitos no sirve para diagnosticar.

import { NextRequest, NextResponse } from "next/server";
import { requirePanelSession } from "@/lib/panelAuth";
import { respuestaFondo, respuestaDocumentos } from "@/lib/fondoApi";
import { listDocsLive } from "@/lib/fondoDocsStore";
import { readConfig, readConfigMeta, upsertConfigStmt } from "@/lib/fondoStore";
import { panelAuditStmt } from "@/lib/panelStore";
import { getDocsBucket, type D1Database } from "@/lib/metrics";
import {
  artefactoDoc,
  cabecerasPublicacion,
  docsASubir,
  huellaDoc,
  huellaEstado,
  parseRegistro,
  type Artefacto,
  type EstadoPublicable,
  type RegistroPublicacion,
} from "@/lib/fondoPublicar";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };
const CLAVE = "publicado";

/** Tope de espera del hosting. Un cPanel compartido puede tardar; 20 s es de sobra. */
const TIMEOUT_MS = 20_000;

type Config = { url: string; secreto: string };

/**
 * Config del publicador. Fail-closed: sin URL o sin secreto NO se intenta nada
 * — un publicador a medio configurar que "casi" funciona es peor que uno que
 * dice claramente que le falta el env.
 */
function config(): Config | null {
  const url = (process.env.FONDO_PUBLISH_URL ?? "").trim();
  const secreto = (process.env.FONDO_PUBLISH_SECRET ?? "").trim();
  if (!url.startsWith("https://") || secreto.length < 32) return null;
  return { url, secreto };
}

/** Junta todo lo publicable leyendo por los MISMOS caminos que el sitio público. */
async function estadoPublicable(db: D1Database): Promise<{ estado: EstadoPublicable; huella: string }> {
  const [resFondo, resDocs, filas] = await Promise.all([
    respuestaFondo(db),
    respuestaDocumentos(db),
    listDocsLive(db),
  ]);
  const estado: EstadoPublicable = {
    fondo: await resFondo.text(),
    documentos: await resDocs.text(),
    docs: Object.fromEntries(filas.map((d) => [d.tipo, huellaDoc(d.tipo, d.content_len, d.updated_at)])),
  };
  return { estado, huella: await huellaEstado(estado) };
}

async function registroActual(db: D1Database): Promise<RegistroPublicacion | null> {
  const raw = await readConfig(db, CLAVE);
  return raw === null ? null : parseRegistro(raw);
}

export async function GET(req: NextRequest) {
  const gate = await requirePanelSession(req, "fondo");
  if (!gate.ok) return gate.res;
  const { db } = gate;

  const [{ huella }, registro, meta] = await Promise.all([
    estadoPublicable(db),
    registroActual(db),
    readConfigMeta(db, CLAVE),
  ]);

  return NextResponse.json(
    {
      configurado: config() !== null,
      // Nunca publicado ⇒ pendiente, aunque no se haya tocado nada: el hosting
      // todavía no tiene el archivo.
      pendiente: registro === null || registro.huella !== huella,
      version: registro?.version ?? 0,
      ultima: meta,
    },
    { headers: NO_STORE },
  );
}

export async function POST(req: NextRequest) {
  const gate = await requirePanelSession(req, "fondo");
  if (!gate.ok) return gate.res;
  const { db, user } = gate;

  const cfg = config();
  if (!cfg) {
    return NextResponse.json(
      { error: "config", detalle: "Faltan FONDO_PUBLISH_URL / FONDO_PUBLISH_SECRET en el server." },
      { status: 503, headers: NO_STORE },
    );
  }

  const nowMs = Date.now();
  const { estado, huella } = await estadoPublicable(db);
  const registro = await registroActual(db);

  // Qué se manda. El JSON siempre (es chico y es el que importa); los PDFs sólo
  // si cambiaron — un factsheet de 12 MB no tiene por qué viajar porque se
  // cargó el valor cuota del día.
  const pdfs = docsASubir(estado.docs, registro?.docs ?? {});
  const subidos: string[] = [];

  const enviar = async (art: Artefacto, cuerpo: Uint8Array): Promise<string | null> => {
    const ts = Math.floor(Date.now() / 1000);
    const ctl = new AbortController();
    const reloj = setTimeout(() => ctl.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(cfg.url, {
        method: "POST",
        headers: await cabecerasPublicacion(cfg.secreto, art, cuerpo, ts),
        body: cuerpo as BodyInit,
        signal: ctl.signal,
      });
      if (res.ok) return null;
      const cuerpoErr = await res.text().catch(() => "");
      return `${art}: HTTP ${res.status} ${cuerpoErr.slice(0, 120)}`;
    } catch (e) {
      return `${art}: ${e instanceof Error ? e.message : "sin respuesta"}`;
    } finally {
      clearTimeout(reloj);
    }
  };

  const te = new TextEncoder();
  const fallos: string[] = [];

  // Los PDFs PRIMERO, y el JSON después. El orden importa: `documentos.json` es
  // el índice que la página usa para ofrecer las descargas, así que publicarlo
  // antes que los archivos dejaría, por unos segundos, links a PDFs que todavía
  // no llegaron. Al revés no hay ventana mala — un PDF que nadie referencia
  // todavía no molesta a nadie.
  const bucket = getDocsBucket();
  for (const tipo of pdfs) {
    if (!bucket) {
      fallos.push(`doc:${tipo}: sin bucket de documentos en este server`);
      continue;
    }
    const fila = await db
      .prepare("SELECT r2_key FROM fondo_documentos WHERE tipo = ? AND status = 'live'")
      .bind(tipo)
      .first<{ r2_key: string }>();
    const obj = fila ? await bucket.get(fila.r2_key) : null;
    if (!obj) {
      fallos.push(`doc:${tipo}: el archivo no está en el bucket`);
      continue;
    }
    const err = await enviar(artefactoDoc(tipo), new Uint8Array(await obj.arrayBuffer()));
    if (err) fallos.push(err);
    else subidos.push(tipo);
  }

  // ⚠️ SI UN PDF FALLÓ, `documentos.json` NO SE MANDA. Poner los PDFs primero
  // no alcanza: si uno no llegó y el índice sí, la página ofrece una descarga
  // que da 404 — y para el visitante eso es peor que no ofrecerla, porque el
  // documento figura como publicado. Sin índice nuevo, el sitio sigue mostrando
  // el anterior (o los PDFs que viajan en el deploy), que es un estado
  // consistente. `fondo.json` sí viaja igual: no referencia archivos.
  const pdfsOk = fallos.length === 0;
  const aMandar: Array<readonly [Artefacto, string]> = pdfsOk
    ? [
        ["documentos", estado.documentos],
        ["fondo", estado.fondo],
      ]
    : [["fondo", estado.fondo]];

  for (const [art, texto] of aMandar) {
    const err = await enviar(art, te.encode(texto));
    if (err) fallos.push(err);
  }
  if (!pdfsOk) {
    fallos.push("documentos.json NO se publicó, para no dejar descargas rotas");
  }

  const ok = fallos.length === 0;

  // El registro se guarda SÓLO si salió todo. Si algo falló, la huella vieja
  // queda en pie y el panel sigue diciendo "hay cambios sin publicar", que es
  // la verdad. Guardar un éxito parcial dejaría el panel mintiendo.
  const stmts = [
    panelAuditStmt(db, {
      actorId: user.id,
      actorEmail: user.email,
      section: "fondo",
      action: "publicar",
      decision: ok ? "ok" : "error",
      detail: { version: (registro?.version ?? 0) + (ok ? 1 : 0), pdfs: subidos, fallos },
      nowMs,
    }),
  ];
  if (ok) {
    const nuevo: RegistroPublicacion = {
      version: (registro?.version ?? 0) + 1,
      huella,
      docs: estado.docs,
    };
    stmts.unshift(upsertConfigStmt(db, CLAVE, JSON.stringify(nuevo), user.email, nowMs));
  }
  await db.batch(stmts);

  if (!ok) {
    return NextResponse.json(
      { error: "publicacion", detalle: fallos.join(" · ") },
      { status: 502, headers: NO_STORE },
    );
  }
  return NextResponse.json(
    { ok: true, version: (registro?.version ?? 0) + 1, pdfs: subidos },
    { headers: NO_STORE },
  );
}
