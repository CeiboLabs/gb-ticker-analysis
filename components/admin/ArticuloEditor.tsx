"use client";

// Editor del artículo editorial de un informe. Arma un ContenidoInforme y lo
// guarda entero (PUT /contenido). La prosa se edita con formularios; los bloques
// de datos (tabla/barras/serie/retornos) con un textarea JSON —edición
// estructurada friendly llega con el import de Excel (Fase 3)—. El PREVIEW usa el
// MISMO ArticuloInforme del sitio (es server-component puro/síncrono, así que
// renderiza también en cliente): lo que se ve acá es lo que se publica.

import { useCallback, useEffect, useState } from "react";
import { panelFetch, errorMessage, Btn, Label, Input, Select, Notice } from "@/components/admin/ui";
import { ArticuloInforme } from "@/components/institucional/informe/ArticuloInforme";
import type { Bloque, ContenidoInforme } from "@/lib/informeContenido/tipos";
import type { Informe } from "@/lib/informes";

type Row = {
  slug: string;
  titulo: string;
  fecha: string;
  fecha_texto: string;
  categoria: "Mensual" | "Semanal";
};

let _seq = 0;
const nextId = () => ++_seq;
type BloqueEd = { id: number; b: Bloque };

const TIPOS: { tipo: Bloque["tipo"]; label: string; datos?: boolean }[] = [
  { tipo: "seccion", label: "Sección" },
  { tipo: "parrafo", label: "Párrafo" },
  { tipo: "subtitulo", label: "Subtítulo" },
  { tipo: "lista", label: "Lista" },
  { tipo: "cita", label: "Cita" },
  { tipo: "tabla", label: "Tabla", datos: true },
  { tipo: "barras", label: "Barras (hero)", datos: true },
  { tipo: "serie", label: "Gráfico de línea", datos: true },
  { tipo: "retornos", label: "Retornos (heatmap)", datos: true },
  { tipo: "imagen", label: "Imagen / gráfico" },
];
const LABEL: Record<Bloque["tipo"], string> = Object.fromEntries(TIPOS.map((t) => [t.tipo, t.label])) as Record<Bloque["tipo"], string>;
const ES_DATOS = (t: Bloque["tipo"]) => TIPOS.find((x) => x.tipo === t)?.datos === true;

const NUEVO: Record<Bloque["tipo"], () => Bloque> = {
  seccion: () => ({ tipo: "seccion", numero: "", titulo: "" }),
  parrafo: () => ({ tipo: "parrafo", md: "" }),
  subtitulo: () => ({ tipo: "subtitulo", titulo: "" }),
  lista: () => ({ tipo: "lista", items: [""] }),
  cita: () => ({ tipo: "cita", texto: "" }),
  tabla: () => ({ tipo: "tabla", columnas: [{ titulo: "Plazo" }, { titulo: "Tasa", sufijo: " %" }], filas: [] }),
  barras: () => ({ tipo: "barras", grupos: [{ nombre: "", datos: [] }] }),
  serie: () => ({ tipo: "serie", lineas: [{ nombre: "", puntos: [] }] }),
  retornos: () => ({ tipo: "retornos", grupos: [{ nombre: "", datos: [] }] }),
  imagen: () => ({ tipo: "imagen", src: "", alt: "" }),
};

function vacio(categoria: Row["categoria"]): ContenidoInforme {
  return {
    volanta: categoria === "Mensual" ? "Informe mensual" : "Informe semanal",
    titular: "",
    bajada: "",
    autor: "",
    resumen: [],
    bloques: [],
  };
}

/** Deja los bloques listos para preview/guardar: filtra vacíos que romperían el schema. */
function limpiarBloque(b: Bloque): Bloque {
  if (b.tipo === "lista") return { ...b, items: b.items.map((i) => i.trim()).filter(Boolean) };
  return b;
}

// ── Editor de un bloque ──────────────────────────────────────────────────────

