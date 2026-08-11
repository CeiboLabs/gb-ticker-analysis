import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fachadaSvg, FACHADA_HORIZONTE_Y_RECTO, VW, VH } from "@/lib/fachada";

// OG del SITIO DEL FONDO — la tarjeta que se despliega al compartir el link.
//
// ES EL HERO, NO UNA CARD "INSPIRADA EN" EL HERO. Los paneles son las MISMAS 24
// teselas que dibuja <Fachada> en la página: la geometría sale de `lib/fachada.ts`,
// que es el módulo del que también come el hero. Si algún día se retoca la malla,
// la tarjeta se retoca sola — que era justamente el problema de imitarla a mano.
//
// Existe aparte de `app/opengraph-image.tsx` (la de la casa) porque aquélla cierra
// con "gbengochea.com.uy" y con la declaración institucional: compartir el fondo
// desplegaba el sitio equivocado.
//
// ⚠️ TODO EL TEXTO DE ESTA CARD YA ESTÁ PUBLICADO EN EL HERO, palabra por palabra:
// el titular, el ledger de tres ítems y el wordmark "BNG / SELECCIÓN GLOBAL". No
// se redactó nada para acá.
//
// Sin datos dinámicos ⇒ Next la resuelve en build, que es lo que permite servirla
// como archivo estático desde el hosting (ver scripts/build-fondo.mts · copiarOg).

export const alt = "BNG Selección Global — Gastón Bengochea & Cía.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const GOLD_SOFT = "#F2E3B0";
const WHITE = "#fff";

// ── Dónde cae el horizonte dorado en ESTA caja ───────────────────────────────
// El SVG entra con preserveAspectRatio="slice": escala por el lado que llena y
// desborda por el otro, centrado. Replicar esa cuenta acá es lo que permite
// apoyar el wordmark sobre el tramo RECTO de la línea —igual que en el hero,
// donde la misma cuenta la hace `calcularEncuadre()` midiendo el DOM—. Sin esto
// el cartel queda flotando y la línea le cruza por cualquier lado.
const ESCALA = Math.max(size.width / VW, size.height / VH);
const SOBRA_Y = (VH * ESCALA - size.height) / 2;
const HORIZONTE_Y = FACHADA_HORIZONTE_Y_RECTO * ESCALA - SOBRA_Y;

// ── Por qué esta card NO reproduce el hero ───────────────────────────────────
// Una card OG no se mira como una pantalla: WhatsApp la despliega a ~320px de
// ancho, o sea 3,75× más chica de lo que se dibuja acá. A esa escala el titular
// del hero —cuatro renglones de serif a 46px— cae a 12px y no se lee; lo que
// sobrevive es UN elemento dominante. Así que se conserva lo que hace
// reconocible al sitio (los paneles y el horizonte dorado cruzando el wordmark,
// que es el gesto de marca) y se tira todo lo que a ese tamaño sería ruido.
//
// El wordmark va MUCHO más grande que en el hero por la misma razón: a 112px
// baja a ~30px en la miniatura, que se lee de un vistazo.
const BNG_PX = 112, HUECO = 16, SUB_PX = 32;

// Centrado en x = 800 y no en el medio de la card: el horizonte sólo es RECTO
// entre x ≈ 550 y 1050 (ver el tramo recto en lib/fachada.ts), y la línea tiene
// que cruzar el wordmark horizontal. A 800, las dos líneas entran holgadas en
// ese tramo — "SELECCIÓN GLOBAL", que es la más ancha, ocupa ≈ [580, 1020].
const CARTEL_CENTRO = 800;
const CARTEL_ANCHO = 700;

// El descriptor del hero, que es la línea más corta y concreta que tiene la
// página: dice de qué está hecho el fondo sin prometer nada.
const LEDGER = ["Acciones + Bonos + Activos alternativos", "Exposición global", "Domiciliado en Uruguay"];

// Una sola familia: toda la card es grotesca. La serif de display (Newsreader)
// no entra porque el titular editorial no está — a tamaño de miniatura no se leía
// y era lo primero que había que sacar.
async function fuentes() {
  const sans = await readFile(join(process.cwd(), "assets", "fonts", "IBMPlexSans-SemiBold.ttf"));
  return [{ name: "Plex Sans", data: sans, style: "normal" as const, weight: 600 as const }];
}

