import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

// OG por defecto de TODO el sitio — la tarjeta que se despliega al compartir el
// link de cualquier página que no tenga la suya. (informes/[slug] mantiene su
// propia card dinámica, que sobreescribe a ésta en su subárbol.) Marca de la
// casa: navy, wordmark, tagline en serif — el mismo lenguaje que la card de
// research, para que el sitio unfurlee coherente. Sin datos dinámicos ⇒ Next la
// optimiza en build. Ver docs/SEO-plan.md.

export const alt = "Gastón Bengochea & Cía. — Sociedad de Bolsa desde 1967";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const NAVY = "#0f2249";
const GOLD = "#EBD288";
const WHITE = "#FBFBFE";
const MUTED = "rgba(255,255,255,0.60)";
const RULE = "rgba(255,255,255,0.18)";

async function fuentes() {
  const dir = join(process.cwd(), "assets", "fonts");
  const [serif, sans, mono] = await Promise.all([
    readFile(join(dir, "Newsreader-Medium.ttf")),
    readFile(join(dir, "IBMPlexSans-SemiBold.ttf")),
    readFile(join(dir, "IBMPlexMono-Medium.ttf")),
  ]);
  return [
    { name: "Newsreader", data: serif, style: "normal" as const, weight: 500 as const },
    { name: "Plex Sans", data: sans, style: "normal" as const, weight: 600 as const },
    { name: "Plex Mono", data: mono, style: "normal" as const, weight: 500 as const },
  ];
}

export default async function Image() {
  const fonts = await fuentes();

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: NAVY,
          padding: "68px 72px",
          fontFamily: "Plex Sans",
        }}
      >
        {/* Cabecera — wordmark + sello */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "baseline" }}>
            <span style={{ color: WHITE, fontSize: 30, fontWeight: 600, letterSpacing: 4 }}>BENGOCHEA</span>
            <span style={{ color: GOLD, fontSize: 30, fontWeight: 600, marginLeft: 12 }}>Inversiones</span>
          </div>
          <div style={{ display: "flex", color: GOLD, fontFamily: "Plex Mono", fontSize: 16, letterSpacing: 3 }}>SOCIEDAD DE BOLSA</div>
        </div>

        {/* Cuerpo — kicker dorado + declaración de la casa en serif */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", color: GOLD, fontFamily: "Plex Mono", fontSize: 20, letterSpacing: 3, marginBottom: 26 }}>DESDE 1967</div>
          <div style={{ display: "flex", color: WHITE, fontFamily: "Newsreader", fontSize: 66, lineHeight: 1.08, letterSpacing: -1, maxWidth: 1000 }}>
            Invertí en el mundo desde Uruguay, con nuestro asesoramiento.
          </div>
        </div>

        {/* Pie — respaldo + dominio */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", height: 1, background: RULE, marginBottom: 22 }} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", color: MUTED, fontFamily: "Plex Mono", fontSize: 18, letterSpacing: 1 }}>Miembros de la Bolsa de Valores de Montevideo</div>
            <div style={{ display: "flex", color: MUTED, fontFamily: "Plex Mono", fontSize: 18, letterSpacing: 1 }}>gbengochea.com.uy</div>
          </div>
        </div>
      </div>
    ),
    { ...size, fonts },
  );
}
