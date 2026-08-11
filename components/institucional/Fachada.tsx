"use client";

import { useId } from "react";
import { PIECES, horizonPts, VW, VH } from "@/lib/fachada";

// Fachada — mosaico de paneles embutidos que hace de "cara" del fondo BNG
// Selección Global. Tesela 6×4 con los vértices interiores desplazados → 24
// cuadriláteros irregulares, graduados por valor: arriba más claro (renta
// variable, crece), abajo grave y anclado (renta fija, base). Un único
// HORIZONTE dorado cruza el centro de lado a lado (el equilibrio RV/RF).
//
// Extraído del hero (FondoHero) para reusarlo como miniatura en el destacado
// "Invertir" del navbar: el tile del dropdown es un recorte del MISMO edificio
// (misma semilla → mismas piezas), un preview espacial del destino.
//
// ── LA GEOMETRÍA VIVE EN lib/fachada.ts ──────────────────────────────────────
// Este archivo es `"use client"`, y desde el server sus exports son referencias
// de cliente, no valores. La card OG del fondo se dibuja en el build y necesita
// las MISMAS teselas, así que la malla, el ruido, la rampa tonal y el horizonte
// se mudaron a `lib/fachada.ts` —módulo puro, sin DOM— y acá quedó el componente.
// Lo público se reexporta abajo: los consumidores no cambiaron.

export {
  FACHADA_VIEWBOX,
  FACHADA_HORIZONTE,
  FACHADA_HORIZONTE_LEN,
  fachadaMascara,
} from "@/lib/fachada";

/**
 * Mosaico estático (sin animación de entrada) posicionado en absoluto para
 * llenar su contenedor. El caller controla el marco/scrim/escala.
 *
 * `crisp` fija los trazos con vector-effect non-scaling-stroke: se mantienen a
 * 1–2px aunque el mosaico se reduzca ~4× a la miniatura del navbar, donde si no
 * los bordes de los paneles y el horizonte se volverían sub-pixel y se perderían.
 * El hero lo deja en false → los trazos escalan como siempre (apariencia intacta).
 *
 * `pan` pasea la VENTANA del viewBox por dentro del mosaico (en unidades del
 * lienzo). Con `slice` el dibujo ya sobra fuera de la ventana, así que mientras
 * el corrimiento no exceda esa sobra no destapa nada: sirve para elegir QUÉ
 * tramo del edificio —y del horizonte— queda debajo de algo. Lo usa el hero
 * para apoyar el wordmark en un tramo plano de la línea dorada.
 */
export function Fachada({ className, crisp = false, pan }: { className?: string; crisp?: boolean; pan?: { x: number; y: number } }) {
  // Cada instancia del mosaico convive con el hero en la misma página (el navbar
  // es global): un id de pattern único evita que dos <pattern id> choquen.
  const uid = useId().replace(/:/g, "");
  const hatchId = `ffac-hatch-${uid}`;
  const vfx = crisp ? "non-scaling-stroke" : undefined;
  return (
    <svg
      className={className}
      // El hero ajusta este viewBox con un script inline ANTES de hidratar (así
      // el mosaico no salta al reencuadrarse), y la diferencia con el HTML del
      // server es deliberada. Sólo tapa los atributos de este <svg>: las
      // teselas de adentro se siguen chequeando —ahí sí un desajuste sería el
      // bug de hidratación que documenta el encabezado.
      viewBox={`${pan?.x ?? 0} ${pan?.y ?? 0} ${VW} ${VH}`}
      suppressHydrationWarning
      preserveAspectRatio="xMidYMid slice"
      aria-hidden
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block" }}
    >
      <defs>
        <pattern id={hatchId} width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(26)">
          <line x1="0" y1="0" x2="0" y2="9" stroke="rgba(255,255,255,0.045)" strokeWidth="1" />
        </pattern>
      </defs>
      {/* Teselas estáticas. */}
      {PIECES.map((p, idx) => (
        <polygon
          key={idx}
          points={p.pts}
          fill={p.fill}
          stroke="rgba(255,255,255,0.085)"
          strokeWidth={1}
          strokeLinejoin="round"
          vectorEffect={vfx}
        />
      ))}
      {/* Grabado fino sobre toda la fachada (textura material, no patrón). */}
      <rect x={0} y={0} width={VW} height={VH} fill={`url(#${hatchId})`} />
      {/* Horizonte dorado: único acento — el equilibrio RV/RF, de lado a lado.
          La clase es el asidero para que el hero lo TRACE al entrar; nadie más
          la usa, así que la miniatura del navbar sigue apareciendo dibujada. */}
      <polyline
        className="ffac-horizonte"
        points={horizonPts} fill="none" stroke="var(--gold)" strokeWidth={2}
        strokeLinejoin="round" strokeLinecap="round" opacity={0.92}
        vectorEffect={vfx}
      />
    </svg>
  );
}
