"use client";

import { useRef } from "react";
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  useReducedMotion,
} from "framer-motion";

/**
 * Carpeta institucional en CSS 3D — el objeto que hasta un commit atrás vivía
 * en el hero de /informes, extraído acá como pieza reutilizable (hoy la usa el
 * destacado de Research en el Navbar).
 *
 * Es una CARPETA real (no un binder cerrado): dos tapas navy unidas por el
 * lomo izquierdo — el único lateral cerrado/azul. Los lados superior, derecho
 * e inferior quedan ABIERTOS y dejan ver los cantos del taco de hojas que
 * lleva adentro, con una hoja asomando por arriba. La tapa frontal lleva el
 * wordmark de la casa y un marco dorado fino.
 *
 * Reposa con una leve rotación y (si `interactive`) reacciona al mouse con tilt
 * parallax; la flotación idle se puede apagar con `animate` para no gastar
 * frames cuando el objeto no está a la vista (p.ej. panel de nav cerrado).
 * Respeta prefers-reduced-motion. Sin dependencias 3D — perspective +
 * transform-style: preserve-3d.
 *
 * El tamaño se controla con `scale`: 1 = tamaño nativo (300×384, el de
 * /informes). El objeto se escala UNIFORME (perspectiva incluida) y el
 * contenedor ocupa la huella ya escalada, así encaja en cualquier layout.
 *
 * Clases con prefijo `c3d-`: el `<style>` es global y no debe pisar al PNG
 * `CarpetaInformes` (que usa `.carpeta-*`) cuando ambos coexisten en /informes.
 */
const BASE_W = 300;
const BASE_H = 384;

type Carpeta3DProps = {
  /** Multiplicador de tamaño sobre el nativo 300×384. */
  scale?: number;
  /** Tilt parallax siguiendo el puntero. En slots chicos conviene apagarlo. */
  interactive?: boolean;
  /** Flotación idle. Apagar cuando el objeto no está visible (perf). */
  animate?: boolean;
  className?: string;
};

