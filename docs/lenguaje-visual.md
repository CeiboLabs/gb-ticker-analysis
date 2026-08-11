# Lenguaje visual — Gastón Bengochea & Cía.

Guía destilada del gusto de diseño del sitio, leída de las cuatro páginas trabajadas
(`/`, `/bng-seleccion-global`, `/informes`, `/analisis` + `/analyze`). Sirve como
fuente de verdad para replicar el estilo en páginas nuevas. Los tokens viven en
`app/globals.css`; esto explica **cómo y cuándo** usarlos.

> Tesis en una línea: **casa de bolsa premium, no app retail.** Tipografía liviana y
> grande, navy + oro racionado, datos sobre hairlines (nunca en tarjetas), movimiento
> escaso con una sola curva, y voseo institucional. El lujo está en el material y la
> restricción, nunca en agregar color.

---

## 0 · Los dos sistemas (decisión #1 antes de escribir nada)

El proyecto tiene **dos sistemas tipográficos que conviven a propósito**. El salto entre
ellos *es* parte del diseño. Elegí uno por página según el registro:

| | **Institucional `.site`** (v3/v4) | **Editorial v2** |
|---|---|---|
| Para | marketing, marca, páginas del navbar, landings, **y el reporte de equity** | los informes PDF y el material impreso |
| Se activa con | `<main className="site">` | default del root (sin `.site`) |
| Fuente base | **Arial** (`--site-font`), 17px / 1.6 | IBM Plex Sans, 16px / 1.55 |
| Display | Arial **peso 400** gigante, tracking negativo | Newsreader serif peso 300 |
| Números | Arial / mono según contexto | **siempre IBM Plex Mono + tabular-nums** |
| Esquinas | redondeadas (`--r-card:14px`, `--r-btn:6px`) | **sharp, 0 radio** |
| Superficie | sombras suaves azuladas, mucho aire | hairlines, cero sombra |
| Tinta | `--site-ink #16193A` (más clara) | `--ink #0E1130` (azul-negro) |
| Sensación | folleto institucional sobrio | terminal Bloomberg / equity research impreso |

Páginas: `/`, `/bng-seleccion-global`, `/informes` y `/analisis` —landing **y** reporte—
son **`.site`**.

> **2026-07-25 — el reporte de equity pasó a Arial.** `/analisis?ticker=` conserva la
> composición editorial (hairlines, split-label, datos tabulares, cero cards) pero **toda
> su tipografía es Arial**: `.analyze-root` fija `font-family: var(--site-font)` y anula
> las tres familias del root (`--font-serif`, `--font-sans`, `--font-mono`). No quedan ahí
> ni Newsreader, ni IBM Plex, ni drop-cap, ni itálicas de acento. Si tocás el reporte,
> **no reintroduzcas serif ni mono**: el pedido fue explícito.

**Regla:** dentro de `.site`, el serif Newsreader es **opt-in** vía `.t-serif-display`
(gana al reset Arial sin tocarlo) y se raciona a 2–4 grandes momentos por página.

---

## 1 · Color

### Paleta (de `:root` y `.site` en globals.css)

```
Navy (estructura)     #0f2249  navy-700 #1a3163  navy-500 #2C3194 (azul interactivo)
                      navy-300 #6B70B8  navy-150 #C6C8E0  navy-050 #ECEDF6
Oro (acento)          #EBD288 (marca)  gold-deep #A07C28 (filetes/íconos sobre claro)
                      gold-ink #856721 (oro como TEXTO)  gold-soft #F2E3B0 (sobre navy)
Papel / marfil        ivory #F8F9FF  ivory-warm #F2F0E8  paper #FBFBFE
Tinta editorial       ink #0E1130  ink-2 #3A3E5C  ink-3 #6E7290  ink-4 #9FA2C0
Tinta .site           site-ink #16193A  -2 #4A4E6B  -3 #676B89
Hairlines             rule #D9DAE8 (editorial)  site-border #E7E8F2 (.site)  rule fuerte = ink
Datos financieros     pos #1F6B45 (verde bosque)  neg #8E2A2A (oxblood)  neu #5C5F7A (pizarra)
```

### Reglas de color (las que más definen el gusto)

