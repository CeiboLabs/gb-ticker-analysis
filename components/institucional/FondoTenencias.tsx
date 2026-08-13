"use client";

import { useMemo, useState, type CSSProperties } from "react";
import { useFondo, fmtFechaCorta } from "@/lib/useFondo";
import type { HoldingItem } from "@/lib/fondo";
import { css } from "@/lib/css";

// Mayores tenencias del fondo — una vista a ancho completo con un control
// deslizante para alternar entre Treemap (bloques sólidos por clase) y Donut
// (torta llena con leyenda), con hover vinculado leyenda↔gráfico.
//
// Los datos salen del snapshot real (/api/fondo → fund_holdings), con el rezago
// de divulgación aplicado en el serving. En pre-lanzamiento —o mientras no haya
// un snapshot lo bastante viejo para divulgar— se muestra el estado vacío
// honesto. El color NO viaja en el dato: se deriva acá por clase + rank.
//
// ⚠️ EL GRÁFICO DIBUJA SÓLO LAS TENENCIAS DIVULGADAS, y el marco entero es ese
// tramo (pedido del usuario, 10-ago-2026; revierte el residual dibujado del
// 31-jul). Las áreas quedan relativas ENTRE SÍ — una tenencia del 7,5% ocupa el
// 13,6% del marco cuando lo divulgado suma 55.
//
// Tres cosas sostienen que el dibujo siga siendo honesto, y ninguna es opcional:
//
// 1. LAS CIFRAS NO SE NORMALIZAN NUNCA. Cada celda muestra su peso real en el
//    Fondo (7,5%, 5%…), no su fracción del marco. Normalizarlas para que
//    cierren en 100 sería afirmar que una tenencia del 7,5% pesa 13,6%, que es
//    falso: el área es relativa, la cifra no. Y como cada cifra es peso sobre el
//    Fondo, la suma queda al alcance de cualquiera que la haga.
// 2. EL ALCANCE VIAJA CON LA IMAGEN, Y VIAJA COMO CONTEO. El rótulo dice "Las 8
//    mayores tenencias", no "60% de la cartera" (pedido del usuario, 10-ago:
//    ser más cautelosos, no afirmar una cifra de cobertura). Es la convención de
//    los factsheets —"Top 10 holdings"— y dice lo mismo sin comprometer un
//    número que se mueve todos los días: "las 8 mayores" ya afirma que hay más.
//    Va en la BARRA DE TÍTULO y no sólo en la nota al pie porque este bloque
//    termina en decks y capturas: un recorte se lleva el gráfico con su rótulo,
//    la nota al pie no sobrevive.
//    ⚠️ Y por eso el punto 1 deja de ser una preferencia y pasa a ser lo único
//    que le queda al lector para dimensionar el tramo. Si algún día se
//    normalizan las cifras SIN reponer el porcentaje de cobertura, el bloque se
//    queda sin ninguna manera de saber cuánta cartera hay acá adentro.
// 3. EL RESIDUAL SIGUE EN EL DATO. El panel valida Σ = 10.000 bps
//    (HoldingsSchema), así que el snapshot trae igual su fila "OTROS":
//    buildCells simplemente no la convierte en celda. De ahí sale `total` (hoy
//    55), que es el divisor del donut y del treemap. NO se muestra: sólo decide
//    si el gráfico es parcial y hay que rotularlo como tal. Si algún día se
//    publica la cartera completa, `total` llega a 100 y los avisos de alcance se
//    caen solos, sin tocar nada más.
//
// El costo asumido: treemap y donut son encodings PARTE-TODO, así que un marco
// lleno empuja a leer "esto es la cartera", y con el resto afuera el dibujo la
// muestra más concentrada de lo que es. La decisión se toma con eso sobre la
// mesa —el cuadro queda para lo que esta sección tiene para mostrar, y no para
// un bloque gris sin nombre que se comía dos quintos— y lo que la sostiene es el
// punto 2. Si el rótulo de alcance se cae, esto vuelve a estar mal.

// Las mismas tres clases de <FondoCartera /> y de la ficha técnica. El gris de
// ALT es el mismo slate del panel "Activos alternativos": no es un "otros"
// residual, es la tercera clase del balanceado.
//
// 'OTROS' no está acá porque no es una clase de activo (ver HoldingItem en
// lib/fondo.ts): es el residual de la divulgación, y el gráfico no lo dibuja.
type Clase = "RV" | "RF" | "ALT";
type Cell = { name: string; short: string; clase: Clase; peso: number; color: string; hover: string };

const CLASE_LABEL: Record<Clase, string> = {
  RV: "Renta variable", RF: "Renta fija", ALT: "Alternativos",
};
// Orden de dibujo dentro del squarify, antes de reordenar por peso.
const CLASE_ORDER: Clase[] = ["RV", "RF", "ALT"];

// Rampa de sombra por clase: oscuro (mayor peso) → claro (menor), interpolada
// por rank dentro de la clase para soportar cualquier número de tenencias.
const CLASE_RAMP: Record<Clase, [string, string]> = {
  RV: ["#0f2249", "#5E63B8"],
  RF: ["#7C5E1A", "#D9BE6E"],
  ALT: ["#6E7689", "#B4BACA"],
};