export function Carpeta3D({
  scale = 1,
  interactive = true,
  animate = true,
  className,
}: Carpeta3DProps) {
  const reduce = useReducedMotion();
  const idle = animate && !reduce;
  const tilt = interactive && !reduce;
  const stageRef = useRef<HTMLDivElement>(null);

  // Posición normalizada del puntero, -0.5..0.5 sobre el stage.
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const spring = { stiffness: 110, damping: 18, mass: 0.6 };
  const sx = useSpring(px, spring);
  const sy = useSpring(py, spring);

  // Pose de reposo (centro) + delta por mouse.
  const rotateY = useTransform(sx, [-0.5, 0.5], [-34, -6]);
  const rotateX = useTransform(sy, [-0.5, 0.5], [15, 1]);
  // Brillo especular que sigue al puntero sobre la tapa.
  const sheenX = useTransform(sx, [-0.5, 0.5], ["18%", "82%"]);
  const sheenY = useTransform(sy, [-0.5, 0.5], ["12%", "78%"]);

  function onMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!tilt) return;
    const el = stageRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    px.set((e.clientX - r.left) / r.width - 0.5);
    py.set((e.clientY - r.top) / r.height - 0.5);
  }
  function onLeave() {
    px.set(0);
    py.set(0);
  }

  return (
    <div
      className={`c3d-viewport${className ? ` ${className}` : ""}`}
      style={{ width: BASE_W * scale, height: BASE_H * scale }}
      aria-hidden
    >
      <div
        ref={stageRef}
        className="c3d-stage"
        style={{ transform: `translate(-50%, -50%) scale(${scale})` }}
        onPointerMove={onMove}
        onPointerLeave={onLeave}
      >
        {/* Sombra de contacto en el piso (no rota con el tilt). */}
        <motion.div
          className="c3d-shadow"
          animate={idle ? { scaleX: [1, 0.92, 1], opacity: [0.5, 0.42, 0.5] } : undefined}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* Flotación idle. */}
        <motion.div
          className="c3d-float"
          animate={idle ? { y: [0, -12, 0] } : undefined}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        >
          {/* Tilt parallax. */}
          <motion.div
            className="c3d-body"
            style={tilt ? { rotateX, rotateY } : { transform: "rotateX(8deg) rotateY(-20deg)" }}
          >
            {/* Tapa trasera + lomo (el único lateral cerrado, a la izquierda). */}
            <div className="c3d-cara c3d-cara-back" />
            <div className="c3d-cara c3d-cara-spine" />

            {/* Taco de hojas — cantos visibles por los lados abiertos. */}
            <div className="c3d-papel c3d-papel-top" />
            <div className="c3d-papel c3d-papel-right" />
            <div className="c3d-papel c3d-papel-bottom" />

            {/* Hojas que asoman por arriba — el documento dentro de la carpeta. */}
            <div className="c3d-hoja c3d-hoja-3" />
            <div className="c3d-hoja c3d-hoja-2" />
            <div className="c3d-hoja c3d-hoja-1">
              <span className="c3d-line c3d-hl-title" />
              <span className="c3d-line" />
              <span className="c3d-line c3d-short" />
            </div>

            {/* Tapa frontal. */}
            <div className="c3d-cara c3d-cara-front">
              <div className="c3d-cover-frame" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="c3d-cover-logo" src="/logo-bengochea.svg" alt="" />
              <div className="c3d-cover-rule" />
              <motion.div
                className="c3d-cover-sheen"
                style={tilt ? { ["--sx" as string]: sheenX, ["--sy" as string]: sheenY } : undefined}
              />
            </div>
          </motion.div>
        </motion.div>
      </div>

      <style>{`
        .c3d-viewport {
          position: relative;
          overflow: visible;
          pointer-events: none;
        }
        .c3d-stage {
          position: absolute;
          top: 50%;
          left: 50%;
          width: ${BASE_W}px;
          height: ${BASE_H}px;
          transform-origin: center;
          display: grid;
          place-items: center;
          perspective: 1500px;
          perspective-origin: 50% 42%;
          touch-action: none;
        }
        .c3d-shadow {
          position: absolute;
          bottom: clamp(14%, 18%, 22%);
          width: clamp(220px, 56%, 340px);
          height: 46px;
          border-radius: 50%;
          background: radial-gradient(closest-side, rgba(0,0,0,0.55), rgba(0,0,0,0));
          filter: blur(10px);
          transform: translateZ(0);
        }
        .c3d-float { transform-style: preserve-3d; }

        .c3d-body {
          /* W=300 H=384 T=apertura entre tapas — variables de las caras. */
          --w: 300px;
          --h: 384px;
          --t: 11px;            /* espesor fino de carpeta (tapa ↔ contratapa) */
          --pw: calc(var(--w) - 5px);  /* taco de hojas (apenas dentro) */
          --ph: calc(var(--h) - 7px);
          --pt: calc(var(--t) - 3px);  /* espesor del taco */
          position: relative;
          width: var(--w);
          height: var(--h);
          transform-style: preserve-3d;
          will-change: transform;
        }

        .c3d-cara {
          position: absolute;
          top: 50%;
          left: 50%;
          backface-visibility: hidden;
        }
        .c3d-cara-front, .c3d-cara-back {
          width: var(--w);
          height: var(--h);
          border-radius: 10px 4px 4px 10px; /* lomo redondeado a la izquierda */
        }
        .c3d-cara-front {
          transform: translate(-50%, -50%) translateZ(calc(var(--t) / 2));
          background: linear-gradient(150deg, #16335f 0%, #0f2249 52%, #0b1a3b 100%);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.08),
                      inset 0 0 60px rgba(0,0,0,0.35);
          overflow: hidden;
        }
        .c3d-cara-back {
          transform: translate(-50%, -50%) rotateY(180deg) translateZ(calc(var(--t) / 2));
          background: linear-gradient(150deg, #0a1733, #08122a);
        }
        /* Lomo: el único lateral cerrado/azul, sobre el borde izquierdo. */
        .c3d-cara-spine {
          width: var(--t);
          height: var(--h);
          transform: translate(-50%, -50%) rotateY(-90deg) translateZ(calc(var(--w) / 2));
          background: linear-gradient(180deg, #123059, #0c1d40);
          box-shadow: inset 2px 0 0 rgba(235,210,136,0.28),
                      inset 0 0 18px rgba(0,0,0,0.35);
          border-radius: 6px 0 0 6px;
        }

        /* Cantos del taco de hojas (lados abiertos). */
        .c3d-papel {
          position: absolute;
          top: 50%;
          left: 50%;
        }
        .c3d-papel-top, .c3d-papel-bottom { width: var(--pw); height: var(--pt); }
        .c3d-papel-right { width: var(--pt); height: var(--ph); }
        .c3d-papel-top {
          transform: translate(-50%, -50%) rotateX(90deg) translateZ(calc(var(--ph) / 2));
          background: repeating-linear-gradient(
            180deg, #f7f8f1, #f7f8f1 1.4px, #cccebe 1.4px, #cccebe 1.9px);
          box-shadow: inset 0 1px 1px rgba(0,0,0,0.12);
        }
        .c3d-papel-right {
          transform: translate(-50%, -50%) rotateY(90deg) translateZ(calc(var(--pw) / 2));
          background: repeating-linear-gradient(
            90deg, #f2f3ea, #f2f3ea 1.4px, #c7c8b8 1.4px, #c7c8b8 1.9px);
          box-shadow: inset -1px 0 1px rgba(0,0,0,0.14);
        }
        .c3d-papel-bottom {
          transform: translate(-50%, -50%) rotateX(-90deg) translateZ(calc(var(--ph) / 2));
          background: repeating-linear-gradient(
            180deg, #e7e8dd, #e7e8dd 1.4px, #bcbdac 1.4px, #bcbdac 1.9px);
        }

        /* Hojas que sobresalen por arriba (el documento dentro). */
        .c3d-hoja {
          position: absolute;
          top: 50%;
          left: 50%;
          width: calc(var(--w) - 20px);
          height: calc(var(--h) - 4px);
          border-radius: 3px 3px 2px 2px;
          background: linear-gradient(180deg, #ffffff, #f3f4ee);
          border: 1px solid rgba(15,34,73,0.07);
          box-shadow: 0 8px 22px rgba(15,34,73,0.16);
        }
        .c3d-hoja-1 {
          transform: translate(-50%, -50%) translate(13px, -30px)
            translateZ(calc(var(--t) / 2 - 1px));
        }
        .c3d-hoja-2 {
          transform: translate(-50%, -50%) translate(4px, -23px)
            translateZ(calc(var(--t) / 2 - 3px));
          filter: brightness(0.98);
        }
        .c3d-hoja-3 {
          transform: translate(-50%, -50%) translate(-5px, -17px)
            translateZ(calc(var(--t) / 2 - 5px));
          filter: brightness(0.955);
        }
        /* Líneas de contenido en la franja que asoma de la hoja superior. */
        .c3d-line {
          position: absolute;
          left: 22px;
          height: 2px;
          border-radius: 1px;
          background: rgba(15,34,73,0.26);
        }
        .c3d-line.c3d-hl-title {
          top: 8px;
          width: 46%;
          height: 3px;
          background: linear-gradient(90deg, #A07C28, #EBD288);
          opacity: 0.9;
        }
        .c3d-line:nth-of-type(2) { top: 16px; width: 58%; }
        .c3d-line.c3d-short { top: 22px; width: 38%; }

        /* Tapa frontal: marco, logo, regla dorada y sheen. */
        .c3d-cover-frame {
          position: absolute;
          inset: 18px;
          border: 1px solid rgba(235,210,136,0.32);
          border-radius: 4px;
          pointer-events: none;
        }
        .c3d-cover-logo {
          position: absolute;
          top: 46%;
          left: 50%;
          width: 46%;
          height: auto;
          aspect-ratio: 730 / 149;
          object-fit: contain;
          transform: translate(-50%, -50%);
          opacity: 0.96;
        }
        .c3d-cover-rule {
          position: absolute;
          left: 50%;
          top: 60%;
          width: 38%;
          height: 1.5px;
          transform: translateX(-50%);
          background: linear-gradient(90deg, transparent, #EBD288 30%, #EBD288 70%, transparent);
          opacity: 0.85;
        }
        .c3d-cover-sheen {
          position: absolute;
          inset: 0;
          pointer-events: none;
          background: radial-gradient(
            520px circle at var(--sx, 32%) var(--sy, 24%),
            rgba(255,255,255,0.16),
            rgba(255,255,255,0) 46%
          );
          mix-blend-mode: screen;
        }
      `}</style>
    </div>
  );
}
