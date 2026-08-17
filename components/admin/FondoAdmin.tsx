"use client";

// Operación del fondo BNG Selección Global: estado de la serie, carga del
// cierre diario (validación de bandas server-side), backfill por CSV,
// corrección con motivo, snapshot de tenencias y documentos regulatorios.

import { useCallback, useEffect, useState } from "react";
import { panelFetch, errorMessage, Btn, Card, Input, Label, Notice, Badge, PageHeader, Select, Stat, StatGrid } from "@/components/admin/ui";
import { fmtTs } from "@/components/admin/format";

type Tab = "estado" | "cuota" | "backfill" | "corregir" | "tenencias" | "geografia" | "documentos" | "publicar";

const TABS: Array<{ key: Tab; label: string }> = [
  { key: "estado", label: "Estado" },
  { key: "cuota", label: "Valor cuota" },
  { key: "backfill", label: "Backfill" },
  { key: "corregir", label: "Corregir" },
  { key: "tenencias", label: "Tenencias" },
  // Va pegada a Tenencias porque son los dos bloques de composición de la
  // página, aunque no sean el mismo tipo de dato: uno es la cartera a una
  // fecha, el otro el objetivo del mandato (ver TabGeografia).
  { key: "geografia", label: "Geografía" },
  { key: "documentos", label: "Documentos" },
  { key: "publicar", label: "Publicar" },
];

export default function FondoAdmin() {
  const [tab, setTab] = useState<Tab>("estado");

  // Cualquier pestaña que guarde algo incrementa esto, y el aviso de arriba
  // revalida. El callback se pasa explícito a cada pestaña que muta en vez de
  // resolverlo con un canal global: son seis líneas, y a cambio se ve en el
  // código quién puede dejar cambios sin publicar.
  const [rev, setRev] = useState(0);
  const cambio = useCallback(() => setRev((r) => r + 1), []);

  return (
    <div>
      <PageHeader
        eyebrow="Panel · Fondo"
        title="Fondo BNG Selección Global"
        dek="Los datos cargados acá pasan por la misma validación que la ingesta por mail y quedan auditados. Guardar no publica: el sitio se actualiza desde la pestaña Publicar."
      />
      <AvisoPublicacion rev={rev} irAPublicar={() => setTab("publicar")} />
      <nav className="adm-tabs mb-5" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className="adm-tab"
          >
            {t.label}
          </button>
        ))}
      </nav>
      {tab === "estado" && <TabEstado />}
      {tab === "cuota" && <TabCuota onCambio={cambio} />}
      {tab === "backfill" && <TabBackfill onCambio={cambio} />}
      {tab === "corregir" && <TabCorregir onCambio={cambio} />}
      {tab === "tenencias" && <TabTenencias onCambio={cambio} />}
      {tab === "geografia" && <TabGeografia onCambio={cambio} />}
      {tab === "documentos" && <TabDocumentos onCambio={cambio} />}
      {tab === "publicar" && <TabPublicar rev={rev} onPublicado={cambio} />}
    </div>
  );
}

// ── Aviso de cambios sin publicar ────────────────────────────────────────────

// EL MODO DE FALLA QUE ESTE AVISO EXISTE PARA EVITAR: Adrián guarda, se va, y
// nadie se entera de que el sitio no se movió. Con el puente viejo (worker + D1
// leídos en vivo) guardar SÍ publicaba; ahora no, y esa diferencia es
// invisible salvo que se diga. Por eso el aviso va arriba de las pestañas y no
// adentro de la de Publicar, que es justo la que no se está mirando.

type EstadoPublicacion = {
  configurado: boolean;
  pendiente: boolean;
  version: number;
  ultima: { updatedAt: number; updatedBy: string | null } | null;
};

function usePublicacion(rev: number) {
  const [estado, setEstado] = useState<EstadoPublicacion | null>(null);
  useEffect(() => {
    let vivo = true;
    queueMicrotask(() => {
      void (async () => {
        const r = await panelFetch<EstadoPublicacion>("/api/admin/panel/fondo/publicar");
        if (vivo && r.status === 200 && r.data) setEstado(r.data as unknown as EstadoPublicacion);
      })();
    });
    return () => {
      vivo = false;
    };
  }, [rev]);
  return estado;
}

