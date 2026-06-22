"use client";

/* Hero de /analisis — patrón "plataforma que emerge": título centrado con
   blur-reveal y la preview del reporte (ReportPreviewMini) asomando desde el
   borde inferior; al scrollear, el reporte sube, se endereza (rotateX → 0) y
   ocupa el centro mientras el título se desvanece hacia arriba. Sección
   pinneada: todo el recorrido es scrubbing, avanza y retrocede con el scroll. */

import type { CSSProperties } from "react";
import { useEffect, useRef, useState } from "react";
import {
  motion,
  useReducedMotion,
  useTransform,
  type MotionValue,
} from "framer-motion";
import { SplitText, PinnedSection, scrollWindow } from "@/components/scroll";
import { TickerSearch } from "@/components/TickerSearch";
import { ReportPreviewMini } from "./ReportPreviewMini";

const EASE = [0.16, 1, 0.3, 1] as const;

/* Mismo fondo que .media-ph (globals.css), aplicado directo al sticky para
   no depender de z-index negativos dentro del stacking context del pin. */
const NAVY_BG: CSSProperties = {
  background:
    "radial-gradient(120% 90% at 80% 0%, rgba(201,168,76,0.14), transparent 55%)," +
    "linear-gradient(135deg, #02043F 0%, var(--navy) 45%, #0A0E78 100%)",
};

export function AnalisisHero({ onSearch }: { onSearch: (ticker: string) => void }) {
  const reduce = useReducedMotion();

  if (reduce) {
    // Sin pin ni transforms: copy arriba, reporte completo debajo.
    return (
      <header className="site band-navy" style={NAVY_BG}>
        <div
          className="site-wrap"
          style={{
            paddingTop: "calc(var(--nav-h) + 64px)",
            paddingBottom: 72,
          }}
        >
          <HeroCopy onSearch={onSearch} />
          <div style={{ width: "min(820px, 100%)", margin: "56px auto 0" }}>
            <ReportPreviewMini />
          </div>
        </div>
      </header>
    );
  }

  return (
    <PinnedSection
      height={280}
      style={{ background: "var(--navy)" }}
      contentStyle={{ ...NAVY_BG, justifyContent: "flex-start" }}
    >
      {(progress) => <HeroPinned progress={progress} onSearch={onSearch} />}
    </PinnedSection>
  );
}

/* Callouts que explican cada sección del reporte una vez asentado.
   Ventanas sobre el progress del pin: entran escalonados y retroceden
   con el scroll. Solo desktop ancho (se ocultan si no hay margen). */
const CALLOUTS: {
  side: "left" | "right";
  top: number; // % de la altura del reporte
  window: [number, number];
  title: string;
  body: string;
}[] = [
  {
    side: "left",
    top: 22,
    window: [0.56, 0.66],
    title: "Veredicto",
    body: "BUY · HOLD · AVOID con precio objetivo a 12 meses y convicción declarada.",
  },
  {
    side: "right",
    top: 18,
    window: [0.63, 0.73],
    title: "Tesis de inversión",
    body: "El argumento que sostiene la recomendación, en lenguaje propio.",
  },
  {
    side: "right",
    top: 76,
    window: [0.7, 0.8],
    title: "Métricas y KPIs",
    body: "Doce indicadores clave — múltiplos, márgenes, FCF — desde Yahoo Finance.",
  },
];

