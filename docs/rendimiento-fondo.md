# Rendimiento de /bng-seleccion-global — estudio y puntos de optimización

**Fecha:** 5-ago-2026 · **Alcance:** SÓLO la página del fondo (`app/(fondo)/bng-seleccion-global`),
en su forma de deploy real: el sitio estático de `dist/fondo` que arma `scripts/build-fondo.mts`.
No se midió el sitio institucional ni `/analisis`.

**Estado:** APLICADO el 6-ago-2026. Todo lo que sigue quedó implementado y
re-medido; los deltas de cada sección son los que efectivamente se obtuvieron.
Sin commitear.

---

## Resultado

Mediana de 7 cargas, teléfono 390×844, 4G (9 Mbps · 60 ms RTT), CPU 6× más lento,
caché fría, sobre el build estático real de `dist/fondo`:

| | antes | después | |
|---|---|---|---|
| **LCP** | 724 ms | **436 ms** | −288 ms (−40 %) |
| **TBT** | 108 ms | **43 ms** | −65 ms (−60 %) |
| **CLS** | 0,0068 | **0,00000** | eliminado |
| **Red** | 507 KB | **333 KB** | −174 KB (−34 %) |
| **Nodos del DOM** | 3 559 | **981** | −2 578 |
| HTML (brotli) | 45,2 KB | 27,5 KB | −39 % |
| Archivos de fuente bajados | 6 (190 KB) | 1 (57 KB) | −133 KB |

Verificado además:

- **Nada cambió visualmente.** Comparación píxel a píxel de las 17 pantallas de
  la página, antes contra después: el alto del documento es idéntico (14 463 px)
  y 15 de 17 tramos son binariamente iguales. Los dos que difieren son el hero
  (delta máximo de 1 sobre 255 — ruido de compresión) y el mapa de geografía,
  donde el 0,8 % de los píxeles cambia por el antialiasing de canvas contra el de
  SVG. A 3× de zoom los dos mapas tienen los mismos puntos, tamaños y colores.
- **El resaltado por región del mapa se comporta igual** (opacidades 1 / 0,5 /
  0,16 y la misma transición de 240 ms).
- **La cursiva de Newsreader sigue cargando** donde se usa (`/analisis`:
  `Newsreader 300 italic` presente, `.rpm-h em` en `style=italic`).
- **Lenis sigue andando** (`html.lenis`, scroll suave) y sigue sin instanciarse
  con `prefers-reduced-motion: reduce`.
- Tests 41/41, `tsc` y `eslint` limpios sobre lo tocado.

---

## 0. Cómo se midió (y qué NO cubre)

El build de `dist/fondo` se sirvió en un puerto local con la misma cáscara que
Cloudflare: brotli en HTML/JS/CSS, `immutable` en `/_next/static/*`, y `/api/fondo`
proxeado al dev server. Los datos salen de Chrome por CDP (`puppeteer-core` +
el Chrome del sistema, ver [[reference_screenshot_headless]]), con caché deshabilitada.

Dos perfiles:

| perfil | viewport | red | CPU |
|---|---|---|---|
| escritorio | 1440×900 | sin límite | 1× |
| teléfono | 390×844 @3x | 4G (9 Mbps, 60 ms RTT) | 6× más lento |

Cada optimización se verificó con un **A/B real**: se generó una variante del build
con el cambio aplicado y se corrió la mediana de 5–7 cargas contra la base.

### Límites de la medición — leer antes de usar los números

- **El scroll se midió con eventos de rueda sintéticos**, no con un dedo ni un trackpad.
  Los números de frames son buenos para descartar jank groso, no para afirmar que no
  existe. Safari, que es donde este sitio ya tuvo problemas de scroll reales
  (ver [[reference_display_none_capas_safari]], [[reference_safari_medicion_safaridriver]]),
  **no está cubierto**: todo esto es Chrome.
- **El TBT varía mucho entre corridas** (se vieron entre 109 ms y 614 ms para la misma
  página). Los números que se citan son medianas de 7; las cifras sueltas no sirven.
