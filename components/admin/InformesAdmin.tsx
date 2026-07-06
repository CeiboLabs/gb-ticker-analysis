"use client";

// Administración de informes: alta, edición, PDF (upload a R2 o URL histórica)
// y publicación. Un informe nuevo nace oculto y se publica recién con PDF.

import { useCallback, useEffect, useState } from "react";
import { panelFetch, errorMessage, Btn, Card, Input, Label, Notice, Badge, PageHeader, Select } from "@/components/admin/ui";

type Row = {
  slug: string;
  fecha: string;
  fecha_texto: string;
  titulo: string;
  categoria: "Mensual" | "Semanal";
  pdf_url: string | null;
  r2_key: string | null;
  video_id: string | null;
  status: "live" | "hold";
  updated_at: number;
  updated_by: string | null;
};

export default function InformesAdmin() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await panelFetch<{ informes: Row[] }>("/api/admin/panel/informes");
    if (r.status === 200 && r.data?.informes) {
      setRows(r.data.informes);
    } else {
      setError(errorMessage(r));
    }
  }, []);

  useEffect(() => {
    // Diferido a microtask: el linter de React exige que ningún setState corra
    // sincrónico dentro del effect (load setea estado al resolver el fetch).
    queueMicrotask(() => void load());
  }, [load]);

  function flash(msg: string) {
    setOk(msg);
    setError(null);
    setTimeout(() => setOk(null), 4000);
  }

  return (
    <div>
      <PageHeader
        eyebrow="Panel · Research"
        title="Informes"
        dek="La lista pública de /informes sale de acá. Ocultar un informe también deja su PDF sin servir."
      />
      <div className="flex flex-col gap-4">
        {error && <Notice kind="error">{error}</Notice>}
        {ok && <Notice kind="ok">{ok}</Notice>}
        <NuevoInforme onCreated={(slug) => { flash(`Informe ${slug} creado (oculto hasta publicar).`); void load(); }} onError={setError} />
        {!rows ? (
          <p className="adm-help mt-0!">Cargando…</p>
        ) : (
          <div className="flex flex-col gap-3">
            {rows.map((row) => (
              <FilaInforme
                key={row.slug}
                row={row}
                onChanged={(msg) => { flash(msg); void load(); }}
                onError={setError}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function NuevoInforme({ onCreated, onError }: { onCreated: (slug: string) => void; onError: (e: string) => void }) {
  const [open, setOpen] = useState(false);
  const [categoria, setCategoria] = useState<"Semanal" | "Mensual">("Semanal");
  const [fecha, setFecha] = useState("");
  const [titulo, setTitulo] = useState("");
  const [videoId, setVideoId] = useState("");
  const [pdfUrl, setPdfUrl] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    const r = await panelFetch<{ slug: string }>("/api/admin/panel/informes", {
      method: "POST",
      body: JSON.stringify({
        categoria,
        fecha,
        titulo,
        ...(categoria === "Mensual" && videoId.trim() ? { videoId: videoId.trim() } : {}),
        ...(pdfUrl.trim() ? { pdfUrl: pdfUrl.trim() } : {}),
      }),
    });
    setBusy(false);
    if (r.status === 200 && r.data?.slug) {
      setOpen(false);
      setFecha(""); setTitulo(""); setVideoId(""); setPdfUrl("");
      onCreated(r.data.slug);
    } else {
      onError(errorMessage(r));
    }
  }

  if (!open) {
    return (
      <div>
        <Btn onClick={() => setOpen(true)}>+ Nuevo informe</Btn>
      </div>
    );
  }
  return (
    <Card title="Nuevo informe">
      <form onSubmit={submit} className="grid gap-4 md:grid-cols-2">
        <div>
          <Label htmlFor="ni-categoria">Categoría</Label>
          <Select
            id="ni-categoria"
            value={categoria}
            onChange={(e) => setCategoria(e.target.value as "Semanal" | "Mensual")}
          >
            <option value="Semanal">Semanal</option>
            <option value="Mensual">Mensual</option>
          </Select>
        </div>
        <div>
          <Label htmlFor="ni-fecha">Fecha del informe</Label>
          <Input id="ni-fecha" type="date" required value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </div>
        <div className="md:col-span-2">
          <Label htmlFor="ni-titulo">Título</Label>
          <Input
            id="ni-titulo"
            required
            placeholder={categoria === "Mensual" ? "Informe mensual · Mes 2026" : "Informe semanal · 12 de junio"}
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
          />
        </div>
        {categoria === "Mensual" && (
          <div>
            <Label htmlFor="ni-video">Video de YouTube (opcional, solo mensuales)</Label>
            <Input id="ni-video" placeholder="id del video, ej. mWJ8df43m34" value={videoId} onChange={(e) => setVideoId(e.target.value)} />
          </div>
        )}
        <div className={categoria === "Mensual" ? "" : "md:col-span-2"}>
          <Label htmlFor="ni-pdf">URL externa del PDF (opcional — lo normal es subir el archivo después)</Label>
          <Input id="ni-pdf" placeholder="https://gbengochea.com.uy/img/informes/…" value={pdfUrl} onChange={(e) => setPdfUrl(e.target.value)} />
        </div>
        <div className="flex gap-2 md:col-span-2">
          <Btn type="submit" disabled={busy}>{busy ? "Creando…" : "Crear (queda oculto)"}</Btn>
          <Btn kind="ghost" onClick={() => setOpen(false)}>Cancelar</Btn>
        </div>
      </form>
    </Card>
  );
}

function FilaInforme({ row, onChanged, onError }: { row: Row; onChanged: (msg: string) => void; onError: (e: string) => void }) {
  const [editando, setEditando] = useState(false);
  const [busy, setBusy] = useState(false);
  const tienePdf = row.pdf_url != null || row.r2_key != null;

  async function patch(fields: Record<string, unknown>, msg: string) {
    if (busy) return;
    setBusy(true);
    const r = await panelFetch(`/api/admin/panel/informes/${row.slug}`, {
      method: "PATCH",
      body: JSON.stringify(fields),
    });
    setBusy(false);
    if (r.status === 200) onChanged(msg);
    else onError(errorMessage(r));
  }

  async function subirPdf(file: File) {
    if (busy) return;
    setBusy(true);
    const form = new FormData();
    form.append("archivo", file);
    const r = await panelFetch(`/api/admin/panel/informes/${row.slug}/pdf`, { method: "POST", body: form });
    setBusy(false);
    if (r.status === 200) onChanged(`PDF de ${row.slug} subido.`);
    else onError(errorMessage(r));
  }

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 text-sm">
            {row.titulo}
            <Badge tone={row.status === "live" ? "pos" : "neu"}>{row.status === "live" ? "Publicado" : "Oculto"}</Badge>
            <Badge tone="neutral">{row.categoria}</Badge>
          </p>
          <p className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-[color:var(--site-ink-3)]">
            <span>{row.fecha_texto}</span>
            <span>·</span>
            <Badge tone={row.r2_key ? "gold" : row.pdf_url ? "neutral" : "neg"}>
              {row.r2_key ? "PDF propio (R2)" : row.pdf_url ? "PDF externo" : "Falta PDF"}
            </Badge>
            {row.video_id && <Badge tone="neutral">▶ {row.video_id}</Badge>}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="adm-btn adm-btn-ghost cursor-pointer">
            {busy ? "…" : "Subir PDF"}
            <input
              type="file"
              accept="application/pdf"
              className="hidden"
              disabled={busy}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void subirPdf(f);
                e.target.value = "";
              }}
            />
          </label>
          <Btn kind="ghost" onClick={() => setEditando((v) => !v)}>{editando ? "Cerrar" : "Editar"}</Btn>
          {row.status === "hold" ? (
            <Btn disabled={busy || !tienePdf} onClick={() => patch({ status: "live" }, `${row.slug} publicado.`)}>
              Publicar
            </Btn>
          ) : (
            <Btn kind="danger" disabled={busy} onClick={() => patch({ status: "hold" }, `${row.slug} oculto.`)}>
              Ocultar
            </Btn>
          )}
        </div>
      </div>
      {!tienePdf && row.status === "hold" && (
        <p className="adm-help">Para publicarlo, subí el PDF (o cargá la URL externa en Editar).</p>
      )}
      {editando && (
        <EditarInforme
          row={row}
          busy={busy}
          onSubmit={(fields) => patch(fields, `${row.slug} actualizado.`)}
        />
      )}
    </Card>
  );
}

function EditarInforme({ row, busy, onSubmit }: { row: Row; busy: boolean; onSubmit: (fields: Record<string, unknown>) => void }) {
  const [titulo, setTitulo] = useState(row.titulo);
  const [fecha, setFecha] = useState(row.fecha);
  const [videoId, setVideoId] = useState(row.video_id ?? "");
  const [pdfUrl, setPdfUrl] = useState(row.pdf_url ?? "");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const fields: Record<string, unknown> = {};
    if (titulo !== row.titulo) fields.titulo = titulo;
    if (fecha !== row.fecha) fields.fecha = fecha;
    if (row.categoria === "Mensual" && videoId.trim() !== (row.video_id ?? "")) {
      fields.videoId = videoId.trim() === "" ? null : videoId.trim();
    }
    if (pdfUrl.trim() !== (row.pdf_url ?? "")) {
      fields.pdfUrl = pdfUrl.trim() === "" ? null : pdfUrl.trim();
    }
    if (Object.keys(fields).length === 0) return;
    onSubmit(fields);
  }

  return (
    <form onSubmit={submit} className="mt-4 grid gap-4 border-t border-[color:var(--site-border)] pt-4 md:grid-cols-2">
      <div className="md:col-span-2">
        <Label htmlFor={`ed-titulo-${row.slug}`}>Título</Label>
        <Input id={`ed-titulo-${row.slug}`} value={titulo} onChange={(e) => setTitulo(e.target.value)} />
      </div>
      <div>
        <Label htmlFor={`ed-fecha-${row.slug}`}>Fecha</Label>
        <Input id={`ed-fecha-${row.slug}`} type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
      </div>
      {row.categoria === "Mensual" && (
        <div>
          <Label htmlFor={`ed-video-${row.slug}`}>Video de YouTube (vacío = quitar)</Label>
          <Input id={`ed-video-${row.slug}`} value={videoId} onChange={(e) => setVideoId(e.target.value)} />
        </div>
      )}
      <div className="md:col-span-2">
        <Label htmlFor={`ed-pdf-${row.slug}`}>URL externa del PDF (vacío = quitar; si hay PDF propio subido, manda el propio)</Label>
        <Input id={`ed-pdf-${row.slug}`} value={pdfUrl} onChange={(e) => setPdfUrl(e.target.value)} />
      </div>
      <div className="md:col-span-2">
        <Btn type="submit" disabled={busy}>Guardar cambios</Btn>
      </div>
    </form>
  );
}