function HeroPinned({
  progress,
  onSearch,
}: {
  progress: MotionValue<number>;
  onSearch: (ticker: string) => void;
}) {
  // Título: se va hacia arriba y se apaga mientras el reporte lo cubre.
  const to = scrollWindow(0.04, 0.36, 1, 0.05);
  const ty = scrollWindow(0.04, 0.36, 0, -70);
  const titleOpacity = useTransform(progress, to.times, to.values);
  const titleY = useTransform(progress, ty.times, ty.values);
  const titleEvents = useTransform(progress, (p) =>
    p > 0.2 ? ("none" as const) : ("auto" as const),
  );

  // Reporte: asoma desde el borde inferior, sube y se endereza. El reposo
  // (y=0) es el centro vertical del viewport — el wrapper centra por flex,
  // así queda centrado en cualquier altura de pantalla, lejos del navbar.
  // Se asienta en 0.52: el resto del recorrido es de los callouts.
  //
  // El offset de asomada NO puede ser un `vh` fijo: el copy (kicker + título +
  // lead + buscador) mide píxeles constantes, así que en pantallas bajas un
  // `70vh` empuja pocos píxeles y el borde del reporte pisa el input. Lo
  // medimos: el reporte arranca siempre PEEK px por encima del borde inferior,
  // pero nunca más arriba que GAP px debajo del copy. Cubre desktop (centrado)
  // y mobile (anclado arriba) por igual, porque se basa en offsetTop real.
  const copyRef = useRef<HTMLDivElement>(null);
  const reportRef = useRef<HTMLDivElement>(null);
  const [peekOffset, setPeekOffset] = useState(520);

  useEffect(() => {
    const PEEK = 120; // sliver del reporte visible sobre el borde inferior
    const GAP = 24; //   aire mínimo entre el copy y el tope del reporte
    const compute = () => {
      const copy = copyRef.current;
      const report = reportRef.current;
      if (!copy || !report) return;
      // Coords de viewport en reposo (progress 0), independientes del scroll:
      // offsetTop ignora los transforms de framer y mide el layout real.
      const copyBottom = copy.offsetTop + copy.offsetHeight;
      const baseTop = report.offsetTop; // centro (desktop) o padTop (mobile)
      const reportTop = Math.max(copyBottom + GAP, window.innerHeight - PEEK);
      setPeekOffset(Math.max(0, reportTop - baseTop));
    };
    compute();
    window.addEventListener("resize", compute);
    const ro = new ResizeObserver(compute);
    if (copyRef.current) ro.observe(copyRef.current);
    if (reportRef.current) ro.observe(reportRef.current);
    return () => {
      window.removeEventListener("resize", compute);
      ro.disconnect();
    };
  }, []);

  const py = scrollWindow(0, 0.52, peekOffset, 0);
  const ps = scrollWindow(0, 0.52, 0.96, 1);
  const pr = scrollWindow(0, 0.42, 9, 0);
  const previewY = useTransform(progress, py.times, py.values);
  const previewScale = useTransform(progress, ps.times, ps.values);
  const previewRotateX = useTransform(progress, pr.times, pr.values);

  return (
    <div className="site" style={{ position: "relative", width: "100%", height: "100%" }}>
      <motion.div
        ref={copyRef}
        className="site-wrap"
        style={{
          position: "relative",
          zIndex: 1,
          paddingTop: "calc(var(--nav-h) + clamp(28px, 5vh, 64px))",
          y: titleY,
          opacity: titleOpacity,
          pointerEvents: titleEvents,
        }}
      >
        <HeroCopy onSearch={onSearch} animated />
      </motion.div>

      {/* Preview de la plataforma. pointer-events off: mientras asoma se
          superpone a la zona del buscador y no debe robarle el click. */}
      <motion.div
        aria-hidden
        className="ah-preview-wrap"
        style={{
          y: previewY,
          scale: previewScale,
          rotateX: previewRotateX,
          transformPerspective: 1400,
        }}
      >
        <motion.div
          ref={reportRef}
          style={{ width: "min(820px, 92vw)", position: "relative" }}
          initial={{ opacity: 0, y: 36 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: EASE, delay: 0.55 }}
        >
          <ReportPreviewMini />
          {CALLOUTS.map((c) => (
            <Callout key={c.title} progress={progress} {...c} />
          ))}
        </motion.div>
      </motion.div>

      <style>{`
        .ah-preview-wrap {
          position: absolute;
          inset: 0;
          z-index: 2;
          display: flex;
          align-items: center;
          justify-content: center;
          pointer-events: none;
          /* Centrar en la franja real (debajo del nav → borde inferior), no
             en el viewport completo: el padding sube el eje de centrado. */
          padding-top: var(--nav-h);
        }
        /* En mobile el reporte es más alto que el viewport: centrarlo
           escondería el veredicto. Se ancla arriba, bajo el navbar. */
        @media (max-width: 860px) {
          .ah-preview-wrap {
            align-items: flex-start;
            padding-top: calc(var(--nav-h) + 18px);
          }
        }
        .ah-callout {
          position: absolute;
          /* Crece con el viewport hasta 230px; nunca pisa el reporte. */
          width: calc((100vw - 884px) / 2 - 56px);
          max-width: 230px;
        }
        .ah-callout[data-side="left"]  { right: calc(100% + 56px); text-align: right; }
        .ah-callout[data-side="right"] { left: calc(100% + 56px); }
        .ah-callout-title {
          font-family: var(--font-mono), monospace;
          font-size: 10px; letter-spacing: 0.16em; text-transform: uppercase;
          color: var(--gold-soft);
        }
        .ah-callout-body {
          margin-top: 6px;
          font-size: 13px; line-height: 1.5;
          color: rgba(255,255,255,0.75);
        }
        /* Línea conectora + punta de flecha hacia el reporte */
        .ah-callout-line {
          position: absolute; top: 7px; height: 1px; width: 40px;
          background: var(--gold-soft); opacity: 0.65;
        }
        .ah-callout[data-side="left"]  .ah-callout-line { left: calc(100% + 6px); }
        .ah-callout[data-side="right"] .ah-callout-line { right: calc(100% + 6px); }
        .ah-callout-tip {
          position: absolute; top: 4px; width: 7px; height: 7px;
          border-top: 1px solid var(--gold-soft);
          border-right: 1px solid var(--gold-soft);
          opacity: 0.85;
        }
        .ah-callout[data-side="left"]  .ah-callout-tip { left: calc(100% + 40px); transform: rotate(45deg); }
        .ah-callout[data-side="right"] .ah-callout-tip { right: calc(100% + 40px); transform: rotate(-135deg); }
        /* Sin margen lateral suficiente, los callouts no aportan: fuera. */
        @media (max-width: 1240px) { .ah-callout { display: none; } }
      `}</style>
    </div>
  );
}

