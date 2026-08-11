# Dimensionado del servidor — sitio institucional + panel + /analisis

Estudio del 2026-08-05. Todo lo que sigue está **medido sobre el código de
`feat/institucional`**, no estimado, salvo donde dice explícitamente "supuesto".

## Método y sus límites

- Build de producción real (`next build`, Next 16.2.6 + Turbopack) sobre una
  copia del repo en `$TMPDIR`, para no voltear el `next dev` del desarrollador
  (mismo truco que `scripts/build-fondo.mts`).
- `next start` en el puerto 3100, `NODE_ENV=production`, `MOCK_REPORT=true`.
  Carga generada con `curl`/`xargs -P`; CPU por request medida como delta del
  tiempo de CPU del proceso (`ps -o time`) sobre N requests.
- **`MOCK_REPORT=true` corta recién en el paso 4 de `/api/analyze`** (línea
  1284): el fan-out completo a Yahoo + EDGAR + segmentos ya corrió. O sea que
  la medición del análisis fresco es real; lo único que falta es la llamada a
  OpenAI, que es espera de red, no CPU.

Dos advertencias sobre los números:

1. **Se midió en un Mac Apple Silicon.** Un vCPU compartido de VPS rinde
   aproximadamente **2 a 2,5 veces menos** por core. Los milisegundos de CPU de
   abajo hay que multiplicarlos por ~2,5 para un servidor típico. Es un supuesto,
   no una medición.
2. **`gestapp` estaba apagado** (Tailscale: *offline, last seen 2h ago*), así que
   no se pudo medir el proceso de producción real. Los números de runtime salen
   del build local corriendo en modo producción.

---

## Lo que se midió

### Build

| | |
|---|---|
| Tiempo total (`next build`) | **13,5 s** de reloj, 25,3 s de CPU acumulada |
| **Pico de memoria del build** | **1,04 GB** |
| Workers de generación estática | 7 (uno por core disponible) |
| Salida `.next/` | 47 MB (43 MB de server, 2,7 MB de estático) |
| `node_modules` | 607 MB |

El build es **el momento de mayor consumo de RAM de todo el sistema** — más que
servir tráfico. Es el número que fija el piso.

### Runtime (`next start`, un solo proceso)

| Momento | RSS |
|---|---|
| Recién levantado, tras servir la home | 133 MB |
| Con todas las rutas calientes | 166 MB |
| Después de carga sostenida + análisis frescos | 271–337 MB |

Un solo proceso `next-server` con 21 threads. Bajo ráfaga se lo vio llegar a
**299 % de CPU** (usa el threadpool de libuv y los threads de fondo de V8), pero
**el render de React es un solo hilo**: más cores absorben trabajo paralelo, no
aceleran un render individual.

### CPU por request

| Ruta | CPU / request | Nota |
|---|---|---|
| `/equipo` | **3,9 ms** | página estática |
| `/` (home) | **6,2 ms** | con video de fondo |
| `/analisis` (landing) | **11,6 ms** | |
| `/bng-seleccion-global` | **17,8 ms** | la más pesada del build |
| `/api/og/*` (tarjeta OG, Satori) | **26 ms** | 137 ms de reloj |
| `/api/analyze` **cache hit** | **4 ms** | leer un informe es gratis |
| `/video/hero-home.mp4` (13,4 MB) | 53 ms | casi todo syscall |

### `/api/analyze` fresco — lo más pesado del sitio

Medido sin OpenAI (el fan-out completo de datos sí corrió):

| Ticker | CPU | Reloj | Δ RSS |
|---|---|---|---|
| MU (liviano) | **990 ms** | 15,4 s | +7 MB |
| ORCL (pesado, ~12,6 MB de filings SEC) | **1.300 ms** | 11,4 s | +29 MB |

Reproduce lo que ya se había medido en el diagnóstico del 1102 de julio (ORCL
1.212 ms / MU 593 ms). Sumándole OpenAI, un análisis fresco completo es:

