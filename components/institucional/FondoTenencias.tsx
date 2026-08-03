"use client";

import { useMemo, useState, type CSSProperties } from "react";
import { useFondo, fmtFechaCorta } from "@/lib/useFondo";
import type { HoldingItem } from "@/lib/fondo";

// Mayores tenencias del fondo — una vista a ancho completo con un control
// deslizante para alternar entre Treemap (bloques sólidos por clase) y Donut
// (torta llena con leyenda), con hover vinculado leyenda↔gráfico.
//
// Los datos salen del snapshot real (/api/fondo → fund_holdings), con el rezago
// de divulgación aplicado en el serving. En pre-lanzamiento —o mientras no haya
// un snapshot lo bastante viejo para divulgar— se muestra el estado vacío
// honesto. El color NO viaja en el dato: se deriva acá por clase + rank.
//
// ⚠️ EL GRÁFICO DIBUJA EL 100% DE LA CARTERA, residual incluido (31-jul-2026;
// revierte la normalización sobre lo divulgado del 30-jul). Treemap y donut son
// encodings PARTE-TODO: el marco y el círculo afirman "esto es la cartera
// entera". Repartir el marco sólo entre las tenencias nombradas dejaba cada área
// mintiendo —con un residual del 40%, una celda rotulada 10% ocupaba el 16,7%
// del marco— y el error iba para el lado caro: mostraba la cartera MÁS
// concentrada de lo que es, justo debajo de una sección que promete
// diversificación y de un bloque de Estrategia que dice "no depende de un solo
// instrumento". Con el residual dibujado la imagen pasa a confirmar esa tesis en
// vez de contradecirla: mayores tenencias nombradas + una cola larga.
//
// Además la nota al pie YA declaraba el alcance por escrito, así que normalizar
// no ahorraba la pregunta "¿y el otro 40%?" — sólo dejaba el dibujo mal. Y la
// nota no sobrevive un recorte: este bloque termina en decks y capturas, donde
// la geometría viaja sola.
//
// Es la misma doctrina que el resto de la sección ya aplica: <FondoCartera />
// muestra las tres clases SIN porcentajes ("son paneles, no una barra de
// proporción") porque los pesos reales son activos, y <FondoGeografia /> quedó
// fuera de la página entera por tener pesos inventados. No se dibuja una
// proporción que no es la proporción.

// Las mismas tres clases de <FondoCartera /> y de la ficha técnica. El gris de
// ALT es el mismo slate del panel "Activos alternativos": no es un "otros"
// residual, es la tercera clase del balanceado.
//
// 'OTROS' NO es una cuarta clase (ver HoldingItem en lib/fondo.ts): es el
// residual de la divulgación. Se dibuja con su área verdadera pero fuera de las
// rampas de clase —gris claro liso—, y va SIEMPRE último. El principio:
// área y color son canales distintos. El área sostiene la verdad; el color
// dirige la atención, y toda la saturación queda del lado de las tenencias
// nombradas, que son lo que esta sección tiene para mostrar.
type Clase = "RV" | "RF" | "ALT" | "OTROS";
type Cell = { name: string; short: string; clase: Clase; peso: number; color: string; hover: string; ink: string };

const CLASE_LABEL: Record<Clase, string> = {
  RV: "Renta variable", RF: "Renta fija", ALT: "Alternativos",
  // Nunca se usa como rótulo de clase: el residual tiene su propia etiqueta.
  OTROS: "",
};
// Clases con rampa de color, en orden de dibujo. El residual se agrega aparte:
// no tiene rampa porque no tiene rank dentro de una clase — no es una clase.
type ClaseDibujable = Exclude<Clase, "OTROS">;
const CLASE_ORDER: ClaseDibujable[] = ["RV", "RF", "ALT"];