function AvisoPublicacion({ rev, irAPublicar }: { rev: number; irAPublicar: () => void }) {
  const estado = usePublicacion(rev);
  if (!estado?.pendiente) return null;
  return (
    <div className="mb-5">
      <Notice kind="info">
        Hay cambios guardados que <strong>todavía no están en el sitio</strong>.{" "}
        <button type="button" onClick={irAPublicar} className="underline underline-offset-2">
          Ir a Publicar
        </button>
      </Notice>
    </div>
  );
}

// ── Publicar ─────────────────────────────────────────────────────────────────

function TabPublicar({ rev, onPublicado }: { rev: number; onPublicado: () => void }) {
  const estado = usePublicacion(rev);
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function publicar() {
    if (busy) return;
    setBusy(true);
    setMsg(null);
    const r = await panelFetch<{ version: number; pdfs: string[] }>("/api/admin/panel/fondo/publicar", {
      method: "POST",
    });
    setBusy(false);
    if (r.status === 200 && r.data) {
      const pdfs = r.data.pdfs ?? [];
      setMsg({
        kind: "ok",
        text: `Publicado en el sitio (versión ${r.data.version})${pdfs.length ? ` · ${pdfs.length} PDF actualizado(s)` : ""}.`,
      });
    } else {
      setMsg({ kind: "error", text: errorMessage(r) });
    }
    onPublicado();
  }

  return (
    <Card title="Publicar en el sitio">
      <p className="adm-dek mb-4">
        Manda al hosting el valor cuota, las tenencias, la exposición geográfica y los documentos tal
        como están guardados. Los PDF sólo viajan si cambiaron.
      </p>

      {estado && !estado.configurado && (
        <Notice kind="error">
          El publicador no está configurado en este server (faltan <code>FONDO_PUBLISH_URL</code> y{" "}
          <code>FONDO_PUBLISH_SECRET</code>). Ver docs/RUNBOOK-panel.md.
        </Notice>
      )}

      {estado && (
        <StatGrid>
          <Stat
            k="Estado"
            v={estado.pendiente ? "Cambios sin publicar" : "Al día"}
            tone={estado.pendiente ? "neg" : "pos"}
          />
          <Stat k="Versión publicada" v={estado.version === 0 ? "—" : String(estado.version)} />
          <Stat
            k="Última publicación"
            v={estado.ultima ? fmtTs(estado.ultima.updatedAt) : "Nunca"}
            s={estado.ultima?.updatedBy ?? undefined}
          />
        </StatGrid>
      )}

      {msg && (
        <div className="mt-4">
          <Notice kind={msg.kind}>{msg.text}</Notice>
        </div>
      )}

      <div className="mt-4">
        {/* Se deja apretar aunque no haya cambios: republicar es idempotente y
            es la única salida cuando el archivo del hosting se perdió o quedó
            a medias por algo de afuera. */}
        <Btn onClick={publicar} disabled={busy || estado?.configurado === false}>
          {busy ? "Publicando…" : estado?.pendiente ? "Publicar cambios" : "Volver a publicar"}
        </Btn>
      </div>
    </Card>
  );
}

// ── Estado ───────────────────────────────────────────────────────────────────

type Estado = {
  ultimoCierre: { dia: string; nav: number; aum: number | null } | null;
  totalCierres: number;
  diasHabilesSinCierre: number | null;
  ultimos: Array<{ dia: string; nav: number; aum: number | null; source: string | null }>;
  rechazos: Array<{ ts: number; action: string; reason: string | null; target_dia: string | null; parsed_nav: number | null }>;
  tenencias: { as_of: string; items: number } | null;
};

