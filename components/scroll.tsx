"use client";

/**
 * Primitives de animación LIGADA al scroll (scrubbing) para el sitio
 * institucional. Complementan a components/motion.tsx (Reveal/Stagger/...),
 * que siguen siendo los indicados para entradas "al entrar en viewport".
 *
 * Reglas comunes:
 * - Solo se anima transform / opacity / clip-path (sin layout thrash).
 * - prefers-reduced-motion ⇒ se renderiza el estado final, estático.
 * - SSR-safe: el markup es determinista; los transforms van por motion values.
 * - PinnedSection usa render-prop ⇒ solo puede usarse DENTRO de otro
 *   client component (un server component no puede pasar funciones como props).
 */

import {
  motion,
  useScroll,
  useTransform,
  useReducedMotion,
  useMotionValue,
  type MotionValue,
} from "framer-motion";
import {
  Fragment,
  useRef,
  type ReactNode,
  type CSSProperties,
  type ElementType,
} from "react";

const EASE = [0.16, 1, 0.3, 1] as const;

/**
 * Mapea una ventana parcial [start, end] de un progress 0→1 cubriendo SIEMPRE
 * el rango completo. Necesario porque framer-motion v12 acelera los transforms
 * de scroll a WAAPI usando el inputRange como offsets de keyframes: si el
 * primer offset no es 0 (o el último no es 1), WAAPI inserta keyframes
 * implícitos con el valor del style subyacente y la animación "rebota"
 * (triángulo 0→1→0) en vez de sostener el valor final.
 */
export function scrollWindow<T extends number | string>(
  start: number,
  end: number,
  from: T,
  to: T,
): { times: number[]; values: T[] } {
  const times: number[] = [];
  const values: T[] = [];
  if (start > 0) {
    times.push(0);
    values.push(from);
  }
  times.push(start, end);
  values.push(from, to);
  if (end < 1) {
    times.push(1);
    values.push(to);
  }
  return { times, values };
}

/* ──────────────────────────────────────────────────────────────
   SplitText — titular revelado palabra por palabra.
   mode="enter": una vez, al montar (héroes above-the-fold).
   mode="scrub": ligado al progreso de scroll del propio elemento.
   ────────────────────────────────────────────────────────────── */

type SplitTextProps = {
  text: string;
  as?: ElementType;
  mode?: "enter" | "scrub";
  className?: string;
  style?: CSSProperties;
  /** Solo mode="enter": segundos entre palabras y delay inicial. */
  stagger?: number;
  delay?: number;
  /**
   * Solo mode="scrub": progress externo (p.ej. el de una PinnedSection,
   * donde el elemento queda clavado y su propio scroll no avanza) y la
   * ventana [start, end] de ese progress en la que ocurre el reveal.
   */
  progress?: MotionValue<number>;
  window?: [number, number];
};

export function SplitText({
  text,
  as: As = "span",
  mode = "scrub",
  className,
  style,
  stagger = 0.07,
  delay = 0,
  progress,
  window: win = [0, 1],
}: SplitTextProps) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start 0.92", "start 0.45"],
  });
  const driver = progress ?? scrollYProgress;
  const [winStart, winEnd] = progress ? win : [0, 1];
  const span = winEnd - winStart;

  const words = text.split(/\s+/).filter(Boolean);

  if (reduce) {
    return (
      <As className={className} style={style}>
        {text}
      </As>
    );
  }

  return (
    <As
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ref={ref as any}
      className={className}
      style={style}
      aria-label={text}
    >
      {words.map((word, i) => (
        <Fragment key={i}>
          <span aria-hidden className="st-mask">
            {mode === "enter" ? (
              <motion.span
                className="st-word"
                initial={{ y: "112%" }}
                animate={{ y: "0%" }}
                transition={{ duration: 0.9, ease: EASE, delay: delay + i * stagger }}
              >
                {word}
              </motion.span>
            ) : (
              <ScrubWord
                word={word}
                progress={driver}
                start={winStart + (i / words.length) * 0.65 * span}
                end={winStart + ((i / words.length) * 0.65 + 0.35) * span}
              />
            )}
          </span>
          {/* El espacio va FUERA del mask (inline-block): adentro colapsa. */}
          {i < words.length - 1 ? " " : null}
        </Fragment>
      ))}
    </As>
  );
}

function ScrubWord({
  word,
  progress,
  start,
  end,
}: {
  word: string;
  progress: MotionValue<number>;
  start: number;
  end: number;
}) {
  const yw = scrollWindow(start, end, "112%", "0%");
  const ow = scrollWindow(start, end, 0, 1);
  const y = useTransform(progress, yw.times, yw.values);
  const opacity = useTransform(progress, ow.times, ow.values);
  return (
    <motion.span className="st-word" style={{ y, opacity }}>
      {word}
    </motion.span>
  );
}

/* ──────────────────────────────────────────────────────────────
   PinnedSection — sección que se "clava" (sticky 100vh) mientras
   el contenedor alto scrollea; expone progress 0→1 para scrubbing.
   ────────────────────────────────────────────────────────────── */

export function PinnedSection({
  height = 260,
  className,
  style,
  contentClassName,
  contentStyle,
  children,
}: {
  /** Alto total del recorrido, en vh (≥ 150 para que el pin se sienta). */
  height?: number;
  className?: string;
  style?: CSSProperties;
  contentClassName?: string;
  contentStyle?: CSSProperties;
  children: (progress: MotionValue<number>) => ReactNode;
}) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end end"],
  });
  const done = useMotionValue(1);

  if (reduce) {
    // Sin pin: la sección fluye con altura natural y estado final.
    return (
      <section className={className} style={style}>
        <div className={contentClassName} style={contentStyle}>
          {children(done)}
        </div>
      </section>
    );
  }

  return (
    <section
      ref={ref}
      className={className}
      style={{ ...style, height: `${height}vh`, position: "relative" }}
    >
      <div
        className={contentClassName}
        style={{
          position: "sticky",
          top: 0,
          height: "100vh",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          ...contentStyle,
        }}
      >
        {children(scrollYProgress)}
      </div>
    </section>
  );
}