1. **Navy = los dos polos emocionales, no el cuerpo.** En una página larga, `band-navy`
   aparece ~2 veces (hero/apertura + CTA de cierre). El cuerpo respira alternando
   **blanco `band` ↔ muted `band-muted #F4F5FB`** en ABAB. En el fondo el comentario es
   explícito: *"CTA (único momento navy tras el hero)."*
2. **El oro es SIEMPRE acento, jamás superficie.** Hairline de 1–1.5px, ícono de línea,
   número de proceso, una palabra del lede, subrayado de nav activo, un wash al 5% alpha,
   un glow radial sutil. Si pintás un área grande de oro, rompés el sistema. Tonos por
   fondo: `gold-deep` sobre claro, `gold-soft` sobre navy.
   **Y un tono por función:** `gold-deep` es para el TRAZO (filetes, íconos, bordes,
   superficies), `gold-ink` para el TEXTO. El primero da 3,9:1 sobre blanco y no llega al
   4,5:1 de WCAG AA, que es el umbral de cualquier palabra por debajo de 18,66px bold; el
   segundo es el mismo tono (hsl 42°, 60%) más oscuro y da 5,3:1. Al trazo no le aplica ese
   umbral, así que el acento de marca no se toca. Sobre navy no hay problema: `gold-soft`
   pasa en los dos usos.
3. **El oro nunca señaliza un dato.** El verde/rojo cargan la señal financiera; el oro es
   identidad institucional. `HOLD` usa pizarra `--neu`, **no** ámbar de semáforo.
4. **Color de datos consciente de la superficie.** `--pos/--neg` profundos sobre papel;
   versiones brillantes (`#7BC9A0` / `#E9999A`) sobre navy/ink. En charts comparativos, los
   pins van en teal/coral FT (`#0D7680` / `#C24A3A`) para *no* tocar el rojo/verde semántico.
5. **Nunca negro puro ni gris neutro.** Tinta azul-negra `#0E1130`, papel tibio `#FBFBFE`,
   sombras siempre teñidas de azul y bajísimas (`0 12px 32px rgba(3,6,94,0.06)`). Texto
   sobre navy = opacidad de blanco (`rgba(255,255,255,0.78/0.62)`), nunca un gris sólido.
6. **El "foco" dorado superior-derecho** es un motivo recurrente de iluminación:
   `radial-gradient(... at ~80% 10%, rgba(201,168,76,0.10–0.14), transparent 55%)` sobre
   cada superficie navy (hero, media-box, paneles). Una fuente de luz cálida coherente.
7. **El piso de contraste se verifica contra la superficie más oscura, no contra blanco.**
   El cuerpo alterna `band` blanca y `band-muted #F4F5FB`, y encima de la muted todavía
   puede haber un wash dorado o azul al 4–5% (paneles de Cartera, celdas de comparación):
   el fondo real termina en `#F1F1F4`. Un tono de texto calibrado contra blanco reprueba
   ahí. `site-ink-3` fue `#797D99` hasta el 6-ago-2026 y era el 98% de las faltas de
   contraste de la página del fondo — 4,03:1 sobre blanco, 3,70:1 sobre la muted— porque
   casi todo lo que pinta (notas, rótulos, metadatos) es de 11–15px. Los valores de hoy
   dejan `site-ink-3` en 4,78:1 y `gold-ink` en 4,70:1 contra ese piso.
   Herramienta: axe-core (`node_modules/axe-core`) sobre el dev con puppeteer-core.
   Ojo con lo que axe marca **incomplete** y no falla: fondos con gradiente o
   pseudo-elemento los saltea, así que ahí hay que medir el píxel pintado a mano.

---

## 2 · Tipografía

### `.site` (institucional) — "pesos livianos al estilo Marex"

- **Titulares = Arial peso 400, grandes, tracking negativo agresivo. Nunca bold.**
  La levedad ES la señal premium.
  - `.t-display` `clamp(40px,6.5vw,76px)` / `-0.025em`
  - `.t-h2` `clamp(28px,3.8vw,46px)` / `-0.02em`
  - `.t-h3` `clamp(21px,2.1vw,27px)` peso 500
  - oversized: `.t-display-xl` `clamp(44,9vw,120)`, `.t-display-xxl` `clamp(56,12vw,168)`
- **Serif Newsreader (`.t-serif-display`, peso 300, `-0.02em`) = evento, no estilo de cuerpo.**
  2–4 momentos por página: H1 del hero, una tesis, palabras pinned. El resto es Arial.