- Los A/B de las secciones 3 y 5 se hicieron parcheando el build. Dos variantes
  intermedias (`c`, `d`, `e`) **rompieron la hidratación** al tocar el texto de los
  `<style>` inline — eso está documentado en el propio código y se confirmó acá. Sus
  deltas de LCP siguen valiendo (el LCP ocurre antes de hidratar); sus deltas de TBT no,
  y por eso no se citan. La variante `f`, que parchea HTML **y** JS a la vez, hidrata
  bien y es la que se usa para el hallazgo del mapa.

---

## 1. Línea de base

### Lo que viaja por la red (cache frío, brotli)

```
29 peticiones · 514 KB
   Script       13 req   232 KB      (1,05 MB sin comprimir ← lo que hay que parsear)
   Font          6 req   190 KB
   Document      1 req    44 KB      (383 KB sin comprimir)
   Stylesheet    3 req    22 KB      (155 KB sin comprimir)
   Fetch         2 req     7 KB      (/api/fondo)
   resto         4 req    19 KB
```

### Métricas

| | escritorio | teléfono (4G · CPU 6×) |
|---|---|---|
| TTFB | 332 ms | 358 ms |
| FCP | 608 ms | ~730 ms |
| **LCP** | **608 ms** | **728 ms** (mediana de 7) |
| CLS | 0 | 0,0068 |
| TBT | 3 ms | 109 ms (mediana de 7) |

El elemento LCP es el `<h1>` del hero (`.fh-h1.t-serif-display`). No hay imagen ni video
en esta página: el hero es un SVG de 24 polígonos. Eso ya está bien resuelto.

### Cobertura del código descargado

```
JS : 385 KB ejecutados de 937 KB      → 41 %   (552 KB nunca se ejecutan)
CSS: 85 KB usados de 135 KB           → 63 %
CSS de fuentes (0zva3i40): 300 B de 19,8 KB → 1,5 %
```

---

## 2. Fuentes: 135 KB precargados que la página no usa nunca

**Impacto medido: −100 ms de LCP, −133 KB de red. Esfuerzo: bajo. Riesgo: bajo.**

El `<head>` precarga **seis** archivos woff2 (190 KB) con prioridad `High`, que es la misma
banda que compite con el CSS que bloquea el render. El renderer reporta que usó **una sola**:

```
document.fonts (status "loaded")  →  ["Newsreader 300 normal"]
```

Las otras cinco se bajan y se tiran:

| archivo | familia | bytes | ¿se usa? |
|---|---|---|---|
| `9433d1a8…` | Newsreader *italic* | 64 500 | no |
| `5f402bd2…` | Newsreader normal | 58 152 | **sí** — el `<h1>` y `.perfil-tesis` |
| `03fc1b4a…` | IBM Plex Sans | 40 240 | no |
| `99e60927…` | IBM Plex Mono 400 | 10 052 | no |
| `e9d5b069…` | IBM Plex Mono 300 | 10 112 | no |
| `effe9197…` | IBM Plex Mono 500 | 10 060 | no |

### Por qué pasa

`app/layout.tsx` declara las tres familias con `next/font/google`. La documentación de la
versión instalada (`node_modules/next/dist/docs/01-app/03-api-reference/02-components/font.md`,
línea 1050) es explícita:

> If it's the root layout, it is preloaded on all routes.

Y esta página no las usa porque `.site` —la clase que envuelve todo el `<main>`— resetea
la tipografía a Arial del sistema:

```css
.site { --site-font: Arial, "Helvetica Neue", Helvetica, system-ui, sans-serif; }
.site .display-1, .site .lede, .site .serif, .site .serif-i { font-family: var(--site-font); }
.site .t-serif-display { font-family: var(--font-serif), "Newsreader", Georgia, serif; }  /* ← la única excepción */
```