/* ──────────────────────────────────────────────────────────────
   ScrollCounter — número ligado a un progress (típicamente el de
   una PinnedSection): avanza/retrocede con el scroll.
   ────────────────────────────────────────────────────────────── */

export function ScrollCounter({
  progress,
  from,
  to,
  start = 0.05,
  end = 0.8,
  className,
  style,
}: {
  progress: MotionValue<number>;
  from: number;
  to: number;
  /** Ventana del progress en la que ocurre el conteo. */
  start?: number;
  end?: number;
  className?: string;
  style?: CSSProperties;
}) {
  const raw = useTransform(progress, [start, end], [from, to]);
  const text = useTransform(raw, (v) => String(Math.round(v)));
  return (
    <motion.span className={className} style={style}>
      {text}
    </motion.span>
  );
}

/* ──────────────────────────────────────────────────────────────
   ParallaxLayer — parallax scroll-driven (reemplaza al Parallax
   manual de motion.tsx donde se quiera scrubbing real).
   ────────────────────────────────────────────────────────────── */

export function ParallaxLayer({
  children,
  offset = 60,
  className,
  style,
}: {
  children: ReactNode;
  /** Recorrido total en px: +offset → -offset al cruzar el viewport. */
  offset?: number;
  className?: string;
  style?: CSSProperties;
}) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const y = useTransform(scrollYProgress, [0, 1], [offset, -offset]);

  return (
    <motion.div ref={ref} className={className} style={{ ...style, y: reduce ? 0 : y }}>
      {children}
    </motion.div>
  );
}

/* ──────────────────────────────────────────────────────────────
   ClipReveal — máscara clip-path que se abre con el scroll.
   ────────────────────────────────────────────────────────────── */

const CLIP_FROM: Record<string, string> = {
  bottom: "inset(100% 0 0 0)",
  top: "inset(0 0 100% 0)",
  left: "inset(0 100% 0 0)",
  right: "inset(0 0 0 100%)",
};

export function ClipReveal({
  children,
  from = "bottom",
  className,
  style,
}: {
  children: ReactNode;
  /** Borde desde el que se revela el contenido. */
  from?: "bottom" | "top" | "left" | "right";
  className?: string;
  style?: CSSProperties;
}) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start 0.95", "start 0.55"],
  });
  const clipPath = useTransform(
    scrollYProgress,
    [0, 1],
    [CLIP_FROM[from], "inset(0% 0 0 0)"],
  );

  return (
    <motion.div
      ref={ref}
      className={className}
      style={{ ...style, clipPath: reduce ? undefined : clipPath }}
    >
      {children}
    </motion.div>
  );
}

/* ──────────────────────────────────────────────────────────────
   DrawLine — hairline que se "dibuja" con el scroll (scaleX/scaleY).
   ────────────────────────────────────────────────────────────── */

export function DrawLine({
  axis = "x",
  thickness = 1,
  color = "var(--rule)",
  className,
  style,
}: {
  axis?: "x" | "y";
  thickness?: number;
  color?: string;
  className?: string;
  style?: CSSProperties;
}) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start 0.95", "start 0.5"],
  });
  const scale = useTransform(scrollYProgress, [0, 1], [0, 1]);

  const base: CSSProperties =
    axis === "x"
      ? { height: thickness, width: "100%", transformOrigin: "left center" }
      : { width: thickness, height: "100%", transformOrigin: "center top" };

  return (
    <motion.div
      ref={ref}
      aria-hidden
      className={className}
      style={{
        ...base,
        background: color,
        ...(axis === "x"
          ? { scaleX: reduce ? 1 : scale }
          : { scaleY: reduce ? 1 : scale }),
        ...style,
      }}
    />
  );
}

/* ──────────────────────────────────────────────────────────────
   GeoShape — forma geométrica decorativa (estilo casa de bolsa
   clásica: panel navy, contorno fino dorado, anillo) que se mueve
   sutilmente con el scroll. Siempre aria-hidden.
   ────────────────────────────────────────────────────────────── */

const GEO_BASE: Record<string, CSSProperties> = {
  panel: { background: "var(--navy)", borderRadius: 2 },
  outline: { border: "1px solid var(--gold-deep)", borderRadius: 2, opacity: 0.55 },
  ring: { border: "1px solid var(--gold-deep)", borderRadius: "50%", opacity: 0.45 },
};

export function GeoShape({
  variant = "outline",
  parallax = 40,
  rotate = 0,
  className,
  style,
}: {
  variant?: "panel" | "outline" | "ring";
  /** Recorrido vertical en px a lo largo del paso por viewport. */
  parallax?: number;
  /** Delta de rotación en grados a lo largo del paso por viewport. */
  rotate?: number;
  className?: string;
  style?: CSSProperties;
}) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const y = useTransform(scrollYProgress, [0, 1], [parallax, -parallax]);
  const r = useTransform(scrollYProgress, [0, 1], [-rotate, rotate]);

  return (
    <motion.div
      ref={ref}
      aria-hidden
      className={className}
      style={{
        position: "absolute",
        pointerEvents: "none",
        ...GEO_BASE[variant],
        ...style,
        y: reduce ? 0 : y,
        rotate: reduce ? 0 : r,
      }}
    />
  );
}