- **Cuerpo:** `.t-lead clamp(18–21px)` ink-2 → `.t-body 17px/1.65` → `.t-small 14px` ink-3.
- **Eyebrow de dos niveles** (idiosincrático, copiarlo tal cual):
  - **Suave / sección:** `.eyebrow-sm` = **14px, peso 600, sin mayúsculas, sin tracking**,
    ink-3, *sentence-case* ("Cómo invierte", "Archivo"). Rechaza el kicker de stock.
  - **Duro / micro-label de dato:** uppercase **11–13px, peso 700, `0.12–0.14em`** dentro de
    widgets (labels de barras, encabezados de tabla, roles). Los dos registros nunca se mezclan.
  - Existe `.kicker` (12px/700/`0.14em` uppercase con barrita `20×2px`) para CTAs/hero.

### Editorial v2 (informes impresos) — triángulo serif / sans / mono

Registro de research impreso. **Ya no gobierna ninguna página web**: el reporte de equity
—su último usuario— pasó a Arial en 2026-07-25 (ver §0). Queda documentado porque el
material impreso lo sigue usando y porque las clases viven en `globals.css`.

Roles **dogmáticos**:
- **Newsreader serif** = el argumento y los titulares. Prosa 16–17px/1.6, `.panel-h2` 26px,
  `.display-1..4`, escenarios/targets en serif 36–56px.
- **IBM Plex Sans** = chrome/UI: labels de eyebrow, `th` de tablas, leyendas.
- **IBM Plex Mono** = **TODO número, siempre**, con `tabular-nums` + `"tnum"/"zero" 1`.
  Ningún número escapa al mono: precios, KPIs, IDs, fechas, ejes, pills, percentiles.
- **Drop-cap dorada** (`.drop-cap::first-letter`, Newsreader 3.2em float oro) abre la prosa
  larga. Convierte markdown de IA en revista. Exclusiva del editorial (neutralizada en `.site`).

### El gesto compartido — "una palabra se inclina y se vuelve oro"

El énfasis es **cromático**, y su forma depende del sistema:
- En **`.site`**: oro **SIN itálica** (`font-style: normal; color: gold-soft/deep`) — pedido
  explícito del cliente, *nada de cursivas decorativas* (`EquipoHome.tsx:111`).
- En **editorial v2** (sólo impreso): oro **con itálica** serif peso 300. Ahí la cursiva se
  permite porque es el registro "research impreso" — pero en pantalla, incluido el reporte
  de equity, el acento va **sin inclinación**.

Números: **`tabular-nums` en toda cifra que pueda cambiar**, en ambos sistemas, para que las
columnas aliñen. Cifras grandes siempre peso 400 — el tamaño enfatiza, nunca el grosor.

---

## 3 · Layout y composición

- **Contenedor `.site`:** `.site-wrap` max-width **1200px**, gutters 24px (20px <640).
  Editorial: `.wrap` 1280 / `.wrap-narrow` 920.
- **Ritmo vertical:** `.site-section` `clamp(64px,8vw,116px)` arriba y abajo; `-sm`
  `clamp(48–72px)`. Espaciado en múltiplos de 4.
- **La columna de la firma — `.split-label`** (`0.85fr / 1.5fr`, gap `clamp(24–72px)`):
  eyebrow callado a la izquierda, titular + lead + widget a la derecha. Es la **espina dorsal**:
  cada sección abre igual → un pulso predecible. Variante `.split` (`1fr / 1.15fr`, media más
  ancha) para contenido + media. Colapsan a 1 columna <900px. Titulares capados en `max-width:
  14–16em` para controlar el rag. Editorial usa el mismo patrón con gutter fijo: `200px 1fr`
  (secciones), `260px 1fr` (veredicto).
- **Hairlines como estructura, NO tarjetas.** Toda grilla de datos se hace con bordes de 1px
  (`site-border #E7E8F2`), `gap:0`, bordes compartidos: `border-top`+`border-left` en el
  contenedor, `border-right`+`border-bottom` por celda. Así son `.cifras-row`, `.kpi-grid`,
  `.proceso-grid`, `.perf-risk`, `.estrategia-grid`. **Regla de dos pesos:** línea fuerte
  (`1px solid var(--ink)` o `1.5px navy`) como apertura sobre líneas suaves `--rule`.
  - Detalle fino: los **divisores sangran al borde del contenedor** — los ítems de borde
    anulan su padding/border externo (`:nth-child(3n+1){padding-left:0}`…). Grilla tipográfica
    precisa, cero tarjetas flotantes.