function TabEstado() {
  const [estado, setEstado] = useState<Estado | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const r = await panelFetch<Estado>("/api/admin/panel/fondo/status");
      if (r.status === 200 && r.data) setEstado(r.data as unknown as Estado);
      else setError(errorMessage(r));
    })();
  }, []);

  if (error) return <Notice kind="error">{error}</Notice>;
  if (!estado) return <p className="adm-help mt-0!">Cargando…</p>;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card title="Serie del valor cuota">
        {estado.ultimoCierre ? (
          <div className="text-sm">
            <p>
              Último cierre: <strong className="mono num">{estado.ultimoCierre.dia}</strong> · cuota{" "}
              <span className="mono num">{Number(estado.ultimoCierre.nav).toFixed(4)}</span>
              {estado.ultimoCierre.aum != null && <> · AUM <span className="mono num">{Number(estado.ultimoCierre.aum).toLocaleString("es-UY")}</span></>}
            </p>
            <p className="adm-help">
              <span className="mono num">{estado.totalCierres}</span> cierres publicados
              {estado.diasHabilesSinCierre != null && estado.diasHabilesSinCierre > 0 && (
                <span className="ml-2 text-[color:var(--gold-deep)]">⚠ {estado.diasHabilesSinCierre} día(s) hábil(es) sin cierre</span>
              )}
            </p>
            <table className="adm-table mt-3">
              <thead>
                <tr>
                  <th>Día</th>
                  <th className="adm-num">Cuota</th>
                  <th className="adm-num">AUM</th>
                  <th>Origen</th>
                </tr>
              </thead>
              <tbody>
                {estado.ultimos.map((u) => (
                  <tr key={u.dia}>
                    <td className="mono num">{u.dia}</td>
                    <td className="adm-num">{Number(u.nav).toFixed(4)}</td>
                    <td className="adm-num">{u.aum != null ? Number(u.aum).toLocaleString("es-UY") : "—"}</td>
                    <td>{u.source ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="adm-help mt-0!">Sin cierres publicados (pre-lanzamiento). Cargá el primero en «Valor cuota» o el histórico en «Backfill».</p>
        )}
      </Card>
      <div className="flex flex-col gap-4">
        <Card title="Tenencias">
          {estado.tenencias ? (
            <p className="text-sm">
              Snapshot más reciente: <strong className="mono num">{estado.tenencias.as_of}</strong> · {estado.tenencias.items} líneas
              <span className="adm-help block">El sitio lo publica recién pasado el rezago de divulgación (30 días).</span>
            </p>
          ) : (
            <p className="adm-help mt-0!">Sin snapshots cargados.</p>
          )}
        </Card>
        <Card title="Rechazos recientes">
          {estado.rechazos.length === 0 ? (
            <p className="adm-help mt-0!">Sin rechazos.</p>
          ) : (
            <ul className="flex flex-col gap-1.5 text-xs text-[color:var(--site-ink-3)]">
              {estado.rechazos.map((rj, i) => (
                <li key={i} className="flex flex-wrap items-center gap-1.5">
                  <span className="mono num">{fmtTs(rj.ts)}</span> · {rj.action} · {rj.target_dia ?? "—"} · <Badge tone="neg">{rj.reason ?? "?"}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

// ── Valor cuota (carga diaria) ───────────────────────────────────────────────

function TabCuota({ onCambio }: { onCambio: () => void }) {
  const [dia, setDia] = useState("");
  const [nav, setNav] = useState("");
  const [aum, setAum] = useState("");
  const [nota, setNota] = useState("");
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setMsg(null);
    const r = await panelFetch("/api/admin/panel/fondo/nav", {
      method: "POST",
      body: JSON.stringify({
        dia,
        nav: nav.trim(),
        ...(aum.trim() ? { aum: aum.trim() } : {}),
        ...(nota.trim() ? { nota: nota.trim() } : {}),
      }),
    });
    setBusy(false);
    if (r.status === 200) {
      const dup = (r.data as { decision?: string } | null)?.decision === "duplicate";
      setMsg({ kind: "ok", text: dup ? `El cierre de ${dia} ya estaba publicado con ese valor (sin cambios).` : `Cierre de ${dia} guardado. Falta publicarlo para que se vea en el sitio.` });
      onCambio();
      setNav(""); setAum(""); setNota("");
    } else {
      setMsg({ kind: "error", text: errorMessage(r) });
    }
  }

  return (
    <Card title="Cargar el cierre del día">
      <form onSubmit={submit} className="grid max-w-xl gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="vc-dia">Fecha de cierre</Label>
            <Input id="vc-dia" type="date" required value={dia} onChange={(e) => setDia(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="vc-nav">Valor cuota (punto decimal)</Label>
            <Input id="vc-nav" required inputMode="decimal" placeholder="1023.4567" value={nav} onChange={(e) => setNav(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="vc-aum">AUM (opcional)</Label>
            <Input id="vc-aum" inputMode="decimal" placeholder="12500000" value={aum} onChange={(e) => setAum(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="vc-nota">Nota (opcional)</Label>
            <Input id="vc-nota" maxLength={300} value={nota} onChange={(e) => setNota(e.target.value)} />
          </div>
        </div>
        {msg && <Notice kind={msg.kind}>{msg.text}</Notice>}
        <div>
          <Btn type="submit" disabled={busy}>{busy ? "Validando…" : "Publicar cierre"}</Btn>
        </div>
        <p className="adm-help">
          Se valida contra las bandas de cordura (salto máximo diario, rango absoluto, fechas). Un día ya publicado
          con otro valor se corrige en la pestaña «Corregir», no acá.
        </p>
      </form>
    </Card>
  );
}

// ── Backfill ─────────────────────────────────────────────────────────────────

type BackfillResultado = {
  ok: boolean;
  resumen: { aceptadas: number; rechazadas: number; ignoradas: number };
  resultados: Array<{ ok: boolean; index: number; dia?: string | null; reason?: string; message?: string }>;
};

function TabBackfill({ onCambio }: { onCambio: () => void }) {
  const [csv, setCsv] = useState("");
  const [sobrescribir, setSobrescribir] = useState(false);
  const [pideConfirmacion, setPideConfirmacion] = useState<string | null>(null);
  const [resultado, setResultado] = useState<BackfillResultado | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    setResultado(null);
    const r = await panelFetch<BackfillResultado>("/api/admin/panel/fondo/backfill", {
      method: "POST",
      body: JSON.stringify({ csv, sobrescribir }),
    });
    setBusy(false);
    if (r.status === 200 && r.data) {
      setResultado(r.data as unknown as BackfillResultado);
      setPideConfirmacion(null);
      setSobrescribir(false);
      onCambio();
    } else if (r.status === 409 && r.data?.error === "existentes") {
      setPideConfirmacion(typeof r.data.detalle === "string" ? r.data.detalle : "El rango pisa cierres existentes.");
    } else {
      setError(errorMessage(r));
    }
  }

  return (
    <Card title="Backfill del histórico (CSV)">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <div>
          <Label htmlFor="bf-csv">Una fila por línea: dia,valor_cuota[,aum[,nota]] — fechas ISO, decimal con punto</Label>
          <textarea
            id="bf-csv"
            required
            rows={10}
            value={csv}
            onChange={(e) => setCsv(e.target.value)}
            placeholder={"2024-01-02,1000\n2024-01-03,1001.25,12500000\n2024-01-04,1000.8,,cierre feriado EEUU"}
            className="adm-input mono text-xs"
          />
        </div>
        {pideConfirmacion && (
          <Notice kind="error">
            {pideConfirmacion}
            <label className="mt-2 flex items-center gap-2 text-sm [accent-color:var(--navy)]">
              <input type="checkbox" checked={sobrescribir} onChange={(e) => setSobrescribir(e.target.checked)} />
              Entiendo: sobrescribir los cierres existentes del rango
            </label>
          </Notice>
        )}
        {error && <Notice kind="error">{error}</Notice>}
        <div>
          <Btn type="submit" disabled={busy || (pideConfirmacion !== null && !sobrescribir)}>
            {busy ? "Validando lote…" : "Validar y cargar"}
          </Btn>
        </div>
      </form>
      {resultado && (
        <div className="mt-4 border-t border-[color:var(--site-border)] pt-4 text-sm">
          <p>
            <Badge tone={resultado.ok ? "pos" : "neu"}>
              {resultado.resumen.aceptadas} aceptadas · {resultado.resumen.rechazadas} rechazadas
              {resultado.resumen.ignoradas > 0 ? ` · ${resultado.resumen.ignoradas} líneas ignoradas` : ""}
            </Badge>
          </p>
          {resultado.resultados.filter((x) => !x.ok).length > 0 && (
            <ul className="mt-2 flex flex-col gap-1 text-xs text-[color:var(--neg)]">
              {resultado.resultados
                .filter((x) => !x.ok)
                .map((x) => (
                  <li key={x.index}>
                    Fila {x.index + 1} ({x.dia ?? "sin fecha"}): {x.message ?? x.reason}
                  </li>
                ))}
            </ul>
          )}
        </div>
      )}
    </Card>
  );
}

// ── Corregir (override) ──────────────────────────────────────────────────────

function TabCorregir({ onCambio }: { onCambio: () => void }) {
  const [dia, setDia] = useState("");
  const [nav, setNav] = useState("");
  const [aum, setAum] = useState("");
  const [motivo, setMotivo] = useState("");
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setMsg(null);
    const r = await panelFetch<{ prevNav: number | null }>("/api/admin/panel/fondo/override", {
      method: "POST",
      body: JSON.stringify({ dia, nav: nav.trim(), ...(aum.trim() ? { aum: aum.trim() } : {}), motivo }),
    });
    setBusy(false);
    if (r.status === 200) {
      const prev = (r.data as { prevNav?: number | null } | null)?.prevNav;
      setMsg({ kind: "ok", text: prev != null ? `Corregido: ${dia} pasó de ${prev} al valor nuevo.` : `Valor de ${dia} guardado. Falta publicarlo para que se vea en el sitio.` });
      onCambio();
      setNav(""); setAum(""); setMotivo("");
    } else {
      setMsg({ kind: "error", text: errorMessage(r) });
    }
  }

  return (
    <Card title="Corregir un cierre publicado">
      <form onSubmit={submit} className="grid max-w-xl gap-4">
        <Notice kind="info">
          Única vía que pisa un valor ya publicado. Salta la banda de movimiento diario, exige motivo y queda
          auditada con el valor anterior.
        </Notice>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="ov-dia">Fecha a corregir</Label>
            <Input id="ov-dia" type="date" required value={dia} onChange={(e) => setDia(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="ov-nav">Valor cuota correcto</Label>
            <Input id="ov-nav" required inputMode="decimal" value={nav} onChange={(e) => setNav(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="ov-aum">AUM (opcional)</Label>
            <Input id="ov-aum" inputMode="decimal" value={aum} onChange={(e) => setAum(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="ov-motivo">Motivo (obligatorio)</Label>
            <Input id="ov-motivo" required minLength={5} maxLength={300} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          </div>
        </div>
        {msg && <Notice kind={msg.kind}>{msg.text}</Notice>}
        <div>
          <Btn kind="danger" type="submit" disabled={busy}>{busy ? "Aplicando…" : "Corregir"}</Btn>
        </div>
      </form>
    </Card>
  );
}

// ── Tenencias ────────────────────────────────────────────────────────────────

type ItemTenencia = { name: string; short: string; assetClass: "RV" | "RF" | "ALT" | "OTROS"; weightBps: string };

function TabTenencias({ onCambio }: { onCambio: () => void }) {
  const [asOf, setAsOf] = useState("");
  const [note, setNote] = useState("");
  const [items, setItems] = useState<ItemTenencia[]>([{ name: "", short: "", assetClass: "RV", weightBps: "" }]);
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const suma = items.reduce((a, it) => a + (parseInt(it.weightBps, 10) || 0), 0);

  function setItem(i: number, patch: Partial<ItemTenencia>) {
    setItems((prev) => prev.map((it, k) => (k === i ? { ...it, ...patch } : it)));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setMsg(null);
    const r = await panelFetch("/api/admin/panel/fondo/holdings", {
      method: "POST",
      body: JSON.stringify({
        asOf,
        ...(note.trim() ? { note: note.trim() } : {}),
        items: items.map((it) => ({
          name: it.name.trim(),
          ...(it.short.trim() ? { short: it.short.trim() } : {}),
          assetClass: it.assetClass,
          weightBps: parseInt(it.weightBps, 10) || 0,
        })),
      }),
    });
    setBusy(false);
    if (r.status === 200) {
      setMsg({ kind: "ok", text: `Snapshot de ${asOf} guardado (${items.length} líneas). Falta publicarlo para que se vea en el sitio.` });
      onCambio();
    } else {
      setMsg({ kind: "error", text: errorMessage(r) });
    }
  }

  return (
    <Card title="Snapshot de tenencias">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="hd-asof">Fecha de cartera (as of)</Label>
            <Input id="hd-asof" type="date" required value={asOf} onChange={(e) => setAsOf(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="hd-note">Nota (opcional)</Label>
            <Input id="hd-note" maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="adm-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Etiqueta corta</th>
                <th>Clase</th>
                <th>Peso (bps)</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, i) => (
                <tr key={i}>
                  <td className="pr-2"><Input required value={it.name} onChange={(e) => setItem(i, { name: e.target.value })} /></td>
                  <td className="pr-2"><Input value={it.short} maxLength={24} onChange={(e) => setItem(i, { short: e.target.value })} /></td>
                  <td className="pr-2">
                    <Select
                      value={it.assetClass}
                      onChange={(e) => setItem(i, { assetClass: e.target.value as ItemTenencia["assetClass"] })}
                    >
                      <option value="RV">RV — Renta variable</option>
                      <option value="RF">RF — Renta fija</option>
                      <option value="ALT">ALT — Alternativos</option>
                      {/* Residual, no una clase de activo: la línea que cierra el
                          100% cuando el snapshot publica sólo las mayores
                          tenencias. Una sola por snapshot. */}
                      <option value="OTROS">OTROS — Resto de la cartera (residual)</option>
                    </Select>
                  </td>
                  <td className="pr-2">
                    <Input required inputMode="numeric" className="mono" placeholder="p.ej. 1250" value={it.weightBps} onChange={(e) => setItem(i, { weightBps: e.target.value.replace(/\D/g, "") })} />
                  </td>
                  <td>
                    <button
                      type="button"
                      onClick={() => setItems((prev) => prev.filter((_, k) => k !== i))}
                      disabled={items.length === 1}
                      className="rounded px-2 py-2 text-[color:var(--site-ink-3)] transition-colors hover:text-[color:var(--neg)] disabled:opacity-30"
                      aria-label="Quitar línea"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Btn kind="ghost" onClick={() => setItems((prev) => [...prev, { name: "", short: "", assetClass: "RV", weightBps: "" }])}>
            + Línea
          </Btn>
          <Badge tone={Math.abs(suma - 10000) <= 100 ? "pos" : "neu"}>Σ {suma} / 10000 bps</Badge>
        </div>
        {msg && <Notice kind={msg.kind}>{msg.text}</Notice>}
        <div>
          <Btn type="submit" disabled={busy}>{busy ? "Guardando…" : "Guardar snapshot"}</Btn>
        </div>
      </form>
    </Card>
  );
}

// ── Geografía ────────────────────────────────────────────────────────────────

// ⚠️ QUÉ ES ESTE NÚMERO, Y POR QUÉ IMPORTA QUE NO SE CONFUNDA
// Es la asignación OBJETIVO del mandato —lo que la estrategia busca sostener—,
// NO la exposición efectiva de la cartera a una fecha. Por eso no pide fecha de
// corte, no envejece y no le aplica el rezago de divulgación de las tenencias.
//
// Si alguna vez se cargara acá la exposición MEDIDA, no alcanza con cambiar el
// dato: hay que reescribir el pie del bloque público —la frase "la vigente te
// la informa un asesor" deja de ser cierta— y pasarlo por legales, porque esa
// redacción salió de la revisión del 3-ago-2026. Ver lib/fondoGeo.ts.

type GeoRegionResp = { key: string; label: string; sinMapa?: boolean };

type GeoResp = {
  guardado: boolean;
  pesos: Record<string, number>;
  baseline: Record<string, number>;
  regiones: GeoRegionResp[];
  meta: { updatedAt: number; updatedBy: string | null } | null;
};

const GEO_SUMA = 100;

function TabGeografia({ onCambio }: { onCambio: () => void }) {
  const [data, setData] = useState<GeoResp | null>(null);
  const [pesos, setPesos] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const cargar = useCallback(async () => {
    const r = await panelFetch<GeoResp>("/api/admin/panel/fondo/geo");
    if (r.status === 200 && r.data) {
      setData(r.data);
      setPesos(Object.fromEntries(Object.entries(r.data.pesos).map(([k, v]) => [k, String(v)])));
    } else {
      setMsg({ kind: "error", text: errorMessage(r) });
    }
  }, []);

  useEffect(() => {
    // Diferido a microtask por la misma razón que TabDocumentos: el linter de
    // React exige que ningún setState corra sincrónico dentro del effect.
    queueMicrotask(() => void cargar());
  }, [cargar]);

  const regiones = data?.regiones ?? [];
  const suma = regiones.reduce((a, r) => a + (parseInt(pesos[r.key] ?? "", 10) || 0), 0);
  const cuadra = suma === GEO_SUMA;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !cuadra) return;
    setBusy(true);
    setMsg(null);
    const body = Object.fromEntries(regiones.map((r) => [r.key, parseInt(pesos[r.key] ?? "", 10) || 0]));
    const r = await panelFetch("/api/admin/panel/fondo/geo", { method: "POST", body: JSON.stringify(body) });
    setBusy(false);
    if (r.status === 200) {
      setMsg({ kind: "ok", text: "Asignación objetivo guardada. Falta publicarla para que se vea en el sitio." });
      onCambio();
      void cargar();
    } else {
      setMsg({ kind: "error", text: errorMessage(r) });
    }
  }

  if (!data) {
    return (
      <Card title="Exposición geográfica">
        {msg ? <Notice kind={msg.kind}>{msg.text}</Notice> : <p className="adm-dek">Cargando…</p>}
      </Card>
    );
  }

  return (
    <Card title="Exposición geográfica">
      <p className="adm-dek mb-4">
        Asignación <strong>objetivo</strong> de la estrategia por región — lo que el mandato busca
        sostener, no la cartera a una fecha. Tiene que sumar {GEO_SUMA}.
      </p>

      {/* Distinguir "nunca se cargó" de "se cargó" no es cosmético: sin fila, lo
          que muestra el sitio son los valores del deploy, y cambiarlos acá es
          lo que hace que dejen de depender de un rebuild. */}
      {!data.guardado && (
        <Notice kind="info">
          Todavía no se cargó nunca. Los valores de abajo son los que viajan en el código del sitio;
          al guardar pasan a gobernarse desde acá.
        </Notice>
      )}

      <form onSubmit={submit} className="mt-4 flex flex-col gap-4">
        {/* En el orden canónico de lib/fondoGeo.ts, NO por peso: la leyenda del
            sitio sí se ordena por peso, pero un formulario que se reordena
            mientras se tipea es inusable. */}
        <div className="grid gap-4 sm:grid-cols-2">
          {regiones.map((r) => (
            <div key={r.key}>
              <Label htmlFor={`geo-${r.key}`}>
                {r.label}
                {r.sinMapa ? " (no se pinta en el mapa)" : ""}
              </Label>
              <Input
                id={`geo-${r.key}`}
                required
                inputMode="numeric"
                className="mono"
                value={pesos[r.key] ?? ""}
                onChange={(e) =>
                  setPesos((prev) => ({ ...prev, [r.key]: e.target.value.replace(/\D/g, "").slice(0, 3) }))
                }
              />
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Badge tone={cuadra ? "pos" : "neg"}>
            Σ {suma} / {GEO_SUMA}
          </Badge>
          {data.meta && (
            <span className="adm-dek">
              Última edición: {fmtTs(data.meta.updatedAt)}
              {data.meta.updatedBy ? ` · ${data.meta.updatedBy}` : ""}
            </span>
          )}
        </div>

        {msg && <Notice kind={msg.kind}>{msg.text}</Notice>}

        <div>
          {/* Deshabilitado mientras no cierre: el server lo rechaza igual (la
              suma va clavada en 100), pero enterarse antes de mandar es mejor
              que un error de vuelta. */}
          <Btn type="submit" disabled={busy || !cuadra}>
            {busy ? "Guardando…" : "Guardar asignación"}
          </Btn>
        </div>
      </form>
    </Card>
  );
}

// ── Documentos ───────────────────────────────────────────────────────────────

type Doc = {
  tipo: string;
  titulo: string;
  descripcion: string | null;
  content_len: number | null;
  status: "live" | "hold";
  updated_at: number;
  updated_by: string;
};

const DOC_LABELS: Record<string, string> = {
  "ficha-tecnica": "Factsheet",
  "datos-fundamentales": "Datos fundamentales para el inversor",
  "reglamento": "Reglamento de gestión",
  "autorizacion-bcu": "Autorización del Banco Central",
  "informe-cartera": "Informe de cartera",
};

function TabDocumentos({ onCambio }: { onCambio: () => void }) {
  const [docs, setDocs] = useState<Doc[] | null>(null);
  const [tipos, setTipos] = useState<string[]>([]);
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [busyTipo, setBusyTipo] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await panelFetch<{ documentos: Doc[]; tipos: string[] }>("/api/admin/panel/fondo/documentos");
    if (r.status === 200 && r.data) {
      setDocs(r.data.documentos ?? []);
      setTipos(r.data.tipos ?? []);
    } else {
      setMsg({ kind: "error", text: errorMessage(r) });
    }
  }, []);

  useEffect(() => {
    // Diferido a microtask: el linter de React exige que ningún setState corra
    // sincrónico dentro del effect (load setea estado al resolver el fetch).
    queueMicrotask(() => void load());
  }, [load]);

  async function subir(tipo: string, file: File) {
    if (busyTipo) return;
    setBusyTipo(tipo);
    setMsg(null);
    const form = new FormData();
    form.append("archivo", file);
    const r = await panelFetch(`/api/admin/panel/fondo/documentos/${tipo}`, { method: "POST", body: form });
    if (r.status === 200) {
      setMsg({ kind: "ok", text: `${DOC_LABELS[tipo] ?? tipo} subido. Falta publicarlo para que se vea en el sitio.` });
      onCambio();
    } else setMsg({ kind: "error", text: errorMessage(r) });
    await load();
    setBusyTipo(null);
  }

  async function patchDoc(tipo: string, fields: Record<string, unknown>, texto: string) {
    if (busyTipo) return;
    setBusyTipo(tipo);
    setMsg(null);
    const r = await panelFetch(`/api/admin/panel/fondo/documentos/${tipo}`, {
      method: "PATCH",
      body: JSON.stringify(fields),
    });
    if (r.status === 200) {
      setMsg({ kind: "ok", text: texto });
      onCambio();
    } else setMsg({ kind: "error", text: errorMessage(r) });
    await load();
    setBusyTipo(null);
  }

  if (!docs) return <p className="adm-help mt-0!">Cargando…</p>;

  return (
    <div className="flex flex-col gap-3">
      <Notice kind="info">
        La sección «Documentos» de la página del fondo muestra los archivos publicados sólo si el módulo está
        prendido en Secciones. Sin archivo publicado, el sitio lista el documento marcado «Próximamente», sin acción.
      </Notice>
      {msg && <Notice kind={msg.kind}>{msg.text}</Notice>}
      {tipos.map((tipo) => {
        const doc = docs.find((d) => d.tipo === tipo) ?? null;
        return (
          <Card key={tipo}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 text-sm">
                  {DOC_LABELS[tipo] ?? tipo}
                  {doc ? (
                    <Badge tone={doc.status === "live" ? "pos" : "neu"}>{doc.status === "live" ? "Publicado" : "Oculto"}</Badge>
                  ) : (
                    <Badge tone="neg">Sin archivo</Badge>
                  )}
                </p>
                {doc && (
                  <p className="adm-help">
                    {doc.titulo}
                    {doc.content_len != null && <> · <span className="mono num">{(doc.content_len / 1024 / 1024).toFixed(1)} MB</span></>} · actualizado{" "}
                    <span className="mono num">{fmtTs(doc.updated_at)}</span> por {doc.updated_by}
                  </p>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <label className="adm-btn adm-btn-ghost cursor-pointer">
                  {busyTipo === tipo ? "…" : doc ? "Reemplazar PDF" : "Subir PDF"}
                  <input
                    type="file"
                    accept="application/pdf"
                    className="hidden"
                    disabled={busyTipo === tipo}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void subir(tipo, f);
                      e.target.value = "";
                    }}
                  />
                </label>
                {doc &&
                  (doc.status === "live" ? (
                    <Btn kind="ghost" disabled={busyTipo === tipo} onClick={() => patchDoc(tipo, { status: "hold" }, "Documento oculto.")}>
                      Ocultar
                    </Btn>
                  ) : (
                    <Btn disabled={busyTipo === tipo} onClick={() => patchDoc(tipo, { status: "live" }, "Documento marcado visible. Falta publicar.")}>
                      Publicar
                    </Btn>
                  ))}
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