// Tinta de la etiqueta. Las celdas van SIEMPRE en blanco (pedido del usuario,
// 2-ago): la tinta es lo que las hace leer como un solo sistema, y una etiqueta
// en navy en medio de la grilla se lee como otra cosa, no como la misma pieza
// más clara. Antes se elegía por luminancia real de la celda (inkFor), y con la
// cartera de hoy eso dejaba una sola celda en navy —la más clara de la rampa de
// RF— justo la que rompía la lectura.
// La contracara es de contraste: sobre el extremo claro del oro (#D9BE6E) el
// blanco da 1,8:1. Si molesta, la palanca correcta es bajar ese extremo de la
// rampa —no volver a la tinta navy—, ver CLASE_RAMP.
// Es constante para todas las celdas, así que vive en el CSS (.ten-tm-label) y
// no como variable inline por celda.
const INK = "#fff";

// ── Color de hover ────────────────────────────────────────────────────────
// El hover ACLARA la celda, y hasta acá lo hacía con `filter: brightness()`.
// Eso hay que evitarlo: un filter convierte a la celda en contexto de apilado y
// Chromium la rasteriza en SU PROPIA CAPA; con densidad de píxel fraccionaria
// (zoom del navegador, pantallas a 1,25×/1,5×) el borde de esa capa no cae en el
// mismo subpíxel que el resto y se abre una costura por donde asoma el fondo
// —#0f2249, o sea una línea negra— justo debajo de la celda con el cursor.
// Reproducido a dsf 1,1 y 1,6: la fila del filo se OSCURECE al hacer hover
// (166,173,186 → 158,166,182) mientras todo el resto de la celda se aclara.
// Es el mismo mecanismo que ya había mordido con `animation-fill-mode: both`.
//
// Así que el color aclarado se calcula acá y se cambia el background, sin capa
// nueva. `brightness(f)` de CSS opera en sRGB: es multiplicar cada canal y
// saturar en 255. Verificado contra el render real: #E3E4E7 × 1,05 dio
// (238,239,243) en la foto, exactamente lo que devuelve esta función.
const brillo = (hex: string, f: number) =>
  `#${[1, 3, 5]
    .map((i) => Math.min(255, Math.round(parseInt(hex.slice(i, i + 2), 16) * f)).toString(16).padStart(2, "0"))
    .join("")}`;
// El paso está calibrado para bloques oscuros, que es lo único que hay en el
// marco: todas las celdas salen de las tres rampas de clase.
const HOVER_F = 1.12;

// Los pesos reales llegan en medios puntos (2,5% / 7,5%): redondear a entero
// mostraría "2%" y "8%" y la suma de las clases no cerraría en 100.
const fmt = (n: number) => `${(Math.round(n * 10) / 10).toLocaleString("es-UY", { maximumFractionDigits: 1 })}%`;
const byPeso = (a: Cell, b: Cell) => b.peso - a.peso;