- **Bandas alternadas + dos respiraciones navy full-bleed.** El cuerpo es claro/aireado;
  los dos golpes oscuros (panel pinned, foto duotono) rompen el wrap a `min(96vw,1480px)`.
- **Alineación a la izquierda** en secciones editoriales; solo los paneles navy centran.
- **Radios** (`.site`): card 14, btn 6, input 8, pill 999. Los objetos-documento (carpeta,
  ReportPreviewMini) usan radios chicos 2–4–10px que leen "papel".
- **Las sombras se reservan para objetos-documento** (tarjeta-reporte, carpeta 3D), nunca para
  datos. Los datos viven entre hairlines sobre la superficie de la página.
- **Medida de los avisos legales — `--medida-legal: 96ch`** (en `.site` y `.analyze-root`).
  Todo aviso, nota al pie de un gráfico o bloque de disclaimer lleva
  `max-width: var(--medida-legal)`, nunca el ancho completo del wrap: un párrafo de 12px que
  corre los 1.200px son ~170 caracteres por línea y el ojo pierde el renglón al volver. El tope
  va en **`ch`** —ancho del "0" de la fuente del propio elemento— y no en `em`, para que el
  límite sea el mismo **en caracteres** aunque cada nota tenga su cuerpo (12 / 12,5 / 13,5 / 14px);
  con `em` el mismo número daba anchos distintos y las notas quedaban desparejas.
  ⚠️ Va declarado en el elemento que **tiene** el font-size, no en un contenedor que hereda otro.

---

## 4 · Movimiento

Primitivas en `components/motion.tsx` (entrada en viewport) y `components/scroll.tsx`
(ligado al scroll / scrubbing). `LenisProvider` añade smooth-scroll con inercia.

- **Una sola curva manda todo: `EASE = [0.16, 1, 0.3, 1]`** (ease-out fuerte). Repetida en
  Reveal, SplitText, heroes, hovers. Es la firma del movimiento.
- **`Reveal`** — fade + slide-up `y:26→0`, `0.75s`, `viewport once margin:-80px`. Envuelve
  el encabezado de cada sección.
- **`Stagger`/`StaggerItem`** — escalona hijos `staggerChildren:0.09`, item `y:24→0`/`0.7s`.
  Para listas y grids.
- **`SplitText`** — titular palabra por palabra detrás de máscara (`.st-mask overflow:hidden`,
  rise `y:112%→0`). `mode="enter"` (una vez, héroes above-the-fold) vs `mode="scrub"` (ligado
  al scroll del propio elemento, reversible). Opción `blur` (blur-reveal). Usar **con
  moderación** — 1 titular por página.
- **`PinnedSection`** — sticky `100dvh` mientras el contenedor (alto en `vh`) scrollea; expone
  `progress 0→1` para scrubbing. El momento cinematográfico (Trayectoria, AnalisisHero).
  Anima **clip-path**, no scale, para que las hairlines no se deformen.
- **`Counter`/`ScrollCounter`** — conteo de números (ease `[0.22,1,0.36,1]`). Úsalo para cifras
  *medibles*; para datos de marca como "1967" dejá strings estáticos.
- **Toggle pill + thumb navy deslizante** — `transition 260ms cubic-bezier(0.34,1.2,0.4,1)`
  (overshoot leve), label activo en blanco. Control firma, reutilizado para todo selector
  segmentado (períodos, treemap/donut, frecuencia).
- **Hovers** — `.ui-list-row` desliza `padding-left:0→14px`; `.link-arrow` abre `gap 8→12px` +
  flecha `translateX(2px)`; retratos B&N→color en 0.6s; glass micro-escala iOS
  (`hover scale(1.04)` con rebote) + destello que sigue al cursor.
- **Los datos NO tienen animación de entrada.** Charts y tablas "aparecen" en estado final
  (comentario explícito en `charts.tsx`). Coherencia "terminal/impreso". Excepción: la entrada
  escalonada del treemap (`animationDelay: i*38ms`) que asienta el mosaico en orden de lectura.
