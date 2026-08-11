"use client";

import { useEffect, useRef } from "react";
import { ZONE, ZDOTS } from "./worldDotsZona";

// "El mundo" del Resumen — un mapa de puntos GRANDE de una zona (las Américas),
// en diagonal y sangrando por la derecha de la sección. Agua en blanco (sin
// color), tierra en puntos navy, Uruguay marcado en oro (domicilio del fondo).
// Encarna el resumen: exposición global + diversificación (miles de puntos),
// operado desde Uruguay. Canvas (no SVG) por costo de pintado; mapa estático.

const NAVY = "rgba(15,34,73,0.9)";   // --navy
const GOLD: [number, number, number] = [160, 124, 40]; // --gold-deep #A07C28

const URUGUAY = { lon: -56.16, lat: -34.9 };

const ANGLE = -0.22;     // inclinación diagonal (rad)
const FILL = 1.5;        // alto del mapa relativo al alto del canvas (sangra)
const ANCHOR_X = 0.66;   // centro del mapa hacia la derecha
const ANCHOR_Y = 0.46;
const DOT = 1.6;         // radio del punto (px lógicos)

const LON_SPAN = ZONE.lonMax - ZONE.lonMin;
const LAT_SPAN = ZONE.latMax - ZONE.latMin;

export function FondoMundo() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cnv = canvasRef.current;
    if (!cnv) return;
    const context = cnv.getContext("2d");
    if (!context) return;
    const canvas = cnv;
    const ctx = context;
    const cosA = Math.cos(ANGLE), sinA = Math.sin(ANGLE);

    function draw() {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const rect = canvas.getBoundingClientRect();
      const w = Math.max(1, Math.round(rect.width)) * dpr;
      const h = Math.max(1, Math.round(rect.height)) * dpr;
      canvas.width = w;
      canvas.height = h;
      ctx.clearRect(0, 0, w, h);

      const S = (h * FILL) / LAT_SPAN; // px por grado
      const ax = w * ANCHOR_X, ay = h * ANCHOR_Y;
      const r = DOT * dpr;

      // lon/lat → pantalla: centra en el mapa, escala, rota (diagonal), ancla.
      const place = (lon: number, lat: number): [number, number] => {
        const mx = (lon - ZONE.lonMin - LON_SPAN / 2) * S;
        const my = (ZONE.latMax - lat - LAT_SPAN / 2) * S;
        return [ax + mx * cosA - my * sinA, ay + mx * sinA + my * cosA];
      };

      // Tierra.
      ctx.fillStyle = NAVY;
      for (let i = 0; i < ZDOTS.length; i++) {
        const [x, y] = place(ZDOTS[i][0], ZDOTS[i][1]);
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }

      // Uruguay — punto de oro con anillo.
      const [ux, uy] = place(URUGUAY.lon, URUGUAY.lat);
      ctx.fillStyle = `rgb(${GOLD[0]},${GOLD[1]},${GOLD[2]})`;
      ctx.beginPath();
      ctx.arc(ux, uy, 3.4 * dpr, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = `rgba(${GOLD[0]},${GOLD[1]},${GOLD[2]},0.5)`;
      ctx.lineWidth = 1.4 * dpr;
      ctx.beginPath();
      ctx.arc(ux, uy, 8 * dpr, 0, Math.PI * 2);
      ctx.stroke();
    }

    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(canvas);
    return () => ro.disconnect();
  }, []);

  // width/height NO son el tamaño de dibujo —lo reescribe draw() con el tamaño
  // real por DPR— sino el tamaño INTRÍNSECO que el elemento tiene mientras no
  // haya corrido nada de JS. Sin ellos el canvas vale lo que dice el estándar
  // (300×150) hasta que el efecto lo mide, y al corregirse mueve la caja: era el
  // único layout shift de la página (CLS 0,0068 en el teléfono, medido sobre 5
  // cargas; con estos atributos da 0,00000). Ver docs/rendimiento-fondo.md §6.2.
  // El valor es la caja de diseño del slot en desktop; sólo importa su relación.
  return <canvas ref={canvasRef} width={820} height={620} className="fmapa" aria-hidden />;
}