function lerpHex(a: string, b: string, t: number): string {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  const c = pa.map((v, i) => Math.round(v + (pb[i] - v) * t));
  return `#${c.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

// Mapea las tenencias del snapshot a celdas con color derivado. weightBps → %.
// Las filas "OTROS" del snapshot NO entran (ver el bloque de arriba): el filtro
// por CLASE_ORDER las deja afuera solo, sin un caso especial.
// Devuelve el ORDEN DEFINITIVO —por peso descendente—, que es el que consumen el
// donut, la leyenda y el squarify.
function buildCells(items: HoldingItem[]): Cell[] {
  const out: Cell[] = [];
  for (const clase of CLASE_ORDER) {
    const group = items
      .filter((it) => it.assetClass === clase)
      .sort((a, b) => b.weightBps - a.weightBps);
    const [dark, light] = CLASE_RAMP[clase];
    group.forEach((it, i) => {
      const t = group.length > 1 ? i / (group.length - 1) : 0;
      const color = lerpHex(dark, light, t);
      out.push({
        name: it.name,
        short: it.short ?? it.name,
        clase,
        peso: it.weightBps / 100,
        color,
        hover: brillo(color, HOVER_F),
      });
    });
  }
  out.sort(byPeso);
  return out;
}

// ── Treemap squarificado ──────────────────────────────────────────────────
// Dos formas, una por viewport: un treemap ancho a 2.5:1 (desktop) deja las
// celdas ilegibles cuando el contenedor cae a ~340px, así que mobile usa una
// variante en retrato que le da a cada celda suficiente área para el texto.
// Cada layout se squarifica para SU forma; se alternan por media query (sin JS,
// sin saltos de hidratación). La tipografía escala con el tamaño real de la
// celda (unidades de container query), así el texto siempre entra.
// La proporción del marco decide cuán legibles quedan las celdas chicas: con una
// cartera de ~17 líneas donde la menor pesa 2,5%, a 2,5:1 el squarify deja la
// última en una astilla de 63px (muda). A 2,22:1 la peor relación de aspecto baja
// de 2,76 a 1,50 y entran las 17 etiquetas. Medido sobre la cartera real.
const TM_WIDE = { w: 1040, h: 468 };
// El retrato vuelve de 930 a 840 al sacar el residual del dibujo. Los 930 eran
// compensación por la banda que se le reservaba abajo: las tenencias se
// repartían sólo el 60% de arriba y en un marco de 840 esa región quedaba casi
// cuadrada, con celdas donde el nombre no cerraba en dos renglones ("MFS
// Contrarian Value", "Vontobel Credit Opps." se cortaban con puntos
// suspensivos). Ahora las celdas se reparten el marco entero, así que estirarlo
// deja de hacer falta y de hecho molesta: a 930 el bloque se come casi dos
// pantallas de teléfono.
const TM_TALL = { w: 600, h: 840 };

type Rect = { x: number; y: number; w: number; h: number };
type Placed = Cell & { rect: Rect };

function squarify(items: Cell[], frame: Rect): Placed[] {
  const total = items.reduce((a, b) => a + b.peso, 0);
  if (total <= 0) return [];
  const scale = (frame.w * frame.h) / total;
  const scaled = items.map((it) => ({ ...it, area: it.peso * scale }));
  const out: Placed[] = [];
  const rect: Rect = { ...frame };
  let row: (Cell & { area: number })[] = [];

  const worst = (r: typeof row, side: number) => {
    const sum = r.reduce((a, b) => a + b.area, 0);
    const max = Math.max(...r.map((x) => x.area));
    const min = Math.min(...r.map((x) => x.area));
    return Math.max((side * side * max) / (sum * sum), (sum * sum) / (side * side * min));
  };

  const layout = (r: typeof row, side: number) => {
    const sum = r.reduce((a, b) => a + b.area, 0);
    const thick = sum / side;
    if (rect.w <= rect.h) {
      let ox = rect.x;
      for (const it of r) {
        const len = it.area / thick;
        out.push({ ...it, rect: { x: ox, y: rect.y, w: len, h: thick } });
        ox += len;
      }
      rect.y += thick;
      rect.h -= thick;
    } else {
      let oy = rect.y;
      for (const it of r) {
        const len = it.area / thick;
        out.push({ ...it, rect: { x: rect.x, y: oy, w: thick, h: len } });
        oy += len;
      }
      rect.x += thick;
      rect.w -= thick;
    }
  };

  const queue = [...scaled];
  while (queue.length) {
    const side = Math.min(rect.w, rect.h);
    const next = queue[0];
    if (row.length === 0 || worst(row, side) >= worst([...row, next], side)) {
      row.push(next);
      queue.shift();
    } else {
      layout(row, side);
      row = [];
    }
  }
  if (row.length) layout(row, Math.min(rect.w, rect.h));
  return out;
}

// El marco del treemap es una tarjeta redondeada, y hasta acá el redondeo lo
// hacía SOLO el `overflow: hidden` del contenedor: cada celda seguía siendo un
// rectángulo de esquinas vivas y el recorte le comía justo el vértice, que es
// donde vive el codo del hairline. Resultado: en las cuatro esquinas la línea
// del borde llegaba al arco y se cortaba en seco, con el relleno pegado al filo.
// La celda que toca dos lados contiguos del marco redondea ESA esquina con el
// mismo radio, así su borde traza el arco en lugar de morir contra él.
// Umbral en unidades virtuales del marco (~0.5px renderizados): squarify
// arranca en 0 y cierra en el borde por construcción, el epsilon sólo cubre el
// arrastre de coma flotante de sumar `ox += len` a lo largo de una fila.
const TM_R = "14px";
// Radio del FONDO navy, a propósito mayor que el del marco: ver .ten-tm::before.
const TM_R_FONDO = "18px";
const EDGE = 0.5;

// Qué lados del marco toca la celda. Decide dos cosas distintas: qué esquina
// redondea, y por cuál de sus lados se clava al filo (ver el estilo de la celda).
function edges(rect: Rect, frame: { w: number; h: number }) {
  return {
    izq: rect.x <= EDGE,
    der: rect.x + rect.w >= frame.w - EDGE,
    arr: rect.y <= EDGE,
    aba: rect.y + rect.h >= frame.h - EDGE,
  };
}

// Una rejilla de treemap. `scale` ≈ (ancho renderizado / ancho virtual) para
// estimar el tamaño físico de cada celda y decidir qué etiquetas mostrar; el
// tamaño de fuente exacto lo resuelve el navegador con cqw/cqh sobre el tamaño
// real, así que esto solo es el umbral de "cabe / no cabe".
function TreemapGrid({ placed, frame, variant, scale }: {
  placed: Placed[]; frame: { w: number; h: number }; variant: "wide" | "tall"; scale: number;
}) {
  return (
    <div className={`ten-tm ten-tm--${variant}`} style={{ aspectRatio: `${frame.w} / ${frame.h}` }}>
      {placed.map((p, i) => {
        const rw = p.rect.w * scale;
        const rh = p.rect.h * scale;
        // Tres escalones de etiqueta según el tamaño real de la celda. Ninguna
        // celda queda MUDA: la más chica muestra al menos su peso, y el nombre
        // completo (no el corto) vive en el title para el hover.
        const nivel = rw > 140 && rh > 88 ? "full" : rw > 64 && rh > 40 ? "nombre" : rw > 34 && rh > 24 ? "pct" : "mudo";
        // Fuente ligada al lado menor renderizado de la celda (en px, vía cqw/cqh),
        // con piso legible y techo editorial. Padding y gap derivan de ella.
        const fs = `clamp(9px, calc(min(${((p.rect.w / frame.w) * 100).toFixed(2)}cqw, ${((p.rect.h / frame.h) * 100).toFixed(2)}cqh) * 0.15), 17px)`;
        // Cuántas líneas de nombre entran DE VERDAD en la celda. El mismo cálculo
        // que hace el CSS, en px estimados: la fuente sale del lado menor (piso 9,
        // techo 17) y el alto libre es el de la celda menos el padding (1.32fs),
        // el eyebrow (0.88fs) y el peso (1.13fs); cada renglón mide 1.16fs.
        // El techo de 3 es editorial, no geométrico: en las celdas altas y
        // angostas del treemap en retrato ("Jupiter Global Eq. AR", "MFS
        // Contrarian Value") el nombre recién cierra en el tercer renglón, y ahí
        // el alto sobra.
        const fsPx = Math.min(17, Math.max(9, Math.min(rw, rh) * 0.15));
        const lines = Math.max(1, Math.min(3, Math.floor((rh - 3.33 * fsPx) / (1.16 * fsPx))));
        const e = edges(p.rect, frame);
        const r = (on: boolean) => (on ? TM_R : "0");
        return (
          <div
            key={p.name}
            className="ten-tm-cell"
            title={`${p.name} · ${fmt(p.peso)}`}
            style={{
              left: `${(p.rect.x / frame.w) * 100}%`,
              top: `${(p.rect.y / frame.h) * 100}%`,
              // La celda del filo se CLAVA al borde opuesto en vez de derivar su
              // tamaño de un porcentaje. Un `width` porcentual se redondea a la
              // grilla de píxeles del dispositivo y con el marco en una posición
              // fraccionaria la última celda quedaba 1px corta: una línea navy
              // —el fondo asomando— a lo largo de todo el filo derecho, presente
              // o no según el ancho de la ventana (medido: aparece a 1287 y 1441,
              // no a 1440 ni a 1103). Con `right: 0` el ancho lo resuelve el
              // navegador contra el borde real y la costura no puede existir.
              // (con `undefined` y no un spread condicional: el spread parte el
              // literal en una unión de formas y rompe el cast a CSSProperties)
              right: e.der ? 0 : undefined,
              width: e.der ? undefined : `${(p.rect.w / frame.w) * 100}%`,
              bottom: e.aba ? 0 : undefined,
              height: e.aba ? undefined : `${(p.rect.h / frame.h) * 100}%`,
              // Orden del shorthand: sup-izq, sup-der, inf-der, inf-izq.
              borderRadius: `${r(e.arr && e.izq)} ${r(e.arr && e.der)} ${r(e.aba && e.der)} ${r(e.aba && e.izq)}`,
              // El fondo va por variable y no como `background` inline: la regla
              // de :hover del stylesheet no le puede ganar a un estilo inline.
              ["--bg"]: p.color,
              ["--hov"]: p.hover,
              animationDelay: `${i * 38}ms`,
            } as CSSProperties}
          >
            {nivel !== "mudo" && (
              // --lines: nombres como "Man Global IG Opps." no entran en una línea
              // en una celda angosta, pero muchas de esas celdas son ALTAS. Donde
              // sobra alto se permiten hasta tres renglones; donde no, uno solo
              // con elipsis (el nombre completo sigue en el title).
              // El umbral era un alto fijo (120px) que ninguna celda intermedia
              // del treemap en retrato alcanza: en el teléfono la mitad de la
              // cartera se leía "NB Flexib…", "Muzinich…", "Man Glob…" con celdas
              // de 109px que tenían lugar de sobra para el segundo renglón.
              <div className="ten-tm-label" style={{ ["--fs"]: fs, ["--lines"]: lines } as CSSProperties}>
                {nivel !== "pct" && (
                  <>
                    <span className="ten-tm-eyebrow">
                      {nivel === "full" ? CLASE_LABEL[p.clase] : p.clase}
                    </span>
                    <span className="ten-tm-name">{p.short}</span>
                  </>
                )}
                <span className="ten-tm-pct">{fmt(p.peso)}</span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function Treemap({ placedWide, placedTall }: { placedWide: Placed[]; placedTall: Placed[] }) {
  return (
    <>
      <TreemapGrid placed={placedWide} frame={TM_WIDE} variant="wide" scale={1} />
      <TreemapGrid placed={placedTall} frame={TM_TALL} variant="tall" scale={0.58} />
    </>
  );
}

// ── Donut (torta llena) ───────────────────────────────────────────────────
// Math.cos/sin no están obligados por la spec de ECMAScript a dar el mismo bit
// en todas las implementaciones: Node (SSR) y el navegador pueden diferir en los
// últimos decimales y romper la hidratación. Cuantizamos a 3 decimales para que
// ambos lados serialicen el mismo string `d` (sub-píxel, visualmente idéntico).
const q = (n: number) => Math.round(n * 1000) / 1000;
const polar = (cx: number, cy: number, r: number, deg: number) => {
  const a = ((deg - 90) * Math.PI) / 180;
  return [q(cx + r * Math.cos(a)), q(cy + r * Math.sin(a))] as const;
};
function arcPath(cx: number, cy: number, rO: number, rI: number, start: number, end: number) {
  const [sx, sy] = polar(cx, cy, rO, start);
  const [ex, ey] = polar(cx, cy, rO, end);
  const [ix, iy] = polar(cx, cy, rI, end);
  const [jx, jy] = polar(cx, cy, rI, start);
  const large = end - start > 180 ? 1 : 0;
  return `M${sx} ${sy} A${rO} ${rO} 0 ${large} 1 ${ex} ${ey} L${ix} ${iy} A${rI} ${rI} 0 ${large} 0 ${jx} ${jy} Z`;
}

function Pie({ orden, total, hover, setHover }: {
  orden: Cell[]; total: number; hover: string | null; setHover: (n: string | null) => void;
}) {
  const cx = 150, cy = 150, rO = 142, rI = 84;
  const GAP = 1.2;
  // Offset angular de cada wedge = suma de los spans anteriores. Se calcula de
  // forma funcional (sin mutar una variable durante el render, que prohíbe
  // react-hooks/immutability) para que el donut sea determinista entre renders.
  const spans = orden.map((d) => (d.peso / total) * 360);
  const offsets = spans.map((_, i) => spans.slice(0, i).reduce((a, b) => a + b, 0));
  const wedges = orden.map((d, i) => ({
    ...d,
    path: arcPath(cx, cy, rO, rI, offsets[i] + GAP / 2, offsets[i] + spans[i] - GAP / 2),
  }));

  return (
    <div className="ten-pie">
      <div className="ten-pie-chart">
        <svg viewBox="0 0 300 300" className="ten-pie-svg" role="img" aria-label="Composición de la cartera">
          <g data-dim={hover ? "1" : "0"}>
            {wedges.map((s) => (
              <path
                key={s.name}
                d={s.path}
                fill={s.color}
                data-on={hover === s.name ? "1" : "0"}
                onMouseEnter={() => setHover(s.name)}
                onMouseLeave={() => setHover(null)}
              />
            ))}
          </g>
        </svg>
      </div>

      <ol className="ten-leg">
        {orden.map((d, i) => (
          <li
            key={d.name}
            data-on={hover === d.name ? "1" : "0"}
            data-dim={hover && hover !== d.name ? "1" : "0"}
            onMouseEnter={() => setHover(d.name)}
            onMouseLeave={() => setHover(null)}
          >
            <span className="ten-leg-rank">{String(i + 1).padStart(2, "0")}</span>
            <span className="ten-leg-dot" style={{ background: d.color }} />
            <span className="ten-leg-name">{d.name}</span>
            <span className="ten-leg-class" data-c={d.clase}>{d.clase}</span>
            <span className="ten-leg-pct">{fmt(d.peso)}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

type Vista = "treemap" | "pie";

export function FondoTenencias() {
  const state = useFondo();
  const holdings = state.kind === "ready" ? state.data.holdings : null;
  const [vista, setVista] = useState<Vista>("treemap");
  const [hover, setHover] = useState<string | null>(null);

  // buildCells devuelve el ORDEN DEFINITIVO (por peso descendente): no
  // reordenar acá. `total` es el divisor del donut (360°) y del treemap (el
  // marco), y como el residual no se dibuja vale lo que sumen las tenencias
  // divulgadas —hoy, 60—. O sea: el marco ES ese tramo, y ese mismo número es el
  // que se rotula arriba y se explica al pie.
  const cells = useMemo(() => (holdings ? buildCells(holdings.items) : []), [holdings]);
  const total = useMemo(() => cells.reduce((a, b) => a + b.peso, 0), [cells]);
  // Si el gráfico cubre una parte de la cartera hay que decirlo, y en los dos
  // niveles. Se DECIDE con `total`, pero `total` no se muestra (ver punto 2
  // arriba): lo que se dice es cuántas tenencias son. Es el caso normal hoy; el
  // día que se publique la cartera completa esto da false y los dos avisos se
  // caen solos, sin tocar nada.
  const parcial = total > 0 && total < 99.95;
  const placedWide = useMemo(() => squarify(cells, { x: 0, y: 0, ...TM_WIDE }), [cells]);
  const placedTall = useMemo(() => squarify(cells, { x: 0, y: 0, ...TM_TALL }), [cells]);

  const hasData = !!holdings && cells.length > 0 && total > 0;

  return (
    <div className="ten-wrap">
      <div className="ten-bar">
        {/* Nivel 1 del aviso de alcance: el conteo va adentro del propio título
            —"Las 8 mayores tenencias"—, así entra en cualquier recorte que se
            lleve el gráfico (punto 2 del bloque de arriba) y no necesita una
            línea aparte que en el teléfono habría que acomodar. El nivel 2
            —largo— está en .ten-foot. */}
        <span className="ten-bar-label">
          {hasData && parcial ? `Las ${cells.length} mayores tenencias` : "Mayores tenencias"}
        </span>
        {hasData && (
          <div className="ten-toggle" data-active={vista} role="tablist" aria-label="Tipo de gráfico">
            <span className="ten-toggle-thumb" aria-hidden />
            <button role="tab" aria-selected={vista === "treemap"} className="ten-toggle-btn" onClick={() => setVista("treemap")}>Treemap</button>
            <button role="tab" aria-selected={vista === "pie"} className="ten-toggle-btn" onClick={() => setVista("pie")}>Donut</button>
          </div>
        )}
      </div>

      {hasData ? (
        <>
          {/* Acá iba la barra de split por clase de activo, y sigue afuera: sólo
              se conoce la clase del tramo divulgado, así que la barra podría
              sumar 55% y dejar un hueco, o normalizar y decir "Renta variable
              50%", que no es la asignación del Fondo sino la del pedazo que se
              publica. Una barra de proporción no tiene el escape que sí tiene el
              treemap —ahí cada celda lleva su cifra real al lado del área—: la
              barra es sólo geometría, y la geometría normalizada acá sería el
              dato equivocado. La clase de cada tenencia vive igual en el eyebrow
              de su celda y en el chip de su fila de la leyenda. Vuelve el día
              que el cliente pase el split por clase del tramo restante — es el
              pedido más barato que desbloquea la mejor pieza de esta sección. */}
          <div className="ten-stage" key={vista}>
            {vista === "treemap" ? <Treemap placedWide={placedWide} placedTall={placedTall} /> : <Pie orden={cells} total={total} hover={hover} setHover={setHover} />}
          </div>

          {/* Lo único que esta nota tiene que hacer es fechar el dato que está
              arriba. El "factsheet mensual" que decía antes prometía una cadencia
              que el Reglamento no obliga (literal (t): estado de cuenta semestral
              + información permanente en la Administradora), y explicar acá el
              régimen de información completo es traer el contrato a una nota al
              pie de un gráfico. */}
          {/* Nivel 2 del aviso de alcance (el nivel 1 es el rótulo de la barra):
              acá se dice largo lo que arriba entra en cuatro palabras. Repite el
              conteo y agrega lo que no se puede omitir — que las áreas son
              relativas entre sí y que cada porcentaje sigue siendo el peso sobre
              el total del Fondo. Esa segunda mitad es la que deja el tramo
              dimensionable sin declarar la cobertura (ver punto 2 arriba): no
              es adorno, es lo que reemplaza al "60% de la cartera" que acá decía
              hasta el 10-ago.

              ⚠️ ABRE CON EL ALCANCE DEL DATO (pedido del usuario, 3-ago-2026):
              antes de fechar el snapshot hay que decir que los pesos son
              aproximados. No es una fórmula de cortesía — es literal: los pesos
              se cargan redondeados (medios puntos), se muestran a un decimal, y
              la cartera de un fondo abierto se mueve todos los días con el
              mercado, las suscripciones y los rescates. La frase va PRIMERO
              porque una salvedad después de la fecha se lee como pie de
              imprenta; abriendo, califica al gráfico entero.

              ⚠️ "A título ilustrativo" NO quiere decir inventado: la
              composición sale del snapshot real que carga el panel
              (fund_holdings). Si algún día vuelve a haber datos de relleno acá,
              el problema no se arregla con esta nota — se arregla no
              publicándolos (ver el porqué en el comentario de FondoGeografia y
              en la auditoría del 27-jul-2026). */}
          <p className="ten-foot">
            Datos aproximados, a título ilustrativo: los pesos están redondeados y la composición
            varía con el mercado y con las decisiones de gestión.{" "}
            {parcial && (
              <>
                El gráfico muestra las {cells.length} mayores tenencias de la cartera: sus áreas son
                proporcionales entre sí y cada porcentaje es el peso sobre el total del Fondo.{" "}
              </>
            )}
            Composición al {fmtFechaCorta(holdings!.asOf)}; las ponderaciones pueden haber variado desde esa fecha.
          </p>
        </>
      ) : (
        <div className="ten-empty">
          <p className="ten-empty-title">
            {state.kind === "loading" ? "Cargando la composición de la cartera…" : "La composición de la cartera se publica próximamente."}
          </p>
          <p className="ten-empty-sub">
            Un asesor nuestro te explicará la composición de la estrategia en detalle.
          </p>
        </div>
      )}

      <style>{css`
        .ten-wrap { margin-top: 60px; }

        /* ── Barra: título + toggle ── */
        .ten-bar { display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; min-height: 38px; }
        .ten-bar-label {
          font-size: 12px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: var(--site-ink-3);
        }
        /* El alcance del gráfico vive DENTRO de este rótulo ("Las 8 mayores
           tenencias"), sin chip aparte. Se probó con la cobertura como segunda
           parte en un tono más bajo y no sobrevivía al teléfono: el rótulo
           entero pedía 345px y a 390 —el ancho más común— quedaban 5px de aire,
           así que había que bajarla a su propio renglón con una media query.
           Dicho como conteo entra en el título y el problema no existe. */
        .ten-toggle {
          position: relative; display: inline-flex; padding: 3px;
          background: var(--surface-muted, #f3f4f8); border: 1px solid var(--site-border); border-radius: 999px;
        }
        .ten-toggle-thumb {
          position: absolute; top: 3px; bottom: 3px; left: 3px; width: calc(50% - 3px);
          background: var(--navy); border-radius: 999px;
          box-shadow: 0 6px 16px -6px rgba(15,34,73,0.6);
          transition: transform 260ms cubic-bezier(0.34, 1.2, 0.4, 1);
        }
        .ten-toggle[data-active="pie"] .ten-toggle-thumb { transform: translateX(100%); }
        .ten-toggle-btn {
          position: relative; z-index: 1; border: 0; background: none; cursor: pointer;
          font-size: 13px; font-weight: 600; color: var(--site-ink-3);
          padding: 7px 24px; border-radius: 999px; transition: color 220ms ease; min-width: 100px;
        }
        .ten-toggle-btn[aria-selected="true"] { color: #fff; }
        .ten-toggle-btn:not([aria-selected="true"]):hover { color: var(--navy); }
        /* Mismo criterio táctil que el selector de períodos (.pslider-btn). */
        @media (pointer: coarse) {
          .ten-toggle-btn { padding-top: 12px; padding-bottom: 12px; }
        }

        /* ── Estado vacío (pre-lanzamiento / sin snapshot divulgable) ── */
        .ten-empty {
          margin-top: 28px; border: 1px dashed var(--site-border); border-radius: 14px;
          padding: 48px 24px; text-align: center; background: var(--surface-muted, #f8f9fc);
        }
        .ten-empty-title { margin: 0; font-size: 17px; color: var(--site-ink-2); }
        .ten-empty-sub { margin: 8px 0 0; font-size: 13px; color: var(--site-ink-3); }

        /* ── Stage (flush, sin tarjeta) ── */
        /* ⚠️ fill-mode BACKWARDS, no "both", acá y en las celdas del treemap.
           "both" retiene el último keyframe, y como ése lleva transform:none el
           navegador lo conserva como MATRIZ IDENTIDAD: la caja queda con un
           transform, se rasteriza en su propia capa y sus bordes se antialiasean
           contra el fondo del contenedor en vez de calzar con la celda vecina —
           hairline navy entre bloques, permanente. "backwards" sostiene el
           primer keyframe durante el delay escalonado (que es lo único que hace
           falta) y suelta el estado final, así el transform vuelve a none. */
        .ten-stage { margin-top: 28px; animation: ten-fade 420ms ease backwards; }
        @keyframes ten-fade { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }

        /* ── Treemap ── */
        /* El radio sale de TM_R (JS): las celdas de esquina redondean con el
           mismo valor y los dos arcos tienen que ser EL MISMO, o el recorte del
           contenedor vuelve a comerse el borde de la celda. */
        .ten-tm {
          container-type: size;
          position: relative; width: 100%;
          border-radius: ${TM_R}; overflow: hidden;
          box-shadow: 0 18px 50px -34px rgba(3,6,94,0.55);
        }
        /* El navy es la red de seguridad de las costuras (y el fondo sobre el que
           entran las celdas escalonadas), pero NO puede vivir en el contenedor:
           ahí queda justo detrás del arco de las celdas de esquina y se cuela por
           su antialias. Se diagnosticó con el residual todavía dibujado, que era
           la celda más clara del marco (gris casi papel): ahí el navy pintaba un
           sucio oscuro sobre la curva y la hacía leer bastante más pesada que el
           mismo hairline en los tramos rectos (medido: 10 puntos de L* por
           debajo). Atribuido apagando un sospechoso por vez: sacar el navy lo
           borraba; sacar la sombra o el recorte no cambiaba nada. El residual ya
           no se dibuja y hoy la esquina más clara es el extremo del oro, así que
           el sucio es menos visible — pero el mecanismo es el mismo y esto se
           queda: es el mismo que muerde con las capas propias (ver brillo()).
           Con radio MAYOR que el del marco el fondo se retira de las esquinas
           —~1,7px de aire a 45°, más que la banda de antialias en cualquier
           densidad— y sigue pegado al filo en los tramos rectos, que es donde
           hace de red. En las esquinas ya no hace falta: la celda se clava al
           borde (ver right/bottom arriba) y ahí no hay costura que tapar.
           ⚠️ Sin acentos graves acá adentro: esto vive en un template literal. */
        .ten-tm::before {
          content: ""; position: absolute; inset: 0;
          background: var(--navy); border-radius: ${TM_R_FONDO};
        }
        .ten-tm--tall { display: none; }   /* mobile la enciende abajo */
        /* cursor: default — no "auto". En auto el navegador decide por contexto y
           sobre el rótulo pone la barra de texto, así que el cursor parpadeaba
           entre flecha y I-beam recorriendo un mismo bloque. La celda no es un
           control ni un texto para seleccionar: es una superficie. Va en la
           celda y no en la etiqueta porque cursor hereda, y así cubre también
           los tramos sin texto. Mismo criterio que los wedges del donut. */
        .ten-tm-cell {
          position: absolute; box-sizing: border-box;
          border: 1.5px solid rgba(255,255,255,0.10);
          display: flex; align-items: flex-start; overflow: hidden;
          cursor: default;
          background: var(--bg);
          transition: background-color 160ms ease;
          animation: ten-pop 520ms cubic-bezier(0.22, 1, 0.36, 1) backwards;
        }
        @keyframes ten-pop { from { opacity: 0; transform: scale(0.965); } to { opacity: 1; transform: none; } }
        /* ⚠️ Acá NO va un filter (ver brillo() arriba): promueve la celda a capa
           propia y con densidad fraccionaria abre una costura negra en su filo
           inferior. El color aclarado ya viene calculado en --hov. El borde es
           blanco al 10% sobre el fondo, así que se aclara solo con él. */
        .ten-tm-cell:hover { background: var(--hov); }
        /* La tinta es la misma en todas las celdas (ver INK). El eyebrow y el
           peso se atenúan con opacity y no con un rgba blanco fijo, así siguen a
           la tinta si algún día deja de ser blanca. */
        .ten-tm-label {
          padding: calc(var(--fs) * 0.66) calc(var(--fs) * 0.62); color: ${INK}; line-height: 1.16;
          display: flex; flex-direction: column; gap: calc(var(--fs) * 0.18);
          max-width: 100%; box-sizing: border-box; min-width: 0;
        }
        .ten-tm-eyebrow {
          font-size: calc(var(--fs) * 0.6); font-weight: 700; letter-spacing: 0.13em; text-transform: uppercase;
          opacity: 0.58; margin-bottom: 1px;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%;
        }
        .ten-tm-name {
          font-size: var(--fs); font-weight: 600; letter-spacing: -0.01em;
          display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: var(--lines, 1);
          overflow: hidden; overflow-wrap: break-word; max-width: 100%;
        }
        .ten-tm-pct { font-size: calc(var(--fs) * 0.82); font-variant-numeric: tabular-nums; opacity: 0.82; }

        /* ── Donut ── */
        .ten-pie { display: grid; grid-template-columns: auto 1fr; gap: 52px; align-items: center; padding: 6px; }
        .ten-pie-chart { display: flex; justify-content: center; }
        .ten-pie-svg { width: 300px; height: 300px; flex: none; }
        /* backwards, no "both", por el mismo motivo que arriba y por uno más: una
           animación retenida GANA EN LA CASCADA sobre las reglas normales, así
           que el fill dejaba clavada la opacidad en 1 y mataba el atenuado del
           hover (.ten-pie-svg g[data-dim="1"] path). */
        .ten-pie-svg path {
          stroke: #f6f7fb; stroke-width: 1.5; stroke-linejoin: round;
          transform-origin: 150px 150px; cursor: default;
          transition: opacity 220ms ease, transform 220ms ease;
          animation: ten-arc 480ms ease backwards;
        }
        @keyframes ten-arc { from { opacity: 0; } to { opacity: 1; } }
        .ten-pie-svg g[data-dim="1"] path { opacity: 0.3; }
        .ten-pie-svg g[data-dim="1"] path[data-on="1"] { opacity: 1; transform: scale(1.035); }

        /* ── Leyenda (compartida) ── */
        .ten-leg { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: 1fr 1fr; gap: 0 34px; }
        /* Mismo criterio que las celdas del treemap: la fila reacciona al hover
           (ilumina su wedge) pero no es un control ni un texto para seleccionar,
           así que el cursor no cambia al recorrerla. cursor hereda: alcanza con
           declararlo en la fila para cubrir nombre, chip y porcentaje. */
        .ten-leg li {
          display: grid; grid-template-columns: auto auto 1fr auto auto; align-items: center; gap: 11px;
          padding: 9px 8px; margin: 0 -8px; border-bottom: 1px solid var(--site-border); border-radius: 8px;
          font-size: 13px; color: var(--site-ink); transition: background 200ms ease, opacity 200ms ease;
          min-height: 42px; cursor: default;
        }
        .ten-leg li[data-dim="1"] { opacity: 0.4; }
        .ten-leg li[data-on="1"] { background: var(--navy-050, #ECEDF6); }
        .ten-leg-rank { font-size: 11px; font-weight: 600; color: var(--site-ink-3); font-variant-numeric: tabular-nums; letter-spacing: 0.04em; min-width: 16px; }
        /* Hairline interno: los extremos claros de las rampas (el oro sobre todo)
           se pierden contra el papel sin un borde. */
        .ten-leg-dot { width: 11px; height: 11px; border-radius: 3px; box-shadow: inset 0 0 0 1px rgba(15,34,73,0.10); }
        .ten-leg-name { color: var(--site-ink-2); line-height: 1.3; }
        .ten-leg-class { font-size: 9.5px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; padding: 3px 7px; border-radius: 5px; line-height: 1; }
        .ten-leg-class[data-c="RV"] { color: #1a3163; background: rgba(26,49,99,0.10); }
        .ten-leg-class[data-c="RF"] { color: #8A6A1E; background: rgba(160,124,40,0.12); }
        .ten-leg-class[data-c="ALT"] { color: #5b6172; background: rgba(154,160,180,0.18); }
        .ten-leg-pct { font-variant-numeric: tabular-nums; font-weight: 600; min-width: 34px; text-align: right; }

        .ten-foot { margin: 24px 0 0; font-size: 12.5px; line-height: 1.6; color: var(--site-ink-3); max-width: var(--medida-legal); }

        @media (max-width: 920px) {
          .ten-pie { grid-template-columns: 1fr; gap: 30px; justify-items: center; }
          .ten-leg { width: 100%; grid-template-columns: 1fr; }
        }
        /* En pantallas angostas el treemap ancho deja celdas ilegibles: cambiamos
           a la variante en retrato, squarificada para esa forma. */
        @media (max-width: 600px) {
          .ten-tm--wide { display: none; }
          .ten-tm--tall { display: block; }
        }
        @media (prefers-reduced-motion: reduce) {
          .ten-stage, .ten-tm-cell, .ten-pie-svg path { animation: none; }
        }
      `}</style>
    </div>
  );
}