- **`prefers-reduced-motion` se respeta SIEMPRE**: cada primitiva cae a su estado final estático
  (sin pin, sin video, SplitText plano). No es opcional.

---

## 5 · Componentes y patrones firma

- **Liquid glass real** (`LiquidGlass.tsx`): displacement SVG por instancia + aberración
  cromática + `backdrop-filter blur saturate`. Para CTAs secundarios y la cápsula del navbar.
  El lujo es el *material*, no el color. Variantes `dark`/`light`.
- **Navbar glass adaptativo**: transparente con logo blanco sobre el hero, *flipea* a vidrio
  líquido claro **exactamente al cruzar el alto del hero** (no a un scroll arbitrario).
- **Tabla "ficha técnica"**: `1.5px` navy top rule, filas hairline, **sin verticales, sin
  cajas**, right-aligned tabular-nums, fila benchmark de-enfatizada, y una **gemela transpuesta
  para mobile** (`.perf-grid--mobile`) en vez de scroll horizontal.
- **Masthead de doble hairline**: `border-top 1px ink` (≈negro) + `border-bottom 1px rule`
  (claro). Enmarca cabeceras, veredictos, secciones, KPIs. El tell editorial número uno.
- **Carpeta 3D en CSS puro** (`CarpetaInformes`): dossier navy con lomo dorado, marco fino,
  wordmark de la casa, cantos de papel rayados, sheen especular al cursor, flotación idle.
  Reemplaza el ícono-de-archivo genérico por "la carpeta de Bengochea", sobre un plinto de luz.
- **Familia de dot-maps**: `FondoMundo` (canvas, diagonal, Uruguay en oro) + `FondoGeografia`
  (choropleth de **intensidad de navy**, sin segundo tono), ambos reusando los datos
  `worldDots*` para que todos los mapas del sitio combinen.
- **Charts como instrumento** (`lightweight-charts`): línea navy 2px, benchmark gris dashed
  **anclado al valor cuota inicial** (eje en valor cuota, no base 100), grid casi invisible,
  `handleScroll/Scale:false` (es un instrumento de lectura), **click para fijar 2 puntos** →
  markers teal/coral + readout de diff en mono. Mismo motor que el análisis de tickers, para
  que la familia de instrumentos sea una sola.
- **Treemap squarified + donut** (`FondoTenencias`): squarify hand-rolled en dos layouts
  (wide/tall) swap por media query; font-size de celda atado a su tamaño con container-query
  units; colores derivados al render (lerp por clase+rank), nunca en los datos.
