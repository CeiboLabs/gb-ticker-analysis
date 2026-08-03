"use client";

// Documentos del fondo. El CATÁLOGO es fijo y se lista SIEMPRE completo: los
// documentos aparecen publicados o no. Cada uno se resuelve por DOS caminos, en
// este orden:
//
//   1. el API — lo que el panel publicó, con el flag `fondo_documentos`
//      prendido: se descarga same-origin desde /api/fondo/documentos/[tipo];
//   2. la lista estática (lib/fondoDocsEstaticos.ts) — los PDFs que viajan en el
//      deploy como archivos de public/: se descargan de su propia ruta.
//
// El resto se sigue pidiendo a un asesor, como hasta ahora. Así publicar UNO no
// borra los otros de la página, que es justo lo que pasaba cuando la lista salía
// sólo del API.
//
// El camino 2 existe porque en el sitio del fondo el API responde SIEMPRE vacío:
// vive en otra cuenta de Cloudflare, sin R2 y sin puente desde el panel. El
// porqué completo y su costo están en lib/fondoDocsEstaticos.ts.

import { useEffect, useState } from "react";
import { ArrowRight, FileDown } from "@/components/institucional/icons";
import { DOCS_ESTATICOS_POR_TIPO } from "@/lib/fondoDocsEstaticos";
import type { FondoDocTipo } from "@/lib/panelSchemas";

// Catálogo canónico: define el orden de la página y el copy de cada documento.
// El título lo puede pisar el panel al subir el archivo; la descripción sale
// siempre de acá (el panel no la edita).
// ⚠️ "Datos fundamentales para el inversor" salió del catálogo (2026-07-27): es
// un documento del régimen europeo (el KIID), no existe en el marco uruguayo ni
// surge del Reglamento de este Fondo. Ofrecerlo con acción "Solicitar" prometía
// un documento que nadie puede entregar. El tipo sigue existiendo en
// lib/panelSchemas.ts por compatibilidad; si el fondo llega a publicar un
// documento equivalente, vuelve acá con su nombre real.
// ⚠️ "Informe de cartera" salió del catálogo (2026-07-28). Mismo criterio: el
// tipo sigue vivo en el schema y en el panel, así que basta con volver a
// agregar la fila acá el día que haya un informe para publicar.
const CATALOGO: { tipo: FondoDocTipo; titulo: string; desc: string }[] = [
  { tipo: "ficha-tecnica", titulo: "Factsheet", desc: "Resumen mensual de BNG Selección Global: objetivo, cartera y datos clave." },
  { tipo: "reglamento", titulo: "Reglamento de gestión", desc: "Marco legal del Fondo: política de inversión, suscripción, rescate y comisiones. Autorizado por el Banco Central del Uruguay el 7 de julio de 2026." },
  { tipo: "autorizacion-bcu", titulo: "Autorización del Banco Central", desc: "Resolución RR-SSF-2026-434: aprueba el Reglamento, inscribe al Fondo en el Registro del Mercado de Valores y lo habilita para oferta pública." },
];

type DocPublico = {
  tipo: string;
  titulo: string;
  descripcion: string | null;
  actualizado: number | null;
  bytes: number | null;
};

/** "PDF · 1,2 MB · Actualizado 22/07/2026" — lo que se sabe del archivo, nada más. */
function metaLinea(d: { bytes: number | null; actualizado: number | null }): string {
  const partes = ["PDF"];
  if (d.bytes) {
    const mb = d.bytes / 1024 / 1024;
    partes.push(mb >= 1 ? `${mb.toFixed(1).replace(".", ",")} MB` : `${Math.max(1, Math.round(d.bytes / 1024))} KB`);
  }
  if (d.actualizado) {
    const f = new Date(d.actualizado).toLocaleDateString("es-UY", { day: "2-digit", month: "2-digit", year: "numeric" });
    partes.push(`Actualizado ${f}`);
  }
  return partes.join(" · ");
}

/** `casa`: ver lib/sitios.ts — contacto vive en el sitio institucional. */
export function FondoDocumentos({ casa }: { casa: string }) {
  const [publicados, setPublicados] = useState<Record<string, DocPublico>>({});
  // Hasta saber qué hay publicado no se muestra ninguna acción: mostrar
  // "Solicitar" y corregirlo a "Descargar" un instante después sería mentirle
  // al lector. El alto de la fila lo fijan título y descripción, así que la
  // acción entra sin mover nada.
  //
  // La espera es sólo para los documentos que dependen del API. Los que viajan
  // en el deploy ya se sabe que se descargan —el archivo está ahí—, así que su
  // acción sale en el render del server: nada que corregir después, y de paso el
  // href queda en el HTML, que es de donde scripts/build-fondo.mts recolecta los
  // assets a publicar.
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let alive = true;
    fetch("/api/fondo/documentos")
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { documentos?: DocPublico[] } | null) => {
        if (!alive) return;
        if (j?.documentos?.length) {
          setPublicados(Object.fromEntries(j.documentos.map((d) => [d.tipo, d])));
        }
      })
      .catch(() => {
        /* fallback silencioso: todo el catálogo queda en "Solicitar" */
      })
      .finally(() => {
        if (alive) setCargando(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="ui-list" style={{ marginTop: 48 }}>
      {CATALOGO.map((doc) => {
        const pub = publicados[doc.tipo];
        const est = DOCS_ESTATICOS_POR_TIPO[doc.tipo];
        // El API tiene precedencia: donde el panel gobierna, gobierna. La lista
        // estática entra sólo si el API no trajo este tipo.
        const descarga = pub ? `/api/fondo/documentos/${doc.tipo}` : est?.archivo;
        const meta = pub ?? est;
        const cuerpo = (
          <>
            <span className="fondo-doc-main">
              <span className="list-icon" aria-hidden><FileDown /></span>
              <span>
                <span className="row-title">{pub?.titulo ?? doc.titulo}</span>
                <span className="row-desc" style={{ display: "block" }}>{pub?.descripcion ?? doc.desc}</span>
                {meta && <span className="fondo-doc-meta">{metaLinea(meta)}</span>}
              </span>
            </span>
            {(!cargando || est) && (
              <span className="link-arrow fondo-doc-tag" style={{ pointerEvents: "none" }}>
                {descarga ? "Descargar" : "Solicitar"} <ArrowRight />
              </span>
            )}
          </>
        );

        return descarga ? (
          <a
            key={doc.tipo}
            href={descarga}
            target="_blank"
            rel="noopener noreferrer"
            className="ui-list-row fondo-doc-row"
          >
            {cuerpo}
          </a>
        ) : (
          <a key={doc.tipo} href={`${casa}/contacto`} className="ui-list-row fondo-doc-row">
            {cuerpo}
          </a>
        );
      })}
    </div>
  );
}