- **~1,0–1,5 s de CPU**
- **45–75 s de reloj** (la ventana de OpenAI es espera pura, ~0 CPU)
- **~30 requests a SEC EDGAR**
- **~US$ 0,06 de OpenAI** (gpt-4o, `max_tokens: 7000`)
- ocupa una request viva ~1 minuto, con 10–30 MB de heap

### Peso por página — medido con browser real

Medido con puppeteer-core + Chrome del sistema leyendo
`Network.loadingFinished.encodedDataLength` del CDP: **bytes reales sobre el
cable, ya comprimidos**, no tamaños de archivo. "Fría" = contexto nuevo con cache
vacío; "tibia" = recarga en el mismo contexto.

| Página | Fría (desktop) | Tibia | Fría (mobile 390px) |
|---|---|---|---|
| **`/` (home)** | **17,67 MB** | 0,09 MB | 17,29 MB |
| `/equipo` | 3,36 MB | 0,08 MB | 2,89 MB |
| `/informes` | 2,89 MB | 0,12 MB | 1,96 MB |
| `/analisis` | 2,72 MB | 0,11 MB | 1,89 MB |
| `/calculadora` | 2,52 MB | 0,07 MB | 1,69 MB |
| `/contacto` | 2,51 MB | 0,07 MB | 2,11 MB |
| `/bng-seleccion-global` | 0,59 MB | 0,08 MB | 0,59 MB | (ya está en Cloudflare, no paga este server) |

**La visita tibia es prácticamente gratis** (70–120 KB): el `ETag` hace que todo
revalide con 304. En bytes no cuesta nada; en latencia son decenas de round-trips.

### De qué están hechos esos 17,67 MB de la home

| | |
|---|---|
| `hero-home.webm` | **11,54 MB** (Chrome elige webm sobre el mp4 de 13,4) |
| 4 videos de industrias | **3,28 MB** — logística 1,37 · agro 1,20 · energía 0,36 · tecnología 0,34 |
| **Lastre del navbar** | **1,94 MB** — ver abajo, va en TODAS las páginas |
| Posters | 0,65 MB |
| JS + fuentes + HTML + CSS | 0,58 MB |

Los cuatro videos de industrias **se descargan sin scrollear**: `LoopVideo` les
pone `preload="auto"` + `autoPlay` (`components/institucional/Industrias.tsx:80`),
así que el usuario que rebota en el fold paga 3,28 MB que nunca vio.

### El lastre del navbar: 1,94 MB en cada página del sitio

Esto explica por qué `/calculadora` —una página sin fotos— pesa 2,52 MB. El
mega-panel del navbar monta sus imágenes destacadas en todas las páginas, aunque
el panel esté cerrado:

| Archivo | Peso | Resolución real | Se dibuja a |
|---|---|---|---|
| `/informes-carpeta.png` | **1.194 KB** | 1100×1498 PNG | ~155×210 px |
| `/hero/contacto.jpg` | **435 KB** | 1600×1882 | 90×118 px (`.nav-feat-cover`) |
| `/hero/equipo-mesa.jpg` | **353 KB** | 1600×2000 | 90×118 px |

Son tres miniaturas servidas a **~18× la resolución que usan**. Reencodeadas al
tamaño real ×2 de DPR entran en **~90 KB las tres**: **21× menos, en cada página
del sitio**. Es exactamente el gotcha de "imagen grande en slot chico" que ya
está anotado.

### Headers de cache — un CDN no lo cachea solo

| Ruta | `Cache-Control` que manda Next |
|---|---|
| `/_next/static/*` | `public, max-age=31536000, immutable` ✅ |
| **`/video/*`, `/hero/*`, `/equipo/*`, todo `public/`** | **`public, max-age=0`** ⚠️ |

Todo lo de `public/` sale con `max-age=0`. Para el browser alcanza (revalida con
304, barato), pero **un CDN adelante no lo va a cachear con TTL largo por sí
solo**: hay que poner los headers en `next.config.ts` o una Cache Rule en el CDN.
Sin eso, el CDN reenvía al origen y el ahorro no aparece.