function EditorBloque({ ed, onChange }: { ed: BloqueEd; onChange: (b: Bloque) => void }) {
  const b = ed.b;
  switch (b.tipo) {
    case "seccion":
      return (
        <div className="art-grid3">
          <Field label="Nº"><Input value={b.numero} onChange={(e) => onChange({ ...b, numero: e.target.value })} placeholder="01" /></Field>
          <Field label="Título"><Input value={b.titulo} onChange={(e) => onChange({ ...b, titulo: e.target.value })} placeholder="Mercado local." /></Field>
          <Field label="Eyebrow"><Input value={b.eyebrow ?? ""} onChange={(e) => onChange({ ...b, eyebrow: e.target.value || undefined })} placeholder="Uruguay" /></Field>
        </div>
      );
    case "parrafo":
      return (
        <textarea className="adm-input art-ta" rows={4} value={b.md} onChange={(e) => onChange({ ...b, md: e.target.value })} placeholder="Prosa en Markdown. **negrita** para la oración-tesis y las cifras clave." />
      );
    case "subtitulo":
      return (
        <div className="art-grid2">
          <Field label="Título"><Input value={b.titulo} onChange={(e) => onChange({ ...b, titulo: e.target.value })} placeholder="Brasil" /></Field>
          <Field label="Volanta"><Input value={b.volanta ?? ""} onChange={(e) => onChange({ ...b, volanta: e.target.value || undefined })} placeholder="a cinco meses de las elecciones" /></Field>
        </div>
      );
    case "lista":
      return (
        <textarea
          className="adm-input art-ta"
          rows={4}
          value={b.items.join("\n")}
          onChange={(e) => onChange({ ...b, items: e.target.value.split("\n") })}
          placeholder={"Un ítem por línea"}
        />
      );
    case "cita":
      return (
        <div className="art-grid1">
          <Field label="Texto"><textarea className="adm-input art-ta" rows={3} value={b.texto} onChange={(e) => onChange({ ...b, texto: e.target.value })} /></Field>
          <Field label="Fuente"><Input value={b.fuente ?? ""} onChange={(e) => onChange({ ...b, fuente: e.target.value || undefined })} placeholder="Comunicado del COPOM · 26 de mayo" /></Field>
        </div>
      );
    case "imagen":
      return (
        <div className="art-grid1">
          <Field label="Imagen (path del sitio, ej. /informes-media/…)">
            <Input value={b.src} onChange={(e) => onChange({ ...b, src: e.target.value })} placeholder="/informes-media/mensual-…/grafico-1.png" />
          </Field>
          <div className="art-grid2">
            <Field label="Título (opcional)"><Input value={b.titulo ?? ""} onChange={(e) => onChange({ ...b, titulo: e.target.value || undefined })} /></Field>
            <Field label="Fuente (opcional)"><Input value={b.fuente ?? ""} onChange={(e) => onChange({ ...b, fuente: e.target.value || undefined })} placeholder="Bloomberg" /></Field>
          </div>
          <Field label="Alt (descripción para accesibilidad)">
            <Input value={b.alt} onChange={(e) => onChange({ ...b, alt: e.target.value })} />
          </Field>
        </div>
      );
    default:
      return <BloqueDatos ed={ed} onChange={onChange} />;
  }
}