Se cruzaron los 217 nombres de clase del HTML del fondo contra los selectores del CSS que
piden cada familia: **ningún selector de `--font-sans` ni de `--font-mono` aparece en esta
página**. De `--font-serif` sólo aparece `.t-serif-display`, y en estilo normal.

Corolario menor: el CSS `0zva3i40_k6wd.css` son 66 declaraciones `@font-face`, 19,8 KB, de
los cuales el navegador usa 300 B (1,5 %).

### Salidas

1. **Mínima** — `preload: false` en `plexSans` y `plexMono`. Siguen definidas y siguen
   cargando donde se usan (`/analisis`, `/admin`), sólo pierden el `<link rel=preload>`.
   Ahorro en esta página: 80 KB.
2. **Completa** — partir Newsreader en dos llamadas (`style: ["normal"]` con preload, y una
   segunda con `style: ["italic"]` y `preload: false`), porque la itálica **sí se usa** en el
   institucional (`.serif-i`, `.dek`, `/prensa`) pero no acá. Ahorro total: 135 KB.
3. **Estructural** — sacar las familias del layout raíz al patrón `app/fonts.ts` que la
   propia doc de Next recomienda (línea 468) y aplicarlas en
   `app/(institucional)/layout.tsx`. Es lo más limpio y lo que hace que el problema no
   vuelva, pero toca las dos cáscaras.

⚠️ La verificación de que no rompe nada es la misma medición: `document.fonts` después de
cargar cada página del institucional.

---

## 3. El mapa de geografía: 2 554 `<circle>` en el DOM

**Impacto medido: −132 ms de LCP, −68 ms de TBT (109 → 41 ms), −2 554 nodos. Esfuerzo: medio. Riesgo: medio.**

`FondoGeografia` renderiza el choropleth como SVG, un `<circle>` por punto de tierra:

- **117 349 B del HTML** — el 31 % del documento entero;
- los datos viajan **además** en el bundle: un array de 2 554 pares en `08np3abz0ctvc.js`
  (32,7 KB de los 46,9 KB de ese chunk);
- 2 554 nodos que React tiene que hidratar;
- y hacen que **cada recálculo de estilo completo de la página** cueste 3,2× más:

```
recálculo de estilo forzado (mediana de 12, CPU 4×)
   con el mapa : 31,2 ms
   sin el mapa :  9,9 ms      → 21,3 ms menos (68 %)
```

En brotli el SVG comprime muy bien (sólo ~5 KB de diferencia), así que **esto no es un
problema de ancho de banda: es de parseo, de nodos y de estilo.**

### La inconsistencia

`FondoMundo` dibuja el mismo mapa de puntos, en la sección Resumen, y lo hace en canvas.
Su propio comentario dice por qué:

> Canvas (no SVG) por costo de pintado; mapa estático.

`FondoGeografia` toma la decisión opuesta sobre el mismo dibujo, a mayor escala.

### Qué habría que resolver para pasarlo a canvas

El SVG no está de adorno: sostiene el hover por región (opacidad de 5 `<g>`) y el
`aria-label` del `role="img"`. En canvas:

- el resaltado se resuelve **redibujando** los 2 554 puntos con la paleta atenuada — a
  ~1–2 ms por redibujado es más barato que el repintado actual (medido: 33 ms hasta el
  segundo frame pintado con CPU 4×, o sea un frame perdido por cada hover);
- la accesibilidad se conserva igual: el `aria-label` ya enumera las cinco regiones con su
  peso, y la leyenda `<ol>` de al lado es la que de verdad se lee con lector de pantalla.
  Los círculos ya llevan `pointer-events: none` y no son focusables.

**Alternativa más barata si no se quiere tocar el render:** dejar el SVG pero **no
hidratarlo** — el mapa es estático salvo por la opacidad de 5 grupos, que se puede manejar
con CSS (`:has()` sobre un radio/checkbox, o clases en el contenedor). Eso saca los 2 554
nodos del trabajo de hidratación sin reescribir el dibujo. No baja el peso del HTML.

---

## 4. El navbar del sitio institucional viaja en el bundle del fondo