// Tono del residual: gris claro LISO, fuera de las tres rampas y sin textura
// (pedido del usuario, 31-jul; antes llevaba un tramado diagonal). Claro a
// propósito —entre bloques saturados lee como espacio, no como una tenencia
// gigante llamada "Otros"—, pero un paso por debajo del papel (--paper #FBFBFE)
// para que no se lea como un agujero de render. Casi neutro: el azulado de la
// primera versión lo acercaba a la rampa de alternativos.
const RESIDUAL_FILL = "#E3E4E7";
// Etiqueta genérica del dato. El snapshot puede traer algo mejor ("Otras 24
// posiciones", si el cliente pasa el conteo): en ese caso se respeta el nombre
// cargado. "Otros" a secas se reemplaza — lee a sobras, y lo que este bloque
// muestra es el resto de la cartera.
const RESIDUAL_LABEL = "Resto de la cartera";
const RESIDUAL_GENERICO = /^otros?$/i;

// Rampa de sombra por clase: oscuro (mayor peso) → claro (menor), interpolada
// por rank dentro de la clase para soportar cualquier número de tenencias.
const CLASE_RAMP: Record<ClaseDibujable, [string, string]> = {
  RV: ["#0f2249", "#5E63B8"],
  RF: ["#7C5E1A", "#D9BE6E"],
  ALT: ["#6E7689", "#B4BACA"],
};

// Tinta de la etiqueta. Las celdas nombradas van SIEMPRE en blanco (pedido del
// usuario, 2-ago): la tinta es lo que las hace leer como un solo sistema, y una
// etiqueta en navy en medio de la grilla se lee como otra cosa, no como la misma
// pieza más clara. Antes se elegía por luminancia real de la celda (inkFor), y
// con la cartera de hoy eso dejaba una sola celda en navy —la más clara de la
// rampa de RF— justo la que rompía la lectura.
// La contracara es de contraste: sobre el extremo claro del oro (#D9BE6E) el
// blanco da 1,8:1. Si molesta, la palanca correcta es bajar ese extremo de la
// rampa —no volver a la tinta navy—, ver CLASE_RAMP.
const INK_NOMBRADA = "#fff";
// El residual es la excepción: gris casi papel, ahí el blanco no existiría.
const INK_RESIDUAL = "#16213f";

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
// El paso general está calibrado para bloques oscuros. Sobre el gris del
// residual (#E3E4E7) satura y termina en #FEFFFF, o sea MÁS CLARO que el papel
// (#F8F9FF) — y como el residual toca el borde del marco, la celda se fundía con
// la página justo cuando el cursor pide lo contrario. El margen es angosto (base
// L*90,6 → papel L*98,0, 7,4 puntos), así que ahí el levante cae a mitad de
// camino: sube lo suficiente para leerse y queda un escalón por debajo del papel.
const HOVER_F = 1.12;
const HOVER_F_RESIDUAL = 1.05;

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
// Devuelve el ORDEN DEFINITIVO —nombradas por peso descendente, residual al
// final—, que es el que consumen el donut, la leyenda y el squarify. El residual
// no se ordena por peso: con 40% entraría primero y el gráfico abriría por lo
// único que no tiene nombre.
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
        ink: INK_NOMBRADA,
      });
    });
  }
  out.sort(byPeso);

  // El residual va en UNA sola línea aunque el snapshot lo trajera partido.
  const resto = items.filter((it) => it.assetClass === "OTROS");
  const peso = resto.reduce((a, it) => a + it.weightBps, 0) / 100;
  if (peso > 0) {
    const propio = resto.length === 1 && !RESIDUAL_GENERICO.test(resto[0].name.trim());
    const name = propio ? resto[0].name : RESIDUAL_LABEL;
    out.push({
      name, short: name, clase: "OTROS", peso,
      color: RESIDUAL_FILL, hover: brillo(RESIDUAL_FILL, HOVER_F_RESIDUAL), ink: INK_RESIDUAL,
    });
  }
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
// El retrato se estiró de 840 a 930 al darle banda propia al residual (ver
// squarifyConBanda): las nombradas pasaron a repartirse sólo el 60% de arriba, y
// en un marco de 840 esa región quedaba casi cuadrada — con celdas cuadradas la
// etiqueta entra en dos renglones y nada más, así que "MFS Contrarian Value" y
// "Vontobel Credit Opps." volvían a cortarse con puntos suspensivos, justo lo que
// el techo de tres renglones había resuelto. Estirando el marco la región de las
// nombradas vuelve a ser apaisada-alta y los nombres cierran enteros.
// 930 es el CENTRO de la meseta que funciona: barridas de 850 a 1250 en nueve
// anchos de teléfono (320→600), corta a 865 y a 1000, limpio de 880 a 975. En un
// teléfono de 390 el marco queda en 350×542 (antes 350×490).
const TM_TALL = { w: 600, h: 930 };

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