function Callout({
  progress,
  side,
  top,
  window: win,
  title,
  body,
}: {
  progress: MotionValue<number>;
  side: "left" | "right";
  top: number;
  window: [number, number];
  title: string;
  body: string;
}) {
  const [s, e] = win;
  const ow = scrollWindow(s, e, 0, 1);
  const xw = scrollWindow(s, e, side === "left" ? -14 : 14, 0);
  const lw = scrollWindow(s, e, 0, 1);
  const opacity = useTransform(progress, ow.times, ow.values);
  const x = useTransform(progress, xw.times, xw.values);
  const lineScale = useTransform(progress, lw.times, lw.values);

  return (
    <motion.div
      className="ah-callout"
      data-side={side}
      style={{ top: `${top}%`, opacity, x }}
    >
      {/* La línea se dibuja desde el label hacia el reporte */}
      <motion.span
        aria-hidden
        className="ah-callout-line"
        style={{
          scaleX: lineScale,
          transformOrigin: side === "left" ? "left center" : "right center",
        }}
      />
      <span aria-hidden className="ah-callout-tip" />
      <div className="ah-callout-title">{title}</div>
      <div className="ah-callout-body">{body}</div>
    </motion.div>
  );
}

/* Copy compartido entre la variante pinneada y la estática (reduced motion). */
function HeroCopy({
  onSearch,
  animated = false,
}: {
  onSearch: (ticker: string) => void;
  animated?: boolean;
}) {
  const rise = (delay: number) =>
    animated
      ? {
          initial: { opacity: 0, y: 24 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.9, ease: EASE, delay },
        }
      : {};

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
      }}
    >
      <div className="kicker" style={{ color: "var(--gold-soft)" }}>
        Herramienta · Análisis de acciones
      </div>

      <h1
        className="t-display-xl t-serif-display"
        style={{ marginTop: 20, color: "#fff", maxWidth: "13ch" }}
      >
        {animated ? (
          <SplitText
            text="Equity research, en segundos."
            mode="enter"
            blur
            delay={0.1}
            stagger={0.09}
            as="span"
          />
        ) : (
          "Equity research, en segundos."
        )}
      </h1>

      <motion.p
        className="t-lead"
        style={{ marginTop: 24, color: "rgba(255,255,255,0.86)", maxWidth: "38em" }}
        {...rise(0.6)}
      >
        Cargá un ticker y obtené un reporte con veredicto, doce KPIs, Sankey del
        estado de resultados y consenso de Wall Street. Mismo rigor que un
        research sell-side, en lenguaje propio.
      </motion.p>

      <motion.div style={{ marginTop: 32, width: "min(560px, 100%)" }} {...rise(0.75)}>
        <TickerSearch variant="hero" onSubmit={onSearch} />
      </motion.div>

      <motion.p
        className="t-small"
        style={{ marginTop: 16, color: "rgba(255,255,255,0.7)" }}
        {...rise(0.85)}
      >
        Probá con AAPL · TSLA · MELI · KO
      </motion.p>
    </div>
  );
}