**Impacto: 47,9 KB sin comprimir / 12,9 KB de red, de los cuales se ejecutan 171 B (0,4 %). Esfuerzo: bajo. Riesgo: bajo.**

El chunk `14uh_upchpd94.js` se descarga en la carga inicial y es el **mega-panel del sitio
institucional**, con todo su copy adentro:

```
clases CSS : nav-burger, nav-capsule-row, nav-caret, nav-cta, nav-drawer,
             nav-feat-cover, nav-consultanet, hero-media, hero-split, …
textos     : "Agendá una reunión", "Las personas de la mesa",
             "Glosario, guías y preguntas frecuentes",
             "Herramienta de análisis de acciones", …
cobertura  : 171 B de 47 918 B ejecutados
```

Es justamente lo que `app/(fondo)/layout.tsx` dice que este sitio **no** monta:

> Qué NO trae, y por qué: el `Navbar` mega-panel de la casa — es el mapa de OTRO sitio.

### Por qué entra igual

```
app/not-found.tsx  →  import { Navbar } from "@/components/institucional/Navbar"
                   →  import { FooterInstitucional } from "…/FooterInstitucional"
```

El `not-found` raíz entra en el grafo de cliente de **toda** ruta, porque cualquier ruta
puede caer en él en runtime. El barrido de assets de `build-fondo.mts` lo sigue —
correctamente, porque el runtime lo puede pedir — y termina publicado en el dominio del fondo.

### Salidas

1. Un `app/(fondo)/not-found.tsx` propio, mínimo. No alcanza solo: el raíz sigue en el grafo.
2. Que `app/not-found.tsx` no importe la cáscara institucional (una 404 autosuficiente, como
   la que `build-fondo.mts` ya genera para el deploy estático en `notFoundHtml()`), y que la
   404 con navbar viva en `app/(institucional)/not-found.tsx`.

La opción 2 es la que de verdad saca el chunk, y de paso alinea el 404 de la app con el que
el build del fondo ya escribe a mano.

---

## 5. 28 KB de comentarios CSS que se publican, por duplicado

**Impacto: −7,9 KB de brotli en el HTML, ~−48 ms de LCP (estimado, ver límites). Esfuerzo: medio. Riesgo: alto si se hace mal.**

El HTML lleva 13 bloques `<style>` inline con 78 572 B de CSS. **28 368 B (36 %) son
comentarios** — la documentación larga que este código usa para explicar cada decisión.

Y viajan dos veces, porque no comparten archivo y la compresión no puede deduplicar entre
archivos:

- de los componentes **cliente**: el template literal está en el chunk JS (~49 KB medidos
  en `0mt5xohkp5y8h.js` y `096ecsh5pm8.5.js`) **y** en el HTML del SSR;
- de los componentes **servidor** (la propia `page.tsx`): en el HTML **y** en el payload RSC
  (107 KB, el 28 % del documento).

Medido sobre `index.html`:

```
                         raw       gzip    brotli
actual                383 489     68 110    45 233
sin comentarios CSS   353 068     55 065    37 309   → −7 924 B brotli
```

### ⚠️ Esto NO se puede arreglar post-build

Se intentó y **rompe la hidratación**: React compara el texto del `<style>` que mandó el
server con el que produce el cliente; si no coinciden, re-renderiza la página entera en el
cliente. Es exactamente la trampa que el comentario de `page.tsx:561` ya advierte. El
arreglo tiene que estar en el **origen**:

- un paso del build que minifique los template literals de `<style>` en **las dos** salidas
  (el chunk y el SSR) — un plugin de Turbopack, o mover el CSS de los componentes a archivos
  `.css` co-locados, que Turbopack ya minifica y deduplica;
- o mover los comentarios largos fuera del literal, a comentarios de JS arriba del bloque.
  Es lo más barato y no necesita tooling: el comentario sigue al lado del código, deja de
  viajar al navegador. Pierde la adyacencia línea-a-línea con cada regla.

