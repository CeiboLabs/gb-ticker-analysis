"use client";

import {
  useId,
  useRef,
  useState,
  useEffect,
  type ReactNode,
  type CSSProperties,
  type MouseEvent,
} from "react";

/**
 * Material "liquid glass" (réplica web del material de Apple).
 *
 * Capas: refracción → tinte → rim especular → contenido (estilos .lqg* en
 * globals.css). La refracción usa un MAPA DE DESPLAZAMIENTO generado por
 * elemento según su tamaño real:
 *  - centro neutro (#808080) → el contenido del fondo se ve limpio
 *  - rampas solo en el bisel de los bordes → el fondo se "dobla" en el
 *    canto del vidrio, como una lente (el rasgo distintivo del material)
 *  - tres pasadas de displacement con escalas distintas por canal RGB →
 *    aberración cromática sutil en los bordes
 * Safari no soporta filter:url() sobre backdrops y cae a blur+saturación.
 */

/** Ancho del bisel refractivo, en px. */
const BEVEL = 12;
/** Intensidad del lensing (offset máx ≈ scale/2 px en el borde). */
const SCALE = 64;
/** Separación de canales para la aberración cromática (1 = sin CA). */
const CA = 1.12;

function buildDisplacementMap(w: number, h: number, r: number) {
  const rx = Math.min(r, h / 2, w / 2);
  const inner = Math.max(rx - BEVEL, 0);
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">` +
    `<defs>` +
    `<linearGradient id="gx" x1="0" y1="0" x2="1" y2="0">` +
    `<stop offset="0" stop-color="#ff0000"/><stop offset="1" stop-color="#000000"/>` +
    `</linearGradient>` +
    `<linearGradient id="gy" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="#00ff00"/><stop offset="1" stop-color="#000000"/>` +
    `</linearGradient>` +
    `</defs>` +
    // Rampas de desplazamiento (R = eje X, G = eje Y) en toda la superficie…
    `<rect width="${w}" height="${h}" fill="#000000"/>` +
    `<rect width="${w}" height="${h}" fill="url(#gx)"/>` +
    `<rect width="${w}" height="${h}" fill="url(#gy)" style="mix-blend-mode:screen"/>` +
    // …anuladas por un centro neutro blureado: solo queda el bisel activo.
    `<rect x="${BEVEL}" y="${BEVEL}" width="${w - BEVEL * 2}" height="${h - BEVEL * 2}" rx="${inner}" fill="#808080" style="filter:blur(${Math.round(BEVEL * 0.55)}px)"/>` +
    `</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export function Glass({
  children,
  className,
  contentClassName,
  style,
  radius = 999,
  variant = "dark",
  interactive = false,
}: {
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  style?: CSSProperties;
  /** Radio del vidrio (999 = pill). */
  radius?: number;
  /** dark: sobre media/navy · light: sobre fondos claros con textura. */
  variant?: "dark" | "light";
  /** Hover: micro-escala + destello que sigue al cursor. */
  interactive?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const rawId = useId();
  const id = `lqg${rawId.replace(/[^a-zA-Z0-9]/g, "")}`;
  const [dim, setDim] = useState<{ w: number; h: number } | null>(null);

  // Mide el elemento para generar el mapa de lensing a su tamaño exacto.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      const w = Math.round(width);
      const h = Math.round(height);
      if (w > 0 && h > 0) {
        setDim((d) => (d && d.w === w && d.h === h ? d : { w, h }));
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const onMove = (e: MouseEvent) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${((e.clientX - r.left) / r.width) * 100}%`);
    el.style.setProperty("--my", `${((e.clientY - r.top) / r.height) * 100}%`);
  };

  return (
    <div
      ref={ref}
      onMouseMove={interactive ? onMove : undefined}
      className={`lqg lqg-${variant}${interactive ? " lqg-int" : ""}${className ? ` ${className}` : ""}`}
      style={{ ...style, borderRadius: radius }}
    >
      {/* Filtro de lensing propio de esta instancia (tamaño exacto) */}
      {dim && (
        <svg style={{ position: "absolute", width: 0, height: 0 }} aria-hidden>
          <filter
            id={id}
            x="-30%"
            y="-30%"
            width="160%"
            height="160%"
            colorInterpolationFilters="sRGB"
          >
            <feImage
              href={buildDisplacementMap(dim.w, dim.h, radius)}
              x="0"
              y="0"
              width={dim.w}
              height={dim.h}
              preserveAspectRatio="none"
              result="map"
            />
            {/* Aberración cromática: una pasada por canal con escala distinta */}
            <feDisplacementMap in="SourceGraphic" in2="map" scale={SCALE * CA} xChannelSelector="R" yChannelSelector="G" result="dr" />
            <feColorMatrix in="dr" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="r" />
            <feDisplacementMap in="SourceGraphic" in2="map" scale={SCALE} xChannelSelector="R" yChannelSelector="G" result="dg" />
            <feColorMatrix in="dg" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="g" />
            <feDisplacementMap in="SourceGraphic" in2="map" scale={SCALE / CA} xChannelSelector="R" yChannelSelector="G" result="db" />
            <feColorMatrix in="db" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="b" />
            <feBlend in="r" in2="g" mode="screen" result="rg" />
            <feBlend in="rg" in2="b" mode="screen" />
          </filter>
        </svg>
      )}

      <span
        className="lqg-effect"
        aria-hidden
        style={{ borderRadius: radius, filter: dim ? `url(#${id})` : undefined }}
      />
      <span className="lqg-tint" aria-hidden style={{ borderRadius: radius }} />
      <span className="lqg-shine" aria-hidden style={{ borderRadius: radius }} />
      <div className={`lqg-content${contentClassName ? ` ${contentClassName}` : ""}`}>{children}</div>
    </div>
  );
}
