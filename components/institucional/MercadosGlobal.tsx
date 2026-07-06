"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { Reveal } from "@/components/motion";
import { SplitText } from "@/components/scroll";
import { ArrowRight } from "@/components/institucional/icons";
import { GDOTS, GMAP_W, GMAP_H, gproject } from "./worldDotsGlobal";

/* framer-motion no interpola custom properties → literal de globals.css */
const GOLD = "#A07C28"; /* var(--gold-deep) */
const EASE = [0.16, 1, 0.3, 1] as const;

const MVD = gproject(-56.18, -34.9);

/* Los ~2500 puntos de tierra firme se renderizan como UN solo <path>
   (no 2500 <circle>): colapsa el DOM y abarata el repintado/máscara.
   Cada punto es un círculo de r=1.9 dibujado con dos arcos. */
const DOT_R = 1.9;
const GDOTS_PATH = GDOTS.map(
  ([x, y]) =>
    `M${x} ${y}m-${DOT_R} 0a${DOT_R} ${DOT_R} 0 1 0 ${DOT_R * 2} 0a${DOT_R} ${DOT_R} 0 1 0 -${DOT_R * 2} 0`,
).join("");

/* Destinos ILUSTRATIVOS: claim de capacidad (acceso vía mercado
   internacional), no de membresía — ver feedback_claims_verificables.
   2026-06-11: el cliente confirma operativa en los mercados de todo el
   mundo → mapa global completo. Solo llevan etiqueta plazas ya usadas
   como ilustrativas en el sitio (las aprobadas 2026-06-07 + Hong Kong,
   que FondoMapa ya etiqueta); el resto son puntos sin nombre: ilustran
   alcance sin afirmar bolsas puntuales. */
const DESTINOS: { city: string; to: [number, number]; label?: boolean }[] = [
  { city: "Nueva York", to: gproject(-74.01, 40.71), label: true },
  { city: "Toronto", to: gproject(-79.38, 43.65) },
  { city: "Chicago", to: gproject(-87.63, 41.88) },
  { city: "Ciudad de México", to: gproject(-99.13, 19.43) },
  { city: "Bogotá", to: gproject(-74.07, 4.71) },
  { city: "Lima", to: gproject(-77.03, -12.04) },
  { city: "Santiago", to: gproject(-70.65, -33.45) },
  { city: "San Pablo", to: gproject(-46.63, -23.55), label: true },
  { city: "Londres", to: gproject(-0.13, 51.51), label: true },
  { city: "Dublín", to: gproject(-6.26, 53.35) },
  { city: "Lisboa", to: gproject(-9.14, 38.72) },
  { city: "Madrid", to: gproject(-3.7, 40.42) },
  { city: "París", to: gproject(2.35, 48.86) },
  { city: "Ámsterdam", to: gproject(4.9, 52.37) },
  { city: "Fráncfort", to: gproject(8.68, 50.11) },
  { city: "Zúrich", to: gproject(8.54, 47.37) },
  { city: "Milán", to: gproject(9.19, 45.46) },
  { city: "Estocolmo", to: gproject(18.07, 59.33) },
  { city: "Johannesburgo", to: gproject(28.05, -26.2) },
  { city: "Dubái", to: gproject(55.27, 25.2) },
  { city: "Bombay", to: gproject(72.88, 19.08) },
  { city: "Singapur", to: gproject(103.85, 1.35) },
  { city: "Hong Kong", to: gproject(114.17, 22.32), label: true },
  { city: "Seúl", to: gproject(126.98, 37.57) },
  { city: "Tokio", to: gproject(139.69, 35.69) },
  { city: "Sídney", to: gproject(151.21, -33.87) },
];

const MAXD = Math.max(
  ...DESTINOS.map(({ to }) => Math.hypot(to[0] - MVD[0], to[1] - MVD[1])),
);

/** Delay del reveal proporcional a la distancia: la red irradia desde MVD. */
function delayOf(to: [number, number]) {
  return 0.25 + (Math.hypot(to[0] - MVD[0], to[1] - MVD[1]) / MAXD) * 0.9;
}

function arcPath([x0, y0]: [number, number], [x1, y1]: [number, number]) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const d = Math.hypot(dx, dy);
  let px = dy / d;
  let py = -dx / d;
  if (py > 0) {
    px = -px;
    py = -py;
  }
  const k = 0.2;
  return `M ${x0} ${y0} Q ${(x0 + x1) / 2 + px * d * k} ${(y0 + y1) / 2 + py * d * k} ${x1} ${y1}`;
}

const arcVar = {
  hide: { pathLength: 0 },
  show: (d: number) => ({
    pathLength: 1,
    transition: { delay: d, duration: 0.9, ease: EASE },
  }),
};
const dotVar = {
  hide: { opacity: 0 },
  show: (d: number) => ({
    opacity: 1,
    transition: { delay: d + 0.5, duration: 0.4 },
  }),
};
/**
 * S6 — Mercados. Editorial, SIN pin (reemplaza al stack pinned de plazas):
 * el claim va directo en el titular y el mapa mundial completo hace un
 * reveal único al entrar en viewport — los arcos irradian desde Montevideo
 * hacia centros financieros de todos los continentes y quedan encendidos.
 */