**No conviene borrar los comentarios.** En este código son el activo, no el ruido: hay reglas
cuya razón de ser no es deducible (ver el bloque de `.ffac-fuera` sobre `display:none` en
Safari). La opción de moverlos fuera del literal conserva todo.

---

## 6. Puntos menores, ordenados por relación esfuerzo/beneficio

| # | Hallazgo | Costo | Salida |
|---|---|---|---|
| 6.1 | `/api/fondo` devuelve **62,8 KB de JSON** (7,4 KB en red) con una serie benchmark de ~1 200 puntos diarios. En pre-lanzamiento `live === false`, `FondoChart` no monta y el benchmark se filtra a `[]`: se baja, se parsea y se descarta. | 7,4 KB + parseo, en el camino crítico (prioridad `High`) | Que el endpoint no mande `benchmark` mientras `status === "pre-launch"`, o que el cliente lo pida aparte recién cuando haya serie propia. |
| 6.2 | **CLS 0,0068–0,0095**, fuente única: `DIV.resumen-map`. El `<canvas>` de `FondoMundo` no tiene tamaño intrínseco hasta que el `ResizeObserver` lo dibuja. | CLS chico pero evitable | `aspect-ratio` en `.fmapa`, o atributos `width`/`height` en el canvas. |
| 6.3 | **framer-motion**: 122 KB sin comprimir / 35,6 KB de red, **25 % ejecutado**. En esta página se usa para `Reveal` (×10) y el parallax del hero. `LenisProvider` lo importa **sólo** por `useReducedMotion`. | 35,6 KB | Lo barato y sin riesgo: sacar `useReducedMotion` de `LenisProvider` (es un `matchMedia` de una línea). Lo grande —`Reveal` con IntersectionObserver + CSS— saca la librería entera de la página, pero hay que verificar que el hero quede igual. |
| 6.4 | `apple-icon-180x180.png` (15,3 KB) se baja con prioridad `High` desde el manifest. | 15,3 KB | Referenciar en el manifest un ícono más chico, o sólo el de 96. |
| 6.5 | El scrollspy de `FondoNav` hace `getElementById` + `getBoundingClientRect()` de **8 secciones en cada frame de scroll**. Hoy no genera jank medible (§7), pero es una lectura de layout por frame que un `IntersectionObserver` no necesita. | 0 medible | El propio componente ya dice por qué no usó IO. Dejar como está salvo que aparezca jank en Safari. |
| 6.6 | El CSS principal (135 KB) está al 63 % de uso; el plugin `@tailwindcss/typography` (`.prose`, 19,7 KB sin comprimir) no se usa en esta página. | ~2 KB brotli | No vale la pena solo; sí como parte de un split de CSS por sitio, si alguna vez se hace. |

---

## 7. Lo que se revisó y **no** es problema

Vale tanto como lo anterior, porque marca dónde no gastar esfuerzo:

- **El scroll no tiene jank.** Con compositing real, teléfono 390×844 y CPU 6× más lento,
  sobre una página de 19 133 px: mediana 16,6 ms, p95 18,4 ms, p99 18,8 ms, **cero frames
  por encima de 32 ms**. Lenis no está costando frames. *(Salvedad: rueda sintética, Chrome
  únicamente — ver §0.)*
- **En reposo la página consume 1,8 % de CPU** con el hero a la vista y 1,4 % al pie. La luz
  rasante y su `animation-play-state: paused` fuera de cuadro están haciendo su trabajo.
  Lo que sí queda es el `requestAnimationFrame` de Lenis girando a 60 fps para siempre,
  incluso quieto: es batería, no jank.
- **No hay video ni imágenes pesadas.** El hero es SVG; el mapa del Resumen, canvas. Los
  13 MB de `public/video` son del hero institucional y **no** entran en este deploy.
- **`lightweight-charts` (161 KB) está bien diferido** y en pre-lanzamiento no se carga
  nunca: `FondoChart` sólo monta con `live === true`.