### Base de datos

Hoy: 1,9 MB. Las tablas que crecen:

| Tabla | Peso por fila | Retención |
|---|---|---|
| `analyze_events` | ~3,5 KB | 90 días (se autopurga) |
| `verdict_log` | ~2 KB | **append-only, exenta de retención** |
| PDFs del panel (`data/r2/`) | 0,3–1,5 MB c/u | permanente |

A 50 análisis frescos/día: ~16 MB estables de eventos + ~36 MB/año de
`verdict_log`. Al tope del cap global (1.500/día): ~470 MB de eventos +
**~1 GB/año** de `verdict_log`.

---

## Modelo de carga para 3.000 clientes

**Supuestos declarados** (el sitio es institucional, no una plataforma
transaccional — no hay home banking ni sesiones largas):

- El evento de pico no es el tráfico diario: es **el envío de un informe a los
  3.000 clientes**.
- Apertura de mail 30 % → 900. De esos, 10–15 % entra al sitio → **~110 visitas**,
  con ~60 % en las primeras dos horas.
- Pico: **35–55 sesiones/hora**, con una ráfaga inicial de **20–30 sesiones en
  los primeros minutos**.
- ~8 requests al origen por sesión (HTML + chunks; el resto lo cachea el browser).

### CPU en el pico

30 sesiones en 5 minutos × 8 requests = 0,8 req/s. A 6–18 ms de CPU por página
(×2,5 por ser un vCPU de VPS = 15–45 ms):

> **~2–4 % de un core.** Con margen de 10× sigue por debajo del 40 % de **un**
> core.

**La CPU no es el cuello de botella del sitio institucional.** Ni cerca.

### CPU de /analisis en el peor caso

Al tope del cap global vigente (1.500 frescos/día): 1.500 × 1,3 s = **32 minutos
de CPU por día**. Irrelevante como consumo. Lo que importa de `/analisis` no es
la CPU sino **la concurrencia**: cada análisis fresco retiene una request ~1
minuto. Una ráfaga de oficina (10–30 simultáneos) son 300–900 MB de heap en
vuelo, no un problema de procesador.

### Ancho de banda — esto sí es el cuello de botella

#### Lo que hay que multiplicar es la SESIÓN, no la página

Medir páginas sueltas cuenta tres veces el lastre compartido. Medido con un
contexto de browser por sesión, navegando en orden:

| Sesión | Total | Desglose |
|---|---|---|
| Entra por la home y recorre 4 páginas | **22,90 MB** | `/` 18,12 → `/informes` 0,65 → `/equipo` 4,02 → `/contacto` 0,10 |
| Llega a un informe (link de mail) | **3,49 MB** | `/informes` 3,07 → `/analisis` 0,32 → `/contacto` 0,10 |
| Viene sólo a `/analisis` | **2,74 MB** | |
| Rebote en la home | **18,12 MB** | |

**El costo de una sesión lo fija la página de entrada.** Después de la primera,
las siguientes salen entre 0,10 y 0,65 MB — salvo `/equipo`, que suma 4,02 MB por
los 24 retratos a 150–255 KB cada uno.

Corolario operativo: **que los mails linkeen a `/informes` y no a la home cambia
el costo de la sesión por un factor de 5** (3,49 vs 22,90 MB).

#### Proyección mensual

Supuesto de mezcla: 50 % entra por la home, 50 % entra por una página profunda
(informe, análisis, contacto). A eso se le suma 20–30 % de crawlers y bots.

| Sesiones/mes | Egress del origen | Con las optimizaciones de abajo | Con CDN adelante |
|---|---|---|---|
| 2.000 (hoy: 3.000 clientes, sin SEO) | **~22 GB** | ~8 GB | **~0,6 GB** |
| 5.000 | **~54 GB** | ~20 GB | ~1,5 GB |
| 10.000 | **~108 GB** | ~40 GB | **~3 GB** |
| 30.000 (SEO andando) | **~324 GB** | ~120 GB | ~9 GB |

