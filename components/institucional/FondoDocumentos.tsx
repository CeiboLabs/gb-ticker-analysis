"use client";

// Documentos del fondo, data-driven: si el panel publicó archivos (y el flag
// `fondo_documentos` está prendido), cada fila descarga el PDF same-origin
// desde /api/fondo/documentos/[tipo]; si no hay nada publicado, flag apagado o
// el fetch falla, cae EXACTAMENTE al render histórico ("Solicitar" → /contacto).
// La página del fondo sigue 100% estática — el estado vive en este cliente.

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, FileDown } from "@/components/institucional/icons";

// Fallback = los cuatro documentos ofrecidos a pedido, como hasta ahora.
const FALLBACK: { titulo: string; desc: string }[] = [
  { titulo: "Ficha técnica", desc: "Resumen mensual del fondo: objetivo, cartera y datos clave." },
  { titulo: "Datos fundamentales para el inversor", desc: "Documento con el perfil de riesgo, costos y características esenciales." },
  { titulo: "Reglamento de gestión", desc: "Marco legal del fondo: política de inversión, suscripción y rescate." },
  { titulo: "Informe de cartera", desc: "Composición de la cartera y comentario de gestión del período." },
];

type DocPublico = { tipo: string; titulo: string; descripcion: string | null };

export function FondoDocumentos() {
  const [docs, setDocs] = useState<DocPublico[] | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/fondo/documentos")
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { documentos?: DocPublico[] } | null) => {
        if (alive && j?.documentos?.length) setDocs(j.documentos);
      })
      .catch(() => {
        /* fallback silencioso */
      });
    return () => {
      alive = false;
    };
  }, []);

  if (docs) {
    return (
      <div className="ui-list" style={{ marginTop: 48 }}>
        {docs.map((doc) => (
          <a
            key={doc.tipo}
            href={`/api/fondo/documentos/${doc.tipo}`}
            target="_blank"
            rel="noopener noreferrer"
            className="ui-list-row fondo-doc-row"
          >
            <span style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
              <span className="list-icon" aria-hidden><FileDown /></span>
              <span>
                <span className="row-title">{doc.titulo}</span>
                {doc.descripcion && <span className="row-desc" style={{ display: "block" }}>{doc.descripcion}</span>}
              </span>
            </span>
            <span className="link-arrow fondo-doc-tag" style={{ pointerEvents: "none" }}>
              Descargar <ArrowRight />
            </span>
          </a>
        ))}
      </div>
    );
  }

  return (
    <div className="ui-list" style={{ marginTop: 48 }}>
      {FALLBACK.map((doc) => (
        <Link key={doc.titulo} href="/contacto" className="ui-list-row fondo-doc-row">
          <span style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
            <span className="list-icon" aria-hidden><FileDown /></span>
            <span>
              <span className="row-title">{doc.titulo}</span>
              <span className="row-desc" style={{ display: "block" }}>{doc.desc}</span>
            </span>
          </span>
          <span className="link-arrow fondo-doc-tag" style={{ pointerEvents: "none" }}>
            Solicitar <ArrowRight />
          </span>
        </Link>
      ))}
    </div>
  );
}