// El residual NO entra al squarify: se le reserva una banda propia contra el
// borde de salida del marco —columna a la derecha en apaisado, franja abajo en
// retrato— y las tenencias nombradas se squarifican en lo que queda.
//
// El área no se toca: la banda mide exactamente peso/total del marco, así que
// sigue siendo el mismo trozo de la cartera (el gráfico sigue siendo parte-todo).
// Lo único que se fija es la FORMA, y es una decisión de lectura: el residual es
// la cola de la cartera, no una tenencia, y una banda al borde lo dice sola —
// nombradas de un lado, resto del otro. Repartido por el squarify quedaba
// mezclado entre las nombradas; en retrato encima caía en la esquina inferior
// derecha con dos celdas nombradas al costado, y la misma cifra leía como una
// tenencia más.
//
// En apaisado esto NO cambia el dibujo de hoy: con el residual en 40% el squarify
// ya venía dejando exactamente 40% de ancho × 100% de alto (medido). La
// diferencia es que ahora está garantizado y no depende del peso que traiga el
// snapshot: si mañana el residual baja a 25%, la columna sigue siendo columna.
function squarifyConBanda(cells: Cell[], frame: { w: number; h: number }): Placed[] {
  const marco: Rect = { x: 0, y: 0, ...frame };
  const residual = cells.find((c) => c.clase === "OTROS");
  const nombradas = cells.filter((c) => c.clase !== "OTROS");
  const total = cells.reduce((a, b) => a + b.peso, 0);
  if (!residual || total <= 0) return squarify(cells, marco);

  const frac = residual.peso / total;
  // Apaisado corta a lo ancho (columna); retrato corta a lo alto (franja).
  const columna = frame.w >= frame.h;
  const banda: Rect = columna
    ? { x: frame.w * (1 - frac), y: 0, w: frame.w * frac, h: frame.h }
    : { x: 0, y: frame.h * (1 - frac), w: frame.w, h: frame.h * frac };
  const resto: Rect = columna
    ? { x: 0, y: 0, w: frame.w * (1 - frac), h: frame.h }
    : { x: 0, y: 0, w: frame.w, h: frame.h * (1 - frac) };

  // El residual va ÚLTIMO, como en buildCells: es el orden que consume el
  // escalonado de la entrada (animationDelay por índice).
  return [...squarify(nombradas, resto), { ...residual, rect: banda }];
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
            data-res={p.clase === "OTROS" ? "1" : "0"}
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
              ["--ink"]: p.ink,
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
                    {/* El residual no lleva eyebrow: no es una clase de activo,
                        y la celda se identifica sola con su nombre y su peso. */}
                    {p.clase !== "OTROS" && (
                      <span className="ten-tm-eyebrow">
                        {nivel === "full" ? CLASE_LABEL[p.clase] : p.clase}
                      </span>
                    )}
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
            data-res={d.clase === "OTROS" ? "1" : "0"}
            data-on={hover === d.name ? "1" : "0"}
            data-dim={hover && hover !== d.name ? "1" : "0"}
            onMouseEnter={() => setHover(d.name)}
            onMouseLeave={() => setHover(null)}
          >
            {/* El residual no se numera ni se etiqueta por clase: no es la
                novena mayor tenencia ni una clase de activo. Las dos celdas van
                igual —vacías— para que la grilla no se descuadre en su fila. */}
            <span className="ten-leg-rank">{d.clase === "OTROS" ? "" : String(i + 1).padStart(2, "0")}</span>
            <span className="ten-leg-dot" style={{ background: d.color }} />
            <span className="ten-leg-name">{d.name}</span>
            {d.clase === "OTROS" ? <span /> : <span className="ten-leg-class" data-c={d.clase}>{d.clase}</span>}
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

  // buildCells emite el residual y devuelve el ORDEN DEFINITIVO. No reordenar
  // acá: un sort por peso subiría el residual al primer puesto y el gráfico
  // abriría por lo único que no tiene nombre.
  // `total` es el divisor del donut (360°) y del treemap (el marco): con el
  // residual cargado vale 100, o sea que el marco ES la cartera.
  const cells = useMemo(() => (holdings ? buildCells(holdings.items) : []), [holdings]);
  const total = useMemo(() => cells.reduce((a, b) => a + b.peso, 0), [cells]);
  const nombradas = useMemo(() => cells.filter((c) => c.clase !== "OTROS"), [cells]);
  const residual = cells.length > nombradas.length;
  // Red de seguridad. El panel valida Σ = 10.000 bps (HoldingsSchema), pero el
  // sitio no puede asumirlo: un snapshot SIN residual que tampoco cierre en 100
  // vuelve a repartir el marco entre lo que haya, y ahí las áreas sí son
  // relativas. Sólo en ese caso se declara el alcance al pie. Si el residual
  // está —o si algún día se publica la cartera completa— la nota se cae sola.
  const incompleto = !residual && total > 0 && total < 99.95;
  const placedWide = useMemo(() => squarifyConBanda(cells, TM_WIDE), [cells]);
  const placedTall = useMemo(() => squarifyConBanda(cells, TM_TALL), [cells]);

  const hasData = !!holdings && cells.length > 0 && total > 0;

  return (
    <div className="ten-wrap">
      <div className="ten-bar">
        <span className="ten-bar-label">Mayores tenencias</span>
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
          {/* Acá iba la barra de split por clase de activo, y sigue afuera: el
              residual tiene área pero no clase, así que la barra sólo podría
              sumar 60% y dejar un hueco, o normalizar y decir "Renta variable
              54,2%", que no es la asignación del Fondo sino la del pedazo que se
              publica. La clase de cada tenencia vive igual en el eyebrow de su
              celda y en el chip de su fila de la leyenda. Vuelve el día que el
              cliente pase el split por clase del tramo restante — es el pedido
              más barato que desbloquea la mejor pieza de esta sección. */}
          <div className="ten-stage" key={vista}>
            {vista === "treemap" ? <Treemap placedWide={placedWide} placedTall={placedTall} /> : <Pie orden={cells} total={total} hover={hover} setHover={setHover} />}
          </div>

          {/* Lo único que esta nota tiene que hacer es fechar el dato que está
              arriba. El "factsheet mensual" que decía antes prometía una cadencia
              que el Reglamento no obliga (literal (t): estado de cuenta semestral
              + información permanente en la Administradora), y explicar acá el
              régimen de información completo es traer el contrato a una nota al
              pie de un gráfico. */}
          {/* Con el residual dibujado esta nota vuelve a hacer UNA sola cosa:
              fechar el dato. El alcance del gráfico ya no hay que aclararlo —el
              gráfico es la cartera entera— y lo que antes vivía acá abajo pasó
              a la línea de arriba. La salvedad de `incompleto` es para el
              snapshot mal cerrado, que no debería llegar nunca. */}
          <p className="ten-foot">
            {incompleto && (
              <>
                El gráfico muestra las {cells.length} mayores tenencias, que representan el {fmt(total)} de la
                cartera; sus proporciones son relativas entre sí.{" "}
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
            Un asesor nuestro te explica la composición del Fondo en detalle.
          </p>
        </div>
      )}

      <style>{`
        .ten-wrap { margin-top: 60px; }

        /* ── Barra: título + toggle ── */
        .ten-bar { display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; min-height: 38px; }
        .ten-bar-label {
          font-size: 12px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: var(--site-ink-3);
        }
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
           su antialias. En la esquina clara —el residual, gris casi papel— eso
           pintaba un sucio oscuro sobre la curva y la hacía leer bastante más
           pesada que el mismo hairline en los tramos rectos (medido: 10 puntos de
           L* por debajo). Atribuido apagando un sospechoso por vez: sacar el navy
           lo borraba; sacar la sombra o el recorte no cambiaba nada.
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
        /* --ink lo fija la celda: blanco en todas las nombradas, navy sólo en el
           residual (ver INK_NOMBRADA / INK_RESIDUAL). El eyebrow y el peso se
           atenúan con opacity, no con un rgba blanco fijo, para que sigan a la
           tinta que toque. */
        .ten-tm-label {
          padding: calc(var(--fs) * 0.66) calc(var(--fs) * 0.62); color: var(--ink, #fff); line-height: 1.16;
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

        /* Residual: área verdadera, croma cero, fondo LISO. Entre bloques
           saturados el gris claro lee como espacio y no compite por la atención,
           que es donde tienen que quedar las tenencias nombradas. Lo único que
           cambia además del color es el borde: el hairline blanco al 10% de las
           demás celdas es invisible sobre un fondo claro. */
        .ten-tm-cell[data-res="1"] { border-color: rgba(15,34,73,0.10); }
        /* El paso de hover a medida del residual ya no vive acá: viene resuelto
           en --hov (HOVER_F_RESIDUAL), con el porqué al lado de la constante. */

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
        /* Hairline interno: el bloque residual es casi tan claro como el papel y
           su punto se perdería sin un borde. */
        .ten-leg-dot { width: 11px; height: 11px; border-radius: 3px; box-shadow: inset 0 0 0 1px rgba(15,34,73,0.10); }
        .ten-leg-name { color: var(--site-ink-2); line-height: 1.3; }
        .ten-leg-class { font-size: 9.5px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; padding: 3px 7px; border-radius: 5px; line-height: 1; }
        .ten-leg-class[data-c="RV"] { color: #1a3163; background: rgba(26,49,99,0.10); }
        .ten-leg-class[data-c="RF"] { color: #8A6A1E; background: rgba(160,124,40,0.12); }
        .ten-leg-class[data-c="ALT"] { color: #5b6172; background: rgba(154,160,180,0.18); }
        .ten-leg-pct { font-variant-numeric: tabular-nums; font-weight: 600; min-width: 34px; text-align: right; }

        /* Fila del residual: se lee como cierre de la lista, no como la novena
           tenencia. Sin número de orden, sin chip de clase, nombre en el tono
           bajo y el peso un grado más liviano — el 40% sigue siendo el número
           más grande de la columna y no hay que disimularlo, sólo no darle la
           jerarquía de una posición. El punto toma el mismo gris del wedge; se
           lo ve porque .ten-leg-dot ya trae un hairline interno. */
        /* Se probó cruzarla a las dos columnas para que leyera como cierre de la
           lista: el 1fr del nombre estira y deja el 40% a media pantalla del
           rótulo, desalineado de los otros porcentajes. En una lista de cifras
           esa columna alineada vale más que la idea, así que la fila queda del
           ancho de una celda y su 40% cae bajo los demás. */
        .ten-leg li[data-res="1"] { border-bottom-color: transparent; }
        .ten-leg li[data-res="1"] .ten-leg-name { color: var(--site-ink-3); }
        .ten-leg li[data-res="1"] .ten-leg-pct { font-weight: 500; color: var(--site-ink-2); }

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