Con crawlers: sumar 20–30 % a la primera columna.

#### El pico, que es lo que define el uplink

| Evento | Egress | Sostenido |
|---|---|---|
| Envío de informe a 3.000 (30 % abre, 12 % clickea ≈ 110 visitas, 60 % en 2 h) — **si el mail linkea a `/informes`** | **~380 MB** | 0,4 Mbps |
| El mismo envío **si el mail linkea a la home** | **~2,0 GB** | 2,2 Mbps |
| Ráfaga peor caso: 30 personas abriendo la home a la vez | **544 MB de golpe** | satura 100 Mbps por ~43 s |

**Uplink: 100 Mbps es el piso** sirviendo desde el origen. Con CDN adelante deja
de importar.

#### Qué mirar al contratar

1. **Egress incluido en GB/mes**, y sobre todo **qué pasa al pasarse**: hay tres
   modelos y son muy distintos — te cortan, te bajan la velocidad (Hetzner y
   similares suelen throttlear), o te cobran por GB.
2. **Precio del GB adicional.** Acá está la diferencia grande: los VPS de
   Hetzner/DigitalOcean/Vultr/Linode incluyen del orden de 1–20 TB/mes y el sitio
   ni los roza; **los hyperscalers (AWS, GCP, Azure) cobran el egress por GB**
   (del orden de US$ 0,08–0,12/GB según región y volumen), donde 108 GB/mes ya son
   ~US$ 10–13/mes **sólo de tráfico**. Verificar precios vigentes al contratar.
3. **Velocidad del puerto** (100 Mbps vs 1 Gbps), que es distinto del cupo mensual.
4. **Si va a haber CDN adelante, el egress deja de ser criterio de compra** — con
   ~3 GB/mes de origen cualquier plan alcanza, y conviene gastar el presupuesto en
   RAM y CPU.

#### Las tres optimizaciones — APLICADAS 2026-08-05

Todas son de código, no de hardware. Lo que sigue está **medido después de
aplicarlas**, con el mismo instrumento que la tabla de arriba:

| Cambio | Qué se hizo |
|---|---|
| **Carpeta del navbar** | Variante propia `informes-carpeta-nav.webp` (310×422, Lanczos3 + `sharpen`): **1.193 KB → 11 KB**. /informes sigue usando la grande, que ahí sí se dibuja a 550×682. |
| **Videos de industrias** | `IntersectionObserver` con `rootMargin: 400px` en `LoopVideo`: los `<source>` recién se montan al acercarse la tarjeta. Antes bajaban 3,28 MB en la carga inicial por el `preload="auto"`. |
| **Video del hero** | Reencodeado: mp4 **12,74 → 4,36 MB** (H.264 CRF 34 slow) y webm **11,26 → 4,44 MB** (VP9 2-pass 1900k). Ver `public/video/README.md` para el porqué de los parámetros. |

Resultado medido, desktop 1440×900:

| Página | Antes | Ahora | |
|---|---|---|---|
| **`/` sin scrollear** (rebote en el fold) | 17,67 MB | **6,49 MB** | **−63 %** |
| **`/` con scroll completo** | 18,12 MB | **10,14 MB** | **−44 %** |
| `/calculadora` | 2,52 MB | **1,37 MB** | −46 % |
| `/contacto` | 2,51 MB | **1,35 MB** | −46 % |
| `/analisis` | 2,72 MB | **1,57 MB** | −42 % |
| `/equipo` | 3,36 MB | **2,21 MB** | −34 % |
| `/informes` | 2,89 MB | 2,90 MB | = |

En mobile la mejora es mayor todavía: `/calculadora` **1,69 → 0,54 MB** (−68 %),
`/analisis` 1,89 → 0,74 (−61 %), la home 17,29 → 6,10 (−65 %).

