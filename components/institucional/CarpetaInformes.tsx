/**
 * Objeto del hero de /informes: foto de la carpeta / dossier de la casa (tapa
 * navy con el logo BENGOCHEA INVERSIONES grabado) sobre fondo blanco. Cutout
 * con alfa; estática, rotada 10° y sangrando fuera de pantalla por la derecha
 * (la recorta el `overflow:hidden` de .hero-split). La sombra va en el
 * contenedor SIN rotar para que caiga en una dirección de luz fija.
 */

export function CarpetaInformes() {
  return (
    <div className="carpeta-stage" aria-hidden>
      <div className="carpeta-media">
        <div className="carpeta-rot">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="carpeta-img"
            src="/informes-carpeta.png"
            alt=""
            width={1100}
            height={1498}
            loading="eager"
            decoding="async"
            draggable={false}
          />
        </div>
      </div>

      <style>{`
        .carpeta-stage {
          position: absolute;
          inset: 0;
          overflow: visible;
        }
        @media (min-width: 861px) {
          .carpeta-stage { padding-top: var(--nav-h); }
        }
        .carpeta-media {
          position: absolute;
          top: 30%;
          right: 0;
          /* Tamaño PROPORCIONAL a la pantalla, no fijo. 31.25vw = 600px justo
             en 1920 (tu referencia, intacta) y escala con el ancho: así el
             folder conserva el MISMO aire alrededor en toda pantalla y nunca
             llena la columna como un bloque (lo que se veía mal en el Air).
             El clamp acota los extremos —piso en laptops, techo en monitores
             grandes—; es la palanca de tamaño para jugar. */
          width: clamp(320px, 31.25vw, 800px);
          transform: translate(-32%, -50%);
          pointer-events: none;
          /* Sombra en el contenedor externo (sin rotar) → dirección de luz
             fija (arriba-izquierda → abajo-derecha), sigue la silueta rotada.
             Mismos valores que la lapicera (.hero-pen): contacto oscuro pegado
             + capas que se aclaran al alejarse. */
          filter:
            drop-shadow(1px 2px 3px rgba(15, 34, 73, 0.62))
            drop-shadow(6px 11px 12px rgba(15, 34, 73, 0.36))
            drop-shadow(17px 32px 40px rgba(15, 34, 73, 0.20));
        }
        .carpeta-rot {
          transform: rotate(10deg);
        }
        .carpeta-img {
          width: 100%;
          height: auto;
          display: block;
          -webkit-user-drag: none;
          user-select: none;
        }
        @media (max-width: 860px) {
          /* Mobile: carpeta CENTRADA en la banda y dimensionada para entrar
             entera (alto ≈ ancho×1.36 < alto de la banda). Se lee como objeto
             —dossier inclinado 10° sobre blanco—, no como bloque recortado.
             left:50% + translate(-50%,-50%) centra sin depender del ancho. */
          .carpeta-media {
            top: 50%;
            left: 50%;
            right: auto;
            width: min(66%, 270px);
            transform: translate(-50%, -50%);
          }
        }
      `}</style>
    </div>
  );
}
