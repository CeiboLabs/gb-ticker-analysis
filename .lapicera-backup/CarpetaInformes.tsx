/**
 * Objeto del hero de /informes: una foto del dossier de la casa (tapa dura
 * navy, bloque de hojas marfil, de canto) sobre fondo blanco, con una flecha
 * de crecimiento (tipo exponencial) en oro que corre ENCIMA de la tapa
 * siguiendo su recorrido y sale hacia arriba-derecha. Estático: sin flotación,
 * sin parallax con el mouse y sin animación de entrada (la flecha queda ya
 * dibujada, fija). La imagen trae su sombra de contacto; el fondo del figure
 * es blanco para que calce sin costura.
 */

// Flecha en coordenadas del viewBox de la foto (1400×776) para calzar exacto
// con el libro. Corre ENCIMA de la tapa navy: arranca abajo-izquierda (junto al
// lomo, "donde arranca el libro") y sube en diagonal recta por la tapa; el
// último ~20% (desde x≈985) se curva hacia arriba de forma exponencial hasta
// despegar en la punta, sin cortar las hojas.
//   · SHAFT_D → el asta (recta + kick), termina en la base del triángulo (B).
//   · HEAD_D  → la cabeza, un triángulo RELLENO con ápice en la punta.
const SHAFT_D = "M 65 365 L 985 61 C 1089.4 26.5, 1190 -25, 1211.7 -44.7";
const HEAD_D = "M 1233.9 -64.86 L 1219.76 -35.82 L 1203.64 -53.58 Z";

export function CarpetaInformes() {
  return (
    <div className="carpeta-stage" aria-hidden>
      <div className="carpeta-media">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className="carpeta-img"
          src="/informes-libro.jpg"
          alt=""
          width={1400}
          height={776}
          loading="eager"
          decoding="async"
        />
        <svg className="carpeta-arrow" viewBox="0 0 1400 776" fill="none">
          {/* Degradé a lo largo del asta: la cola (lomo) arranca transparente y
             entra al oro pleno en el primer ~20%, así el inicio se funde con la
             tapa en vez de cortar duro. Del arranque (65,365) a la punta
             (1245,-75). */}
          <defs>
            <linearGradient
              id="carpeta-arrow-grad"
              gradientUnits="userSpaceOnUse"
              x1={65}
              y1={365}
              x2={1245}
              y2={-75}
            >
              <stop offset="0" stopColor="var(--gold-deep)" stopOpacity={0} />
              <stop offset="0.22" stopColor="var(--gold-deep)" stopOpacity={1} />
              <stop offset="1" stopColor="var(--gold-deep)" stopOpacity={1} />
            </linearGradient>
          </defs>
          {/* Corrimiento horizontal de toda la flecha (asta + cabeza) en coords
             del viewBox. Negativo = hacia la izquierda. */}
          <g transform="translate(-60, 0)">
            <path
              d={SHAFT_D}
              stroke="url(#carpeta-arrow-grad)"
              strokeWidth={5.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path d={HEAD_D} fill="var(--gold-deep)" />
          </g>
        </svg>
      </div>

      <style>{`
        .carpeta-stage {
          position: absolute;
          inset: 0;
          display: grid;
          place-items: center;
          overflow: hidden;
        }
        /* En desktop el copy está empujado por el nav; compensamos para que el
           libro quede al MISMO nivel vertical que el bloque de texto. */
        @media (min-width: 861px) {
          .carpeta-stage { padding-top: var(--nav-h); }
        }
        .carpeta-media {
          position: relative;
          width: 96%;
        }
        .carpeta-img {
          width: 100%;
          height: auto;
          display: block;
        }
        /* La flecha calza sobre la foto vía el viewBox; escala con la imagen. */
        .carpeta-arrow {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          overflow: visible;
          pointer-events: none;
        }
        @media (max-width: 860px) {
          .carpeta-media { width: 92%; }
        }
      `}</style>
    </div>
  );
}