- **Widgets forma-como-argumento**: díptico conectado con nodo central ("un vehículo, dos
  mitades"), comparación dash-vs-check, barra de split de activos, "firmas" de línea. La forma
  carga el significado, así no hace falta un número.
- **Íconos de línea** (`icons.tsx`): fuente única, `viewBox 24`, `stroke 1.4–1.5`, sin relleno,
  coloreados gold-deep. Geométricos, finos.
- **Footer band-navy**: CTAs gigantes estilo Marex entre hairlines, columnas con títulos
  uppercase gold-soft, íconos sociales en cuadrados con borde.

---

## 6 · Datos como diseño (el alma de esta marca)

La marca vive de mostrar datos financieros con elegancia editorial, no de dashboard:

1. **Hairlines, mono/tabular y tinta — nunca cards con sombra para datos.**
2. **Cifras grandes y livianas (peso 400).** El tamaño enfatiza, el grosor jamás.
3. **Color racionado:** navy + un oro + verde/rojo solo en deltas con signo.
4. **Charts sin chrome:** grid mínimo, sin zoom, ejes en mono ink-3, valor final en el color
   de la serie.
5. **Estados vacíos honestos como estado *diseñado*.** El fondo es pre-lanzamiento: muestra
   "—" / "se publica próximamente" con el mismo cuidado, **nunca inventa un número**. Se omite
   Sharpe porque "exige un supuesto de tasa libre de riesgo que no vamos a inventar". La
   integridad se *renderiza*, no se esconde.
6. **Determinismo SSR como oficio:** hash entero para mosaicos generativos, trig cuantizado,
   color derivado al render → server y cliente pintan el mismo pixel.

---

## 7 · Voz y copy

- **Voseo rioplatense** en todo el microcopy y CTAs: "Cargá", "Agendá", "Probá", "Conocé",
  "Invertí", "Tocá el gráfico", "Escribinos".
- **Titulares = oraciones declarativas cortas con punto final.** "Una puerta local al mercado
  internacional." · "El mundo, en una sola posición." · "Lectura semanal y mensual del mercado."
  Casi aforísticos, en Arial liviano leen como títulos de capítulo.
- **Eyebrows en sentence-case, cortos** ("¿Por qué GB?", "Cómo trabajamos", "Archivo").
- **Anti-hype, apela a trayectoria/regulación/seguridad** (1967, BVM, BCU, cuentas segregadas),
  nunca a rendimientos prometidos. "Los atributos no se proclaman: se ejecutan."
- **Conceptos por contraste y mecanismo**, no por adjetivos. La Diferencia se explica como
  *lo que el fondo te resuelve* (dash vs check), sin nombrar competidores ni prometer outperform.
- **Honestidad pre-lanzamiento:** el perfil es "tres verbos" (un mindset objetivo), nunca un
  testimonio falso. La credibilidad se toma prestada de la casa, no de un track record inexistente.
- **Disclaimers presentes pero callados** (12px ink-3, hairline top). Todo camino termina en
  una conversación humana: "La mejor respuesta sigue siendo una conversación."
- En el material impreso conviven dos registros sin chocar: **los números y la cáscara hablan
  en mono (terminal); el argumento habla en serif (editorial).** En pantalla ese contraste ya
  no se usa: el reporte de equity dice las dos cosas en Arial, y separa dato de argumento con
  tamaño, color y hairlines.

---

## 8 · Checklist de replicación

**Hacé**
- [ ] Elegí el sistema primero: `.site` (marketing) o editorial v2 (producto/research).
- [ ] Abrí cada sección con `.split-label` (eyebrow callado izquierda, contenido derecha).
- [ ] Titulares en Arial peso 400 grande con tracking negativo; punto final.
- [ ] Serif `.t-serif-display` racionado a 2–4 momentos por página.
- [ ] Eyebrow de dos niveles: `.eyebrow-sm` sentence-case para secciones; uppercase 700 para datos.
- [ ] Datos sobre hairlines con regla de dos pesos; `tabular-nums` en toda cifra.
- [ ] Bandas ABAB blanco↔muted; navy solo en apertura y CTA de cierre.
- [ ] Oro solo como acento (hairline, ícono, una palabra, wash ≤20% alpha).
- [ ] Un solo ease `[0.16,1,0.3,1]`; `Reveal` en cada encabezado; reduced-motion siempre.
- [ ] Voseo; copy anti-hype que apela a la casa.

**No hagas**
- [ ] ❌ Tarjetas con sombra/gradiente para datos (usá hairlines).
- [ ] ❌ Oro como superficie grande ni como señal de dato (eso es verde/rojo).
- [ ] ❌ Titulares en bold; ámbar de semáforo para HOLD; negro puro / gris neutro.
- [ ] ❌ Cursivas decorativas en `.site` (el énfasis dorado va sin itálica).
- [ ] ❌ Animación de entrada en charts/tablas; scroll-jacking gratuito; autoplay ruidoso.
- [ ] ❌ Kickers uppercase tracked-out de stock para secciones (usá `.eyebrow-sm`).
- [ ] ❌ Inventar números/estados; mostrar "—" honesto con el mismo cuidado.

**Referencia negativa:** `components/institucional/Servicios.tsx` y `PorQueElegirnos.tsx` son
el lenguaje viejo/templated que este sistema reemplazó (headings centrados, íconos multicolor,
`glass-light`/`glow-card`, opacidades de texto). No los uses como modelo.

---

## Archivos clave

- `app/globals.css` — todos los tokens. Editorial v2 ≈ líneas 9–616; `.site` ≈ 618–1311.
- `components/motion.tsx` / `components/scroll.tsx` — primitivas de animación.
- `components/institucional/LiquidGlass.tsx` — material glass.
- `components/institucional/icons.tsx` — set de íconos de línea.
- **Página de referencia máxima:** `/bng-seleccion-global` (la pieza más lograda — narrativa por
  beats, datos como diseño, restricción de color y movimiento).
