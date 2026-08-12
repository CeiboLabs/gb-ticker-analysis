"use client";

import { useState } from "react";
import Link from "next/link";
import { Stagger, StaggerItem } from "@/components/motion";
import { ArrowRight, Calendar, Clock } from "@/components/institucional/icons";
import { VideoEmbed } from "@/components/institucional/VideoEmbed";
import { tieneArticulo } from "@/lib/informeContenido";
import type { Informe } from "@/lib/informes";

// El filtro reusa la `categoria` del informe como id ("Semanal"/"Mensual"), más
// "todos" para el estado sin filtrar. Así el filtrado es una igualdad directa
// contra it.categoria, sin mapeos.
type Filtro = "todos" | Informe["categoria"];

const TABS: { id: Filtro; label: string }[] = [
  { id: "todos", label: "Todos" },
  { id: "Semanal", label: "Semanales" },
  { id: "Mensual", label: "Mensuales" },
];

/**
 * Archivo de /informes con filtro por tipo. La LISTA se resuelve en el server
 * (D1 o seed) y baja entera por props; el filtro vive en el cliente y sólo
 * decide qué filas se muestran — no recarga, no toca la URL. Las keys estables
 * por slug hacen que las filas que permanecen no se remonten (los iframes de
 * los mensuales no se recargan al alternar entre Todos y Mensuales).
 */
export function ArchivoInformes({ informes }: { informes: Informe[] }) {
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const visibles = filtro === "todos" ? informes : informes.filter((i) => i.categoria === filtro);
  const n = visibles.length;

  return (
    <div className="inf-archivo">
      {/* Barra: recuento (izq) + segmentado (der) — mismo patrón que el toggle
          Treemap/Donut del fondo: pista pill, thumb navy deslizante, tabs con
          aria-selected. */}
      <div className="inf-bar">
        <span className="inf-count" aria-live="polite">
          {n} {n === 1 ? "edición" : "ediciones"}
        </span>
        <div className="inf-filtro" data-active={filtro} role="tablist" aria-label="Filtrar informes por tipo">
          <span className="inf-filtro-thumb" aria-hidden />
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={filtro === t.id}
              className="inf-filtro-btn"
              onClick={() => setFiltro(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {n === 0 ? (
        <p className="inf-empty">No hay informes en esta categoría por ahora.</p>
      ) : (
        // key={filtro} REMONTA la lista en cada cambio: el Stagger usa
        // whileInView con once:true, así que un hijo agregado por el filtro se
        // montaría heredando el estado `hidden` (opacity 0) del contenedor —que
        // ya disparó su animación única— y quedaría invisible. Remontar reevalúa
        // el whileInView (la lista está a la vista al tocar el filtro) y la nueva
        // selección entra animada. Mismo patrón que `ten-stage key={vista}` del
        // fondo; VideoEmbed es un facade, así que remontarlo no recarga nada.
        <Stagger key={filtro} as="div" className="ui-list">
          {visibles.map((it) => {
            const conArticulo = tieneArticulo(it.slug);

            // Mensual con su video de presentación → fila enriquecida con el
            // video embebido (SOLO mensuales; los semanales no llevan video).
            // El video es ese mismo informe, presentado en el canal de la casa:
            // cuerpo (meta + título + acceso al documento) a la izquierda,
            // video 16:9 a la derecha.
            if (it.categoria === "Mensual" && it.videoId) {
              return (
                <StaggerItem as="div" key={it.slug}>
                  <div className="ui-list-row informe-row--video">
                    <div className="ivid-body">
                      <span className="informe-meta">
                        <span className="t-small informe-fecha">{it.fechaTexto.split(",")[0]}</span>
                        <span className="ui-tag">{it.categoria}</span>
                      </span>
                      <span className="row-title" style={{ display: "block", marginTop: 8 }}>{it.titulo}</span>
                      {conArticulo ? (
                        <Link href={`/informes/${it.slug}`} className="link-arrow" style={{ marginTop: 18 }}>
                          Leer el informe <ArrowRight />
                        </Link>
                      ) : (
                        <a
                          href={`/informes/${it.slug}/pdf`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="link-arrow"
                          style={{ marginTop: 18 }}
                        >
                          Ver el informe en PDF <ArrowRight />
                        </a>
                      )}
                    </div>
                    <div className="ivid-media">
                      <VideoEmbed videoId={it.videoId} title={`Presentación · ${it.titulo}`} />
                    </div>
                  </div>
                </StaggerItem>
              );
            }

            // Fila: el contenido es idéntico; sólo cambia el envoltorio. Con
            // artículo → navegación interna a /informes/[slug]. Sin él (aún) →
            // el PDF en el visor nativo, servido desde nuestro dominio vía el
            // proxy (no salta a gbengochea).
            const inner = (
              <>
                {/* El flex de este envoltorio vivía inline. Pasó a .informe-main
                    (en la hoja de la página) porque en el teléfono la fila se
                    reacomoda como grilla y necesita pisar este display —y un
                    estilo inline no lo puede pisar una media query. */}
                <span className="informe-main">
                  <span className="list-icon" aria-hidden>
                    {it.categoria === "Mensual" ? <Calendar /> : <Clock />}
                  </span>
                  <span className="informe-body">
                    <span className="informe-meta">
                      <span className="t-small informe-fecha">{it.fechaTexto.split(",")[0]}</span>
                      <span className="ui-tag">{it.categoria}</span>
                    </span>
                    <span className="row-title" style={{ display: "block", marginTop: 8 }}>{it.titulo}</span>
                  </span>
                </span>
                <span className="link-arrow informe-cta">
                  {conArticulo ? "Leer informe" : "Ver PDF"} <ArrowRight />
                </span>
              </>
            );
            return (
              <StaggerItem as="div" key={it.slug}>
                {conArticulo ? (
                  <Link href={`/informes/${it.slug}`} className="ui-list-row informe-row">
                    {inner}
                  </Link>
                ) : (
                  <a
                    href={`/informes/${it.slug}/pdf`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ui-list-row informe-row"
                  >
                    {inner}
                  </a>
                )}
              </StaggerItem>
            );
          })}
        </Stagger>
      )}
    </div>
  );
}