export default async function Image() {
  const fonts = await fuentes();

  // La fachada entra como <img> y no como SVG inline porque Satori no ejecuta
  // clip-path ni máscaras CSS, pero sí rasteriza imágenes SVG.
  const fachada = `data:image/svg+xml;base64,${Buffer.from(
    fachadaSvg({ ancho: size.width, alto: size.height }),
  ).toString("base64")}`;
  const logo = `data:image/svg+xml;base64,${(
    await readFile(join(process.cwd(), "public", "logo-bengochea.svg"))
  ).toString("base64")}`;

  // ⚠️ Satori exige `display: flex` en TODO div con más de un hijo, y dos nodos
  // de texto ya cuentan (ver reference_satori_display_flex): compila igual y
  // revienta en runtime.
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", fontFamily: "Plex Sans" }}>
        {/* ── La fachada ── */}
        <img src={fachada} width={size.width} height={size.height} alt="" style={{ position: "absolute", top: 0, left: 0 }} />

        {/* ── Scrim ── el mismo par de gradientes de `.ffac-scrim`, en capas
            separadas porque Satori no compone múltiples backgrounds en una sola
            declaración. Va más suave que en el hero: allá tiene que despejar
            medio cuadrante para cuatro renglones de titular, y acá sólo sostiene
            el logo arriba y el descriptor abajo — apagarlo más apagaría los
            paneles, que son lo que se quiso conservar.
            ⚠️ Sin el atajo `inset`: Satori no lo resuelve, la capa queda de
            tamaño cero y el scrim no se ve. */}
        <div style={{
          display: "flex", position: "absolute", top: 0, left: 0,
          width: size.width, height: size.height,
          background: "linear-gradient(90deg, rgba(7,14,34,0.88) 0%, rgba(7,14,34,0.45) 30%, rgba(7,14,34,0.06) 58%, rgba(7,14,34,0) 76%)",
        }} />
        <div style={{
          display: "flex", position: "absolute", top: 0, left: 0,
          width: size.width, height: size.height,
          background: "linear-gradient(180deg, rgba(7,14,34,0.42) 0%, rgba(7,14,34,0) 24%, rgba(7,14,34,0) 60%, rgba(7,14,34,0.52) 100%)",
        }} />

        {/* ── Wordmark de la casa, arriba a la izquierda ── */}
        <img src={logo} width={204} height={42} alt="" style={{ position: "absolute", top: 56, left: 72 }} />

        {/* ── La firma BNG, apoyada en el tramo recto del horizonte ──
            Es el único elemento dominante de la card. Se centra sin `transform`:
            una caja de ancho conocido, colocada para que su centro caiga en x=800.
            El bloque arranca justo encima de la línea para que ésta pase por el
            HUECO entre las dos palabras, que es el gesto del hero. */}
        <div style={{
          position: "absolute",
          left: CARTEL_CENTRO - CARTEL_ANCHO / 2,
          top: HORIZONTE_Y - HUECO / 2 - BNG_PX,
          width: CARTEL_ANCHO,
          display: "flex", flexDirection: "column", alignItems: "center",
          textShadow: "0 2px 26px rgba(0,0,0,0.6)",
        }}>
          <div style={{ display: "flex", fontSize: BNG_PX, fontWeight: 600, lineHeight: 1, letterSpacing: 1, color: WHITE }}>
            BNG
          </div>
          <div style={{ display: "flex", marginTop: HUECO, fontSize: SUB_PX, fontWeight: 600, letterSpacing: 8.3, color: GOLD_SOFT }}>
            SELECCIÓN GLOBAL
          </div>
        </div>

        {/* ── Descriptor, abajo a la izquierda ──
            Regla fina encima, como el ledger del hero. A 20px baja a ~5px en la
            miniatura de WhatsApp: ahí es textura, y se lee de verdad en LinkedIn
            y en el desplegado grande. */}
        <div style={{ position: "absolute", left: 72, top: 494, display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", height: 1, width: 300, background: "rgba(235,210,136,0.55)" }} />
          <div style={{ display: "flex", marginTop: 22, alignItems: "center" }}>
            {LEDGER.map((it, i) => (
              <div key={it} style={{ display: "flex", alignItems: "center" }}>
                {i > 0 && <div style={{ display: "flex", color: "rgba(255,255,255,0.35)", margin: "0 14px" }}>·</div>}
                <div style={{ display: "flex", fontSize: 20, color: "rgba(255,255,255,0.78)" }}>{it}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
    { ...size, fonts },
  );
}
