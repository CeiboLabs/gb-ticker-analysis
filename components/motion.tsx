"use client";

import {
  motion,
  useReducedMotion,
  useInView,
  useMotionValue,
  useSpring,
  animate,
  type Variants,
} from "framer-motion";
import { useEffect, useRef, useState, type ReactNode, type ElementType } from "react";

const EASE = [0.16, 1, 0.3, 1] as const;

// ⚠️ REGLA DE ORO DE ESTE ARCHIVO: `initial` tiene que ser IDÉNTICO en el
// server y en el cliente, pase lo que pase con prefers-reduced-motion.
//
// El server no puede conocer la preferencia del usuario, así que siempre
// renderiza el estado escondido (opacity: 0). Cuando el cliente prefiere menos
// movimiento y ramificaba ahí —devolviendo el elemento pelado, o `initial:
// false`, que en framer-motion significa «adoptá el DOM como está»— nadie
// volvía a tocar ese estilo: React avisa «this won't be patched up» y NO parcha
// los atributos que no coinciden, así que el opacity: 0 del HTML del server
// quedaba pegado y la sección era invisible PARA SIEMPRE. Medido el 2026-08-11:
// 14 bloques muertos en /informes y 19 en la página del fondo.
//
// La forma correcta es no tocar `initial` y cambiar sólo QUÉ pasa al montar:
// con reduced-motion se salta al estado final con `animate` y duración 0, en
// vez de esperar al viewport. El árbol renderizado es el mismo de los dos
// lados —no hay desajuste de hidratación— y el salto al estado visible lo hace
// framer-motion sobre el DOM, que sí pisa lo que vino del server.
const INSTANTANEO = { duration: 0 } as const;

const TAGS: Record<string, ElementType> = {
  div: motion.div,
  section: motion.section,
  article: motion.article,
  header: motion.header,
  ul: motion.ul,
  li: motion.li,
  p: motion.p,
  span: motion.span,
  h1: motion.h1,
  h2: motion.h2,
  h3: motion.h3,
};

type RevealProps = {
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
  delay?: number;
  y?: number;
  duration?: number;
  as?: keyof typeof TAGS;
  once?: boolean;
};

/** Fade + slide-up al entrar en viewport. Respeta prefers-reduced-motion. */
export function Reveal({
  children,
  className,
  style,
  delay = 0,
  y = 26,
  duration = 0.75,
  as = "div",
  once = true,
}: RevealProps) {
  const reduce = useReducedMotion();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Comp: any = TAGS[as] ?? motion.div;
  return (
    <Comp
      className={className}
      style={style}
      initial={{ opacity: 0, y }}
      animate={reduce ? { opacity: 1, y: 0 } : undefined}
      whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once, margin: "-80px" }}
      transition={reduce ? INSTANTANEO : { duration, ease: EASE, delay }}
    >
      {children}
    </Comp>
  );
}

const containerVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09, delayChildren: 0.05 } },
};
const itemVariants: Variants = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: EASE } },
};
// Los gemelos sin movimiento. `hidden` es IDÉNTICO al de arriba —es lo que
// renderiza el server y no se puede tocar (ver la regla de oro)—; lo único que
// cambia es que `show` llega de una, sin escalonar y sin duración.
const containerVariantsInstant: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0, delayChildren: 0 } },
};
const itemVariantsInstant: Variants = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: INSTANTANEO },
};

type StaggerProps = {
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
  as?: keyof typeof TAGS;
  amount?: number;
};

/** Contenedor que escalona la entrada de sus <StaggerItem>. */
export function Stagger({ children, className, style, as = "div", amount = 0.2 }: StaggerProps) {
  const reduce = useReducedMotion();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Comp: any = TAGS[as] ?? motion.div;
  return (
    <Comp
      className={className}
      style={style}
      variants={reduce ? containerVariantsInstant : containerVariants}
      initial="hidden"
      animate={reduce ? "show" : undefined}
      whileInView={reduce ? undefined : "show"}
      viewport={{ once: true, amount }}
    >
      {children}
    </Comp>
  );
}

export function StaggerItem({
  children,
  className,
  style,
  as = "div",
}: {
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
  as?: keyof typeof TAGS;
}) {
  const reduce = useReducedMotion();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Comp: any = TAGS[as] ?? motion.div;
  // El item hereda "hidden"/"show" del Stagger que lo contiene por propagación
  // de variantes: no lleva `initial` ni `animate` propios.
  return (
    <Comp className={className} style={style} variants={reduce ? itemVariantsInstant : itemVariants}>
      {children}
    </Comp>
  );
}

/** Número que cuenta hasta su valor al entrar en viewport. */
export function Counter({
  to,
  duration = 1.6,
  decimals = 0,
  prefix = "",
  suffix = "",
  separator = ".",
  className,
  style,
}: {
  to: number;
  duration?: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  separator?: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  const [val, setVal] = useState(0);

  useEffect(() => {
    if (!inView || reduce) return;
    const controls = animate(0, to, {
      duration,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: setVal,
    });
    return () => controls.stop();
  }, [inView, reduce, to, duration]);

  const shown = reduce || !inView ? to : val;
  return (
    <span ref={ref} className={className} style={style}>
      {format(shown, decimals, separator, prefix, suffix)}
    </span>
  );
}

function format(v: number, decimals: number, separator: string, prefix: string, suffix: string) {
  const fixed = decimals > 0 ? v.toFixed(decimals) : Math.round(v).toString();
  const [int, dec] = fixed.split(".");
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, separator);
  return `${prefix}${grouped}${dec ? "," + dec : ""}${suffix}`;
}

/** Translada un elemento según el scroll (parallax sutil). */
export function Parallax({
  children,
  className,
  style,
  offset = 60,
}: {
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
  offset?: number;
}) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const y = useMotionValue(0);
  const sy = useSpring(y, { stiffness: 80, damping: 24, mass: 0.4 });

  useEffect(() => {
    if (reduce) return;
    const el = ref.current;
    if (!el) return;
    const onScroll = () => {
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight || 1;
      const progress = (rect.top + rect.height / 2 - vh / 2) / vh; // -1..1 aprox
      y.set(-progress * offset);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [reduce, offset, y]);

  return (
    <motion.div ref={ref} className={className} style={{ ...style, y: reduce ? 0 : sy }}>
      {children}
    </motion.div>
  );
}