`/informes` no baja, y está bien: es la única página que **muestra** la carpeta
grande. El costo dejó de estar en todas las páginas y quedó donde se usa.

Por sesión: entrar por la home y recorrer 4 páginas pasó de **22,90 a 16,09 MB**;
rebotar en la home, de 18,12 a 10,14 MB.

Proyección mensual actualizada (mezcla: 40 % rebota en la home, 10 % entra por la
home y recorre, 50 % entra por una página profunda):

| Sesiones/mes | Antes | **Ahora** | Con CDN |
|---|---|---|---|
| 2.000 | ~22 GB | **~13 GB** | ~0,6 GB |
| 10.000 | ~112 GB | **~66 GB** | ~3 GB |
| 30.000 | ~336 GB | **~198 GB** | ~9 GB |

Dos verificaciones que vale la pena registrar:

- **El lazy-load no rompió el crossfade.** Con scroll real: 0 KB de clips antes
  de scrollear; los cuatro bajan al acercarse; y midiendo estado computado, 4
  capas reproduciendo (`paused=false`, `currentTime` avanzando) y 4 en pausa al
  final del clip — que es exactamente el diseño A/B del loop sin costura.
- **La miniatura nueva es MÁS nítida que la original**, no menos: varianza del
  laplaciano en el slot real **468,5 vs 371,2** (+26 %). El pre-escalado con
  Lanczos3 + `sharpen` le gana al downscale ×7 que hacía el browser al vuelo.
  (Medido con el mega-panel verificado abierto — `data-open="1"` y `opacity`
  computada en 1. Una primera corrida con el panel cerrado fotografió el video
  del hero por detrás y dio números sin sentido.)

#### Cuarta optimización: matar el prefetch — APLICADA 2026-08-05

Después de las tres anteriores sobraba un lastre común de **788 KB**:
`/hero/contacto.jpg` (435 KB) y `/hero/equipo-mesa.jpg` (353 KB) se seguían
bajando en todas las páginas. **No era el navbar** —ningún grupo es `kind:"doc"`,
así que ese `<img>` nunca se renderiza— ni eran imágenes sobredimensionadas: se
dibujan a 720–1280 px de ancho, o sea que la fuente de 1600 px es la correcta
para 2× de DPR.

La causa, rastreada con el `initiator` del CDP, eran `<link rel="preload"
as="image">` inyectados por script: **Next prefetchea las rutas ESTÁTICAS y React
precarga las imágenes de esos payloads.** Se pagaba el hero de páginas que el
visitante quizá nunca abría.

Y escalaba solo: los cinco heroes de `.hero-split` no aparecían sólo porque
`/nosotros`, `/historia`, `/servicios`, `/educacion` y `/prensa` están bloqueadas
y devuelven 404. Al publicarlas, el lastre pasaba de 788 KB a **~2 MB por página**.

`prefetch={false}` aplicado en todos los links a rutas propias del chrome global
y de los CTAs (`SIN_PREFETCH` en `Navbar.tsx` documenta el porqué):

| Archivo | Qué |
|---|---|
| `Navbar.tsx` | ítems del mega-panel, destacado, pill Contacto, drawer mobile y su CTA |
| `FooterInstitucional.tsx` | columnas de links y los dos CTAs grandes |
| `HeroInstitucional.tsx` | "Agendá una reunión" — está en viewport desde el primer píxel de la home |
| `informe/ArticuloInforme.tsx` | salida "Hablar con un asesor" al pie del artículo |

`Nosotros.tsx` no se tocó: ya usaba un `<a>` nativo, que no prefetchea.

Ojo con el patrón `const Tag = it.otroSitio ? "a" : Link`: `prefetch` va spreadeado
condicionalmente, porque en un `<a>` nativo quedaría como atributo DOM inválido.

#### Resultado final de las cuatro