export function MercadosGlobal() {
  const reduce = useReducedMotion();

  return (
    <section className="band site-section">
      <div className="site-wrap">
        <Reveal>
          <div className="eyebrow-sm">Mercados</div>
          <SplitText
            text="Invertimos en el mundo desde Uruguay."
            as="h2"
            className="t-h2"
            style={{ marginTop: 16, maxWidth: "18em" }}
          />
          <p className="t-lead" style={{ marginTop: 20, maxWidth: "34em" }}>
            Desde Montevideo, tu cartera llega a los mercados de todo el mundo.
          </p>
          <Link href="/servicios" className="link-arrow" style={{ marginTop: 28 }}>
            Ver el ecosistema completo <ArrowRight />
          </Link>
        </Reveal>

        <motion.div
          className="mglobal-wrap"
          initial={reduce ? false : { opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 1.1, ease: "easeOut" }}
          viewport={{ once: true, amount: 0.35 }}
          style={{ willChange: "opacity" }}
        >
        <motion.svg
          className="mglobal-map"
          viewBox={`0 0 ${GMAP_W} ${GMAP_H}`}
          role="img"
          aria-label="Mapa del mundo con Montevideo como centro y conexiones a centros financieros de todos los continentes"
          initial={reduce ? false : "hide"}
          whileInView="show"
          viewport={{ once: true, amount: 0.35 }}
        >
          <defs>
            <linearGradient id="mg-fh" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#000" />
              <stop offset="0.05" stopColor="#fff" />
              <stop offset="0.95" stopColor="#fff" />
              <stop offset="1" stopColor="#000" />
            </linearGradient>
            <linearGradient id="mg-fv" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#000" />
              <stop offset="0.08" stopColor="#fff" />
              <stop offset="0.92" stopColor="#fff" />
              <stop offset="1" stopColor="#000" />
            </linearGradient>
            <mask id="mg-fadev">
              <rect width={GMAP_W} height={GMAP_H} fill="url(#mg-fv)" />
            </mask>
            <mask id="mg-fade">
              <g mask="url(#mg-fadev)">
                <rect width={GMAP_W} height={GMAP_H} fill="url(#mg-fh)" />
              </g>
            </mask>
          </defs>

          {/* Base map: estático y como path único. NO se anima su opacidad
              frame a frame (eso forzaba a recomponer toda la máscara y
              trababa la página); el fundido de entrada lo hace el wrapper. */}
          <g mask="url(#mg-fade)" fill="var(--navy-150)">
            <path d={GDOTS_PATH} />
          </g>

          {/* arcos Montevideo → mundo, irradiando por distancia */}
          {DESTINOS.map((d) => (
            <motion.path
              key={d.city}
              variants={arcVar}
              custom={delayOf(d.to)}
              d={arcPath(MVD, d.to)}
              fill="none"
              stroke={GOLD}
              strokeWidth={1.1}
              strokeOpacity={0.55}
              strokeLinecap="round"
            />
          ))}
          {DESTINOS.map((d) => (
            <motion.circle
              key={d.city}
              variants={dotVar}
              custom={delayOf(d.to)}
              cx={d.to[0]}
              cy={d.to[1]}
              r={3.2}
              fill={GOLD}
            />
          ))}
          {DESTINOS.filter((d) => d.label).map((d) => (
            <motion.text
              key={d.city}
              variants={dotVar}
              custom={delayOf(d.to)}
              x={d.to[0]}
              y={d.to[1] - 10}
              fill="var(--site-ink-3)"
              fontSize={12}
              fontWeight={600}
              letterSpacing="0.08em"
              textAnchor="middle"
            >
              {d.city.toUpperCase()}
            </motion.text>
          ))}

          {/* hub Montevideo — presente desde el primer frame */}
          <circle cx={MVD[0]} cy={MVD[1]} r={11} fill="none" stroke="var(--navy)" strokeWidth={1.4} />
          <circle cx={MVD[0]} cy={MVD[1]} r={4.5} fill={GOLD} />
          <text
            x={MVD[0]}
            y={MVD[1] + 26}
            fill="var(--navy)"
            fontSize={13}
            fontWeight={700}
            letterSpacing="0.14em"
            textAnchor="middle"
          >
            MONTEVIDEO
          </text>
        </motion.svg>
        </motion.div>

        {/* Los dos accesos de la mesa: el mapa cuenta lo global, estas filas
            aterrizan la oferta concreta de cada plaza (una sola mesa). */}
        <div className="mglobal-accesos ui-list">
          <Link href="/servicios#local" className="ui-list-row">
            <span>
              <span className="row-title">Mercado local</span>
              <span className="row-desc" style={{ display: "block" }}>
                Bonos globales uruguayos, Notas en UI, fideicomisos, LRM y obligaciones negociables.
              </span>
            </span>
            <span className="link-arrow" style={{ pointerEvents: "none" }}><ArrowRight /></span>
          </Link>
          <Link href="/servicios#internacional" className="ui-list-row">
            <span>
              <span className="row-title">Mercado internacional</span>
              <span className="row-desc" style={{ display: "block" }}>
                Renta fija soberana y corporativa, acciones, fondos y derivados globales.
              </span>
            </span>
            <span className="link-arrow" style={{ pointerEvents: "none" }}><ArrowRight /></span>
          </Link>
        </div>
      </div>

      <style>{`
        .mglobal-wrap {
          margin-top: clamp(36px, 5vw, 64px);
          overflow: hidden;
        }
        .mglobal-map {
          width: 100%;
          height: auto;
          display: block;
        }
        @media (max-width: 760px) {
          /* El viewBox es muy apaisado: a ancho de teléfono el mapa queda
             enano. Lo agrandamos centrado en el Atlántico (MVD + Europa)
             y el wrap recorta los extremos. */
          .mglobal-map { width: 165%; margin-left: -38%; }
        }
        .mglobal-accesos {
          margin-top: clamp(36px, 5vw, 56px);
          display: grid;
          grid-template-columns: 1fr 1fr;
          column-gap: clamp(32px, 5vw, 72px);
        }
        @media (max-width: 760px) {
          .mglobal-accesos { grid-template-columns: 1fr; }
          .mglobal-accesos .ui-list-row:first-child { border-top: 0; }
        }
      `}</style>
    </section>
  );
}