/** Bloques de datos como JSON (interino: la carga estructurada llega con el Excel). */
function BloqueDatos({ ed, onChange }: { ed: BloqueEd; onChange: (b: Bloque) => void }) {
  const tipo = ed.b.tipo;
  const rest = Object.fromEntries(Object.entries(ed.b).filter(([k]) => k !== "tipo"));
  const [raw, setRaw] = useState(() => JSON.stringify(rest, null, 2));
  const [err, setErr] = useState<string | null>(null);
  return (
    <div>
      <p className="art-hint">Datos como JSON — la carga estructurada (pegar del Excel) llega en la Fase 3.</p>
      <textarea
        className="adm-input art-ta art-json"
        rows={8}
        spellCheck={false}
        value={raw}
        onChange={(e) => {
          const v = e.target.value;
          setRaw(v);
          try {
            const parsed = JSON.parse(v) as Record<string, unknown>;
            setErr(null);
            onChange({ tipo, ...parsed } as Bloque);
          } catch {
            setErr("JSON inválido — se ignora hasta corregir.");
          }
        }}
      />
      {err && <p className="art-err">{err}</p>}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

// ── Editor completo ──────────────────────────────────────────────────────────

export default function ArticuloEditor({
  row,
  slugAnterior,
  onSaved,
}: {
  row: Row;
  slugAnterior?: string;
  onSaved: () => void;
}) {
  const [volanta, setVolanta] = useState("");
  const [titular, setTitular] = useState("");
  const [bajada, setBajada] = useState("");
  const [autor, setAutor] = useState("");
  const [resumen, setResumen] = useState<{ etiqueta: string; texto: string }[]>([]);
  const [graficoRaw, setGraficoRaw] = useState("");
  const [bloques, setBloques] = useState<BloqueEd[]>([]);
  const [nuevoTipo, setNuevoTipo] = useState<Bloque["tipo"]>("seccion");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);

  const hidratar = useCallback((c: ContenidoInforme | null, cat: Row["categoria"]) => {
    const base = c ?? vacio(cat);
    setVolanta(base.volanta);
    setTitular(base.titular);
    setBajada(base.bajada);
    setAutor(base.autor);
    setResumen(base.resumen ?? []);
    setGraficoRaw(base.graficoSemana ? JSON.stringify(base.graficoSemana, null, 2) : "");
    setBloques((base.bloques ?? []).map((b) => ({ id: nextId(), b })));
  }, []);

  useEffect(() => {
    // `cargando` arranca en true (el editor se monta una vez por fila, slug fijo):
    // no hace falta —ni se permite (set-state-in-effect)— setearlo sincrónico acá.
    let vivo = true;
    void panelFetch<{ contenido: ContenidoInforme | null }>(`/api/admin/panel/informes/${row.slug}/contenido`).then((r) => {
      if (!vivo) return;
      if (r.status === 200) hidratar(r.data?.contenido ?? null, row.categoria);
      else setError(errorMessage(r));
      setCargando(false);
    });
    return () => {
      vivo = false;
    };
  }, [row.slug, row.categoria, hidratar]);

  const setBloque = (id: number, b: Bloque) => setBloques((prev) => prev.map((x) => (x.id === id ? { ...x, b } : x)));
  const quitarBloque = (id: number) => setBloques((prev) => prev.filter((x) => x.id !== id));
  const moverBloque = (id: number, dir: -1 | 1) =>
    setBloques((prev) => {
      const i = prev.findIndex((x) => x.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  const agregarBloque = () => setBloques((prev) => [...prev, { id: nextId(), b: NUEVO[nuevoTipo]() }]);

  // Ensamblado lenient para el preview: ignora el gráfico si su JSON no parsea.
  function ensamblar(): ContenidoInforme {
    let graficoSemana: ContenidoInforme["graficoSemana"];
    const g = graficoRaw.trim();
    if (g) {
      try {
        graficoSemana = JSON.parse(g) as ContenidoInforme["graficoSemana"];
      } catch {
        /* inválido: se omite en el preview; el server lo valida al guardar */
      }
    }
    return {
      volanta,
      titular,
      bajada,
      autor,
      resumen: resumen.filter((r) => r.etiqueta.trim() || r.texto.trim()),
      ...(graficoSemana ? { graficoSemana } : {}),
      bloques: bloques.map((x) => limpiarBloque(x.b)),
    };
  }

  async function guardar() {
    if (busy) return;
    setBusy(true);
    setError(null);
    setOk(null);
    const r = await panelFetch(`/api/admin/panel/informes/${row.slug}/contenido`, {
      method: "PUT",
      body: JSON.stringify(ensamblar()),
    });
    setBusy(false);
    if (r.status === 200) {
      setOk("Artículo guardado.");
      onSaved();
      setTimeout(() => setOk(null), 4000);
    } else {
      setError(errorMessage(r));
    }
  }

  async function clonar() {
    if (!slugAnterior || busy) return;
    if (bloques.length > 0 && !window.confirm("Esto reemplaza el borrador actual con el del informe anterior. ¿Seguir?")) return;
    setBusy(true);
    setError(null);
    const r = await panelFetch<{ contenido: ContenidoInforme | null }>(`/api/admin/panel/informes/${slugAnterior}/contenido`);
    setBusy(false);
    if (r.status === 200 && r.data?.contenido) {
      // Se clona el CONTENIDO (estructura + números viejos como punto de partida),
      // pero no la firma editorial propia de la edición: titular y bajada arrancan
      // en blanco para reescribir la semana.
      hidratar({ ...r.data.contenido, titular: "", bajada: "" }, row.categoria);
      setOk("Clonado del anterior — reescribí titular, bajada y los deltas.");
      setTimeout(() => setOk(null), 6000);
    } else {
      setError(r.data?.contenido === null ? "El informe anterior todavía no tiene artículo." : errorMessage(r));
    }
  }

  async function traerDatos() {
    if (busy) return;
    setBusy(true);
    setError(null);
    setOk(null);
    const r = await panelFetch<{ bloques: Bloque[] }>(`/api/admin/panel/informes/${row.slug}/datos`, { method: "POST" });
    setBusy(false);
    if (r.status === 200 && r.data?.bloques) {
      const nuevos = r.data.bloques;
      setBloques((prev) => [...prev, ...nuevos.map((b) => ({ id: nextId(), b }))]);
      setOk(`Traje ${nuevos.length} cuadros de mercado — ubicalos en su sección y revisá los números antes de publicar.`);
      setTimeout(() => setOk(null), 7000);
    } else {
      setError(errorMessage(r));
    }
  }

  const informePreview: Informe = {
    slug: row.slug,
    fecha: row.fecha,
    fechaTexto: row.fecha_texto,
    titulo: row.titulo,
    categoria: row.categoria,
    pdf: "",
  };
  const preview = ensamblar();
  const previewListo = titular.trim() !== "" || bloques.length > 0;

  if (cargando) return <p className="adm-help mt-0!">Cargando artículo…</p>;

  return (
    <div className="art-editor">
      {error && <Notice kind="error">{error}</Notice>}
      {ok && <Notice kind="ok">{ok}</Notice>}

      <div className="art-cols">
        {/* ── Columna de edición ── */}
        <div className="art-form">
          <div className="art-grid2">
            <Field label="Volanta"><Input value={volanta} onChange={(e) => setVolanta(e.target.value)} /></Field>
            <Field label="Autor"><Input value={autor} onChange={(e) => setAutor(e.target.value)} placeholder="Ec. Adrián Moreira, CFA" /></Field>
          </div>
          <Field label="Titular"><Input value={titular} onChange={(e) => setTitular(e.target.value)} placeholder="La inflación no cede; el COPOM, sin cambios." /></Field>
          <Field label="Bajada"><textarea className="adm-input art-ta" rows={2} value={bajada} onChange={(e) => setBajada(e.target.value)} /></Field>

          {/* Resumen */}
          <div className="art-sec">
            <div className="art-sec-hd"><span>La semana en tres líneas</span></div>
            {resumen.map((r, i) => (
              <div className="art-grid-res" key={i}>
                <Input value={r.etiqueta} placeholder="Uruguay" onChange={(e) => setResumen((p) => p.map((x, k) => (k === i ? { ...x, etiqueta: e.target.value } : x)))} />
                <Input value={r.texto} placeholder="La línea de la semana…" onChange={(e) => setResumen((p) => p.map((x, k) => (k === i ? { ...x, texto: e.target.value } : x)))} />
                <Btn kind="ghost" sm onClick={() => setResumen((p) => p.filter((_, k) => k !== i))}>×</Btn>
              </div>
            ))}
            {resumen.length < 6 && (
              <Btn kind="ghost" sm onClick={() => setResumen((p) => [...p, { etiqueta: "", texto: "" }])}>+ línea</Btn>
            )}
          </div>

          {/* Gráfico de la semana (opcional) */}
          <Field label="Gráfico de la semana (JSON, opcional)">
            <textarea className="adm-input art-ta art-json" rows={graficoRaw ? 6 : 2} value={graficoRaw} spellCheck={false} onChange={(e) => setGraficoRaw(e.target.value)} placeholder='{ "titulo": "Los que se movieron", "datos": [ { "etiqueta": "Merval", "valor": 10.07 } ] }' />
          </Field>

          {/* Bloques */}
          <div className="art-sec">
            <div className="art-sec-hd"><span>Cuerpo · {bloques.length} bloque{bloques.length === 1 ? "" : "s"}</span></div>
            {bloques.map((ed, i) => (
              <div className="art-bloque" key={ed.id}>
                <div className="art-bloque-hd">
                  <span className="art-bloque-tipo">{ES_DATOS(ed.b.tipo) ? "▦ " : ""}{LABEL[ed.b.tipo]}</span>
                  <div className="art-bloque-acc">
                    <Btn kind="ghost" sm disabled={i === 0} onClick={() => moverBloque(ed.id, -1)}>↑</Btn>
                    <Btn kind="ghost" sm disabled={i === bloques.length - 1} onClick={() => moverBloque(ed.id, 1)}>↓</Btn>
                    <Btn kind="danger" sm onClick={() => quitarBloque(ed.id)}>×</Btn>
                  </div>
                </div>
                <EditorBloque ed={ed} onChange={(b) => setBloque(ed.id, b)} />
              </div>
            ))}
            <div className="art-add">
              <Select value={nuevoTipo} onChange={(e) => setNuevoTipo(e.target.value as Bloque["tipo"])}>
                {TIPOS.map((t) => (
                  <option key={t.tipo} value={t.tipo}>{t.label}</option>
                ))}
              </Select>
              <Btn kind="ghost" sm onClick={agregarBloque}>+ bloque</Btn>
              <Btn kind="ghost" sm onClick={traerDatos} disabled={busy}>⭳ Traer datos de mercado</Btn>
            </div>
          </div>

          {/* Acciones */}
          <div className="art-acciones">
            <Btn onClick={guardar} disabled={busy}>{busy ? "Guardando…" : "Guardar artículo"}</Btn>
            {slugAnterior && <Btn kind="ghost" onClick={clonar} disabled={busy}>Clonar del anterior</Btn>}
          </div>
        </div>

        {/* ── Columna de preview ── */}
        <div className="art-preview">
          <div className="art-preview-hd">Vista previa</div>
          <div className="art-preview-frame">
            {previewListo ? (
              <ArticuloInforme informe={informePreview} contenido={preview} />
            ) : (
              <p className="adm-help">Escribí el titular o agregá un bloque para ver la vista previa.</p>
            )}
          </div>
        </div>
      </div>

      <style>{`
        .art-editor { margin-top: 16px; }
        .art-cols { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 24px; }
        @media (max-width: 1100px) { .art-cols { grid-template-columns: 1fr; } }
        .art-form { display: flex; flex-direction: column; gap: 14px; min-width: 0; }
        .art-grid1 { display: grid; gap: 10px; }
        .art-grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .art-grid3 { display: grid; grid-template-columns: 80px 1fr 1fr; gap: 12px; }
        .art-grid-res { display: grid; grid-template-columns: 130px 1fr auto; gap: 8px; align-items: center; margin-bottom: 8px; }
        .art-ta { width: 100%; resize: vertical; line-height: 1.5; font-family: inherit; }
        .art-json { font-family: var(--font-mono), monospace; font-size: 12px; }
        .art-hint, .art-err { font-size: 11.5px; margin: 0 0 6px; }
        .art-hint { color: var(--site-ink-3); }
        .art-err { color: var(--neg); margin-top: 6px; }
        .art-sec { border-top: 1px solid var(--site-border); padding-top: 14px; margin-top: 4px; }
        .art-sec-hd { font-size: 11px; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; color: var(--gold-deep); margin-bottom: 12px; }
        .art-bloque { border: 1px solid var(--site-border); border-radius: 6px; padding: 12px; margin-bottom: 10px; }
        .art-bloque-hd { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
        .art-bloque-tipo { font-size: 12px; font-weight: 600; color: var(--site-ink-2); }
        .art-bloque-acc { display: flex; gap: 6px; }
        .art-add { display: flex; gap: 8px; align-items: center; margin-top: 6px; }
        .art-acciones { display: flex; gap: 10px; border-top: 1px solid var(--site-border); padding-top: 16px; margin-top: 6px; }
        .art-preview { min-width: 0; }
        .art-preview-hd { font-size: 11px; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; color: var(--gold-deep); margin-bottom: 10px; }
        .art-preview-frame { border: 1px solid var(--site-border); border-radius: 8px; overflow: auto; max-height: 78vh; background: #fff; }
        /* El artículo trae su propio padding de masthead (calc(nav-h + …)); en el
           marco de preview no hay navbar, así que lo neutralizamos. */
        .art-preview-frame .inf-mast { padding-top: 28px; }
      `}</style>
    </div>
  );
}