| Página | Original | Ahora | |
|---|---|---|---|
| **`/` sin scrollear** | 17,67 MB | **5,66 MB** | **−68 %** |
| `/` con scroll completo | 18,12 MB | **9,67 MB** | −47 % |
| `/calculadora` | 2,52 MB | **0,54 MB** | **−79 %** |
| `/analisis` | 2,72 MB | **0,74 MB** | **−73 %** |
| `/contacto` | 2,51 MB | **0,96 MB** | −62 % |
| `/equipo` | 3,36 MB | **1,74 MB** | −48 % |
| `/informes` | 2,89 MB | **2,08 MB** | −28 % |

Por sesión:

| Sesión | Original | Ahora |
|---|---|---|
| Entra por la home y recorre 4 páginas | 22,90 MB | **15,91 MB** |
| Llega a un informe (link de mail) | 3,49 MB | **3,00 MB** |
| Viene sólo a `/analisis` | 2,74 MB | **0,74 MB** |
| Rebote en la home | 18,12 MB | **9,67 MB** |

Proyección mensual final (mezcla: 40 % rebota en la home, 10 % entra por la home
y recorre, 50 % entra por una página profunda):

| Sesiones/mes | Original | **Final** | Con CDN |
|---|---|---|---|
| 2.000 | ~22 GB | **~12 GB** | ~0,6 GB |
| 10.000 | ~112 GB | **~58 GB** | ~3 GB |
| 30.000 | ~336 GB | **~175 GB** | ~9 GB |

Lo que sigue mandando en el peso es lo que **de verdad se ve**: el video del hero
(4,5 MB) en la home y los 24 retratos de `/equipo` (~1,2 MB). Eso ya es contenido,
no desperdicio.

#### Lo que se evaluó y NO se hizo

Reencodear `hero/contacto.jpg` y `hero/equipo-mesa.jpg` a WebP. Medido: rinde poco
(`contacto.jpg` sólo baja 29 %, 434 → 309 KB a q82) y son fotos del cliente en su
hero — recomprimirlas por esa ganancia es una decisión de calidad que conviene que
tome él. Con el prefetch muerto ya sólo las paga quien abre esas dos páginas.

---

## Tres hallazgos que cambian el dimensionado

### 1. Sin CDN adelante, los `Cache-Control` del código no los respeta nadie

Ya está documentado en el RUNBOOK del home server y medido el 2026-07-27: los
`s-maxage` que emiten las rutas no los honra nadie detrás de `next start`, y por
eso hubo que meter `lib/memoTtl.ts` a mano. Lo mismo pasa con `/video/*` y
`/_next/static/*`: hoy **cada visita nueva baja los 13 MB del video desde el
origen**.

Poner un CDN adelante (Cloudflare free alcanza) saca ~95 % del egress del
servidor y vale más que cualquier upgrade de hardware. Es un cambio de DNS.

### 2. El cache de análisis vive en la memoria del proceso, y no tiene evicción

`lib/cache.ts` usa la Cache API de Cloudflare **si existe el global `caches`**.
En Node 22 ese global no existe, así que cae 100 % al `Map` en memoria
(`memCache`). Tres consecuencias:

- **Un restart borra todos los análisis cacheados.** Cada deploy convierte todos
  los tickers en frescos otra vez: pico de latencia y de gasto de OpenAI.
- **Un solo proceso, no dos.** `memCache`, `lib/memoTtl.ts` y parte del rate
  limiter son estado de proceso. Correr dos instancias detrás del proxy parte el
  cache al medio y **duplica el gasto de OpenAI**. Esto descarta escalar
  horizontalmente: conviene un servidor con más margen, no dos chicos.
- **La clave incluye la fecha** (`TICKER-v35-2026-08-05`) y `isFreshEntry()` sólo
  filtra al leer: **las entradas de días anteriores nunca se borran del `Map`**.
  A ~35–50 KB serializados por entrada (~100–150 KB vivos), con 100 tickers
  distintos por día son ~12 MB/día que no se liberan hasta el próximo restart.
  No es urgente —los deploys lo reinician—, pero un servidor que corra dos meses
  sin tocar acumula unos cientos de MB de heap muerto.

