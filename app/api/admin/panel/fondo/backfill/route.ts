// Backfill del histórico del fondo por CSV pegado ('dia,nav[,aum[,nota]]' por
// línea, decimal con punto). Valida el lote entero con validateBatch (orden,
// duplicados internos, banda día-a-día encadenada contra el último cierre ya
// publicado) y reporta por fila. Si el rango pisa cierres existentes, exige
// confirmación expresa (sobrescribir: true) — el UPSERT no es inocente.

import { NextRequest, NextResponse } from "next/server";
import { requirePanelSession } from "@/lib/panelAuth";
import { validateBatch, isRealDate, type RawNavInput } from "@/lib/fondoIngest";
import { getPrevNav, upsertNavStmt, auditStmt } from "@/lib/fondoStore";
import { panelAuditStmt } from "@/lib/panelStore";
import { BackfillSchema } from "@/lib/panelSchemas";
import { eventBaseFromRequest, type D1PreparedStatement } from "@/lib/metrics";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };
const MAX_FILAS = 400;
const BATCH_CHUNK = 50;

function parseCsv(csv: string): { rows: RawNavInput[]; ignoradas: number } {
  const rows: RawNavInput[] = [];
  let ignoradas = 0;
  for (const raw of csv.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const parts = line.split(",");
    if (parts.length < 2) {
      ignoradas++;
      continue;
    }
    const [dia, nav, aum, ...resto] = parts.map((s) => s.trim());
    rows.push({
      dia,
      nav,
      aum: aum === "" || aum === undefined ? null : aum,
      nota: resto.length ? resto.join(",") : undefined,
    });
  }
  return { rows, ignoradas };
}

export async function POST(req: NextRequest) {
  const gate = await requirePanelSession(req, "fondo");
  if (!gate.ok) return gate.res;
  const { db, user } = gate;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400, headers: NO_STORE });
  }
  const parsed = BackfillSchema.safeParse(body);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Datos inválidos";
    return NextResponse.json({ error: "bad_request", detalle: msg }, { status: 400, headers: NO_STORE });
  }
  const { rows, ignoradas } = parseCsv(parsed.data.csv);
  if (rows.length === 0) {
    return NextResponse.json(
      { error: "bad_request", detalle: "No hay filas parseables (formato: dia,nav[,aum[,nota]])." },
      { status: 400, headers: NO_STORE },
    );
  }
  if (rows.length > MAX_FILAS) {
    return NextResponse.json(
      { error: "bad_request", detalle: `El lote supera las ${MAX_FILAS} filas — partilo.` },
      { status: 400, headers: NO_STORE },
    );
  }
  const nowMs = Date.now();
  const ipHash = eventBaseFromRequest(req).ipHash;

  // Rango del lote (sólo fechas con forma real) para el prior y el guard de pisada.
  const dias = rows.map((r) => r.dia).filter((d): d is string => isRealDate(d)).sort();
  const minDia = dias[0] ?? null;
  const maxDia = dias[dias.length - 1] ?? null;

  if (minDia && maxDia) {
    const existentes = await db
      .prepare("SELECT COUNT(*) AS n FROM fund_nav WHERE status = 'live' AND dia >= ? AND dia <= ?")
      .bind(minDia, maxDia)
      .first<{ n: number }>();
    const n = Number(existentes?.n ?? 0);
    if (n > 0 && !parsed.data.sobrescribir) {
      return NextResponse.json(
        {
          error: "existentes",
          detalle: `El rango ${minDia}..${maxDia} ya tiene ${n} cierre(s) publicados. Reenviá con sobrescribir=true si de verdad querés pisarlos.`,
          existentes: n,
        },
        { status: 409, headers: NO_STORE },
      );
    }
  }

  const priorRow = minDia ? await getPrevNav(db, minDia) : null;
  const result = validateBatch(rows, { priorRow, nowMs });

  if (result.accepted.length > 0) {
    // UPSERT + una entrada de fund_audit por fila aceptada + resumen en la
    // auditoría del panel, en batches acotados (D1 no ama los batches de 800).
    const stmts: D1PreparedStatement[] = [];
    for (const value of result.accepted) {
      stmts.push(upsertNavStmt(db, value, { source: "backfill", nowMs }));
      stmts.push(
        auditStmt(db, {
          actor: "backfill", channel: "http", action: "backfill", decision: "accepted", reason: "ok",
          targetDia: value.dia, parsedNav: value.nav, parsedAum: value.aum, ipHash, nowMs,
        }),
      );
    }
    stmts.push(
      panelAuditStmt(db, {
        actorId: user.id, actorEmail: user.email, ipHash, section: "fondo", action: "backfill",
        target: `${minDia}..${maxDia}`, decision: "ok",
        detail: { aceptadas: result.accepted.length, rechazadas: result.results.length - result.accepted.length, ignoradas },
        nowMs,
      }),
    );
    for (let i = 0; i < stmts.length; i += BATCH_CHUNK) {
      await db.batch(stmts.slice(i, i + BATCH_CHUNK));
    }
  } else {
    await panelAuditStmt(db, {
      actorId: user.id, actorEmail: user.email, ipHash, section: "fondo", action: "backfill",
      target: minDia && maxDia ? `${minDia}..${maxDia}` : "(sin fechas)", decision: "rejected",
      detail: { rechazadas: result.results.length, ignoradas }, nowMs,
    }).run();
  }

  return NextResponse.json(
    {
      ok: result.ok,
      resumen: {
        aceptadas: result.accepted.length,
        rechazadas: result.results.filter((r) => !r.ok).length,
        ignoradas,
      },
      resultados: result.results,
    },
    { headers: NO_STORE },
  );
}