- **El barrido de assets de `build-fondo.mts` funciona**: 49 archivos, sin referencias
  colgadas. La `verificar()` que se agregó después del `ChunkLoadError` está haciendo efecto.
- **El LCP es texto, no imagen** — y el texto ya se pinta con la fuente de sistema por el
  `display: swap`.

---

## 8. Qué se cambió, archivo por archivo

| § | Cambio | Dónde |
|---|---|---|
| 2 | Newsreader partida en dos llamadas (normal con preload, itálica sin él); `preload: false` en IBM Plex Sans y Mono; la cursiva en serif pide `--font-serif-i` | `app/layout.tsx`, `app/globals.css`, `ReportPreviewMini.tsx`, `informe/ArticuloInforme.tsx` |
| 3 | El choropleth pasa de 2 554 `<circle>` a un `<canvas>`; el resaltado por región se anima redibujando | `components/institucional/FondoGeografia.tsx` |
| 4 | El 404 raíz deja de montar el mega-panel y el pie de la casa; marca tipográfica en su lugar | `app/not-found.tsx` |
| 5 | Etiqueta `css` que saca los comentarios de los bloques de estilo en server y cliente por igual; aplicada a los 18 bloques del árbol del fondo | `lib/css.ts` (nuevo) + 17 componentes |
| 6.1 | En pre-lanzamiento la respuesta de `/api/fondo` no lleva la serie del benchmark | `lib/fondoApi.ts` |
| 6.2 | El canvas del mapa del Resumen declara su tamaño intrínseco | `components/institucional/FondoMundo.tsx` |
| 6.3 | `LenisProvider` lee la preferencia con `matchMedia` en vez de importar framer-motion | `components/LenisProvider.tsx` |
| 6.4 | El manifest del fondo deja de listar el ícono de 180 (lo pedía Chrome en cada carga: 15,3 KB) | `scripts/build-fondo.mts` |

Dos cosas que la implementación enseñó y que conviene no volver a aprender:

- **El 404 raíz le cobra recursos a todas las páginas.** La primera versión de
  §4 usaba el logo como imagen; React levanta los recursos de lo que renderiza,
  así que apareció un `<link rel="preload" as="image">` del logo en el `<head>`
  de la página del fondo, que no lo muestra nunca. Por eso la marca es texto.
- **El CLS de §6.2 no se arregló solo.** Después de aplicar §2 y §3 una medición
  suelta dio 0 y parecía resuelto; sobre 5 cargas seguía dando 0,0068 idéntico.
  El arreglo real es el tamaño intrínseco del canvas, y se comprobó aislado
  (misma build, sólo los atributos: 0,00683 → 0,00000).

### Lo que queda sin hacer

- **§6.5 y §6.6** — el estudio ya recomendaba no tocarlos.
- **La otra mitad de §5**: los comentarios siguen viajando dentro del chunk de JS
  de cada componente cliente, porque ahí vive el literal. Sacarlos de ahí necesita
  una transformación del bundler.
- **framer-motion sigue en la página** (122 KB sin comprimir / 35,6 KB de red,
  25 % ejecutado). Sacar el import de `LenisProvider` era el paso barato, pero la
  librería entra igual por `Reveal` y sobre todo por el hero, que la usa para el
  parallax. Reemplazarla ahí es reescribir la parte más ajustada de la página
  —el encuadre del mosaico, la luz, la coreografía de entrada— y no se hizo:
  el estudio lo listaba como "menor" y con la salvedad de verificar que el hero
  quedara igual. Es el próximo paso obvio si se quiere seguir.
- Lo estructural del cierre de §7 sigue igual de vigente.

El resto de lo grande —los 272 KB del runtime del App Router para una página única y sin
navegación interna, los 227 KB de react-dom— es estructural: la misma pregunta que
`build-fondo.mts` ya se hizo del lado del server ("el server de Next no aporta NADA en
producción") vale del lado del cliente. No entra en el alcance de este estudio, pero queda
anotado: **41 % del JS descargado es el único que se ejecuta.**