### 3. El build pide 1 GB y el deploy actual buildea en el servidor

La receta de deploy vigente hace `npm ci && npm run build` **en la máquina que
está sirviendo**. Con 1,04 GB de pico de build + ~340 MB de runtime + ~300 MB de
sistema, **una máquina de 2 GB queda sin margen** y un OOM durante el build deja
el sitio con un `.next` a medias.

---

## Recomendación

| | Mínimo viable | **Recomendado** | Holgado |
|---|---|---|---|
| vCPU | 2 | **4** | 4–8 |
| RAM | 2 GB | **4 GB** | 8 GB |
| Disco | 25 GB SSD | **50 GB SSD** | 100 GB SSD |
| Ancho de banda | 1 TB/mes | **1 TB/mes o sin medir** | sin medir |
| Uplink | 100 Mbps | 100 Mbps simétrico | 1 Gbps |

**Sobre el ancho de banda**: 1 TB/mes cubre ~30.000 sesiones sin optimizar nada y
con margen. La trampa no es el cupo sino **el modelo de cobro**: en un VPS que lo
incluye no lo vas a tocar nunca; en un hyperscaler que cobra por GB, 108 GB/mes
son ~US$ 10–13 mensuales de tráfico solo. Con CDN adelante el origen baja a ~3
GB/mes y el tema desaparece.

**La del medio es la que yo pondría.** Justificación de cada recurso:

- **4 GB de RAM.** No por el tráfico (340 MB alcanzan) sino por el **pico de 1 GB
  del build**, más el cache en memoria que crece entre deploys, más las ráfagas
  de análisis en vuelo. Con 4 GB se puede buildear en la misma máquina mientras
  sirve, que es lo que hace el deploy actual.
- **4 vCPU.** Sobran para servir (el pico real usa 2–4 % de un core), pero: el
  build usa un worker por core (los 13,5 s medidos fueron con 7), y el fan-out de
  un análisis fresco no debe competir con el render de las páginas.
- **50 GB.** Sistema 8–10 GB + `node_modules` 607 MB + `.next` 47 MB ×2 durante
  el deploy + `public/` 37 MB + base y PDFs creciendo ~100 MB/año + backups.
- **Ancho de banda.** 28 GB/mes hoy; con CDN adelante baja a una fracción.

### Lo que hay que hacer además del hardware

Por orden de impacto:

1. **CDN adelante (Cloudflare free).** Saca el 95 % del egress y arregla de paso
   los `s-maxage` que hoy no sirven para nada. Es lo más barato y lo que más
   rinde.
2. **Backup de `data/`.** Es el único estado irrecuperable: SQLite + los PDFs que
   sube el panel. Todo lo demás se reconstruye desde git. Copia diaria, retención
   30 días.
3. **Un solo proceso de Node**, por lo del cache compartido. Si se quiere
   redundancia, es failover activo-pasivo, no balanceo.
4. **TLS con Caddy** (`reverse_proxy localhost:3000`) y `TRUSTED_PROXY=1` para
   que los lockouts por IP del panel funcionen. Nunca exponer el puerto de Node.
5. **Node 22.**

### Dos optimizaciones que valen más que subir de plan

- **Recomprimir el video del hero.** 13,4 MB para un loop de fondo es mucho: un
  H.264 1080p bien codificado para este uso entra en 3–5 MB. Es un factor 3 sobre
  el 94 % del egress del sitio — más impacto que cualquier upgrade.
- **Poner un tope al `Map` del cache** (LRU o barrido de claves de días viejos).
  Convierte el crecimiento indefinido de heap en un techo conocido.

### Lo que no es un problema de servidor

El gasto recurrente real de `/analisis` **no es infraestructura, es OpenAI**: con
los caps vigentes (100/h por IP, 50 frescos/día por IP, 1.500/día global) la
exposición de peor caso son **~US$ 90/día**. Ese dial se mueve en
`RATE_LIMIT_GLOBAL_DAILY_MAX`, no comprando más servidor.
