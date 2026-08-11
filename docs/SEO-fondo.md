# SEO de bengocheainversiones.com — estudio, auditoría y plan

> Fecha: 2026‑08‑06. Sitio auditado: `https://bengocheainversiones.com` (BNG Selección
> Global), publicado y sirviendo desde hosting cPanel/Apache.
> Complementa `docs/SEO-plan.md`, que es del sitio institucional y es **anterior** a
> que el fondo pasara a ser sitio propio con dominio propio. Donde los dos hablen de
> lo mismo, manda éste para el dominio del fondo.

## Estado de implementación (2026‑08‑06)

Hecho, verificado sobre el artefacto de `npm run fondo:build` — **sin tocar una sola
palabra del contenido de la página**, que fue la restricción pedida:

| Hallazgo | Estado | Dónde |
|---|---|---|
| C1 · Cero datos estructurados | ✅ **Resuelto** | `lib/jsonld.ts` (3 builders nuevos) + `page.tsx` |
| C2 · Sin imagen OG | ✅ **Resuelto** | `opengraph-image.tsx` (nuevo) + `copiarOg()` en el build |
| ↳ la card usa la fachada REAL del hero | ✅ | geometría extraída a `lib/fachada.ts` (ver nota abajo) |
| I4 · Sin Brotli | ✅ **Resuelto** | `.htaccess` generado (con fallback a gzip) |
| I6 · Redirect 307 | ✅ **Resuelto** | 301 en Apache, 308 en el formato Cloudflare |
| I3 · Fuentes de más | ✅ Ya estaba en el working tree | `app/layout.tsx` (sin commitear) |
| **B1 · noindex** | ⛔ **Pendiente — necesita decisión** | `SEO_INDEXABLE=1` + rebuild |
| C3 · El institucional no enlaza al fondo | ⛔ Fuera de este repo | sitio PHP legacy |
| I1 · H1 sin el nombre del producto | ⛔ Vetado (es contenido) | — |
| I7 · Superficie de una página | ⛔ Vetado (es contenido) | — |

**Bug encontrado al implementar C2, que no estaba en la auditoría:** la `og:image` que
generaba Next resolvía contra `metadataBase`, o sea al dominio **institucional** —
salía `https://gbengochea.com.uy/bng-seleccion-global/opengraph-image-1wynds?…`, donde
el archivo no existe. Es el mismo footgun que `fondoMetadata()` ya resolvía para el
canonical, y sin arreglarlo la card habría seguido rota en un dominio distinto. Ahora
la URL se arma absoluta al origen del fondo y el build corta si el PNG no aparece.

**La card OG usa la fachada real, no una imitación.** `components/institucional/Fachada.tsx`
es `"use client"`, así que desde el server sus exports son referencias de cliente y no
se pueden leer las teselas. La parte pura —malla, ruido, rampa tonal, horizonte— se
extrajo a **`lib/fachada.ts`**, del que ahora comen el hero y la card: si se retoca la
fachada, la tarjeta se retoca sola. El componente reexporta lo público, así que ningún
consumidor cambió. Verificado con diff de píxeles del hero antes/después del refactor:
delta máximo **2/255**, promedio 1,0 — ruido de antialiasing entre corridas, no
geometría (un panel corrido 1px daría deltas de 20‑50 en los bordes).

La card **no reproduce el hero**: a los ~320 px del preview de WhatsApp el titular de
cuatro renglones en serif cae a ~12 px y es ruido. Quedó un solo elemento dominante
—el wordmark a 112 px, cruzado por el horizonte— más el logo y el ledger. El wordmark
va centrado en x = 800 y no en el medio: el horizonte sólo es recto entre x ≈ 550 y
1050, y fuera de ahí la línea lo cruzaría en diagonal.

**Verificación de no‑regresión:** el artefacto nuevo y el sitio vivo renderizan las
mismas 12 secciones con el mismo H1; midiendo sección por sección, las diez que no
dependen de datos vivos tienen **alto idéntico al píxel**, y las dos que difieren
(`cartera`, `performance`) lo hacen sólo porque el server estático local no sirve
`/api/fondo`. El `<script type="application/ld+json">` queda con `display:none` y
alto 0.

---

## 0. Lo primero, antes de cualquier otra cosa

**La página publicada está bloqueada para todos los buscadores.** Verificado en vivo:

```
$ curl https://bengocheainversiones.com/robots.txt
User-agent: *
Disallow: /

$ curl https://bengocheainversiones.com/ | grep robots
<meta name="robots" content="noindex, nofollow"/>
```

Son las dos capas del kill‑switch `SEO_INDEXABLE` (`lib/seo.ts`), que por diseño
arranca apagado para que el WIP no se indexe antes de tiempo. El build que está
arriba se hizo sin `SEO_INDEXABLE=1`, así que salió con el candado puesto.

Mientras eso siga así, **todo lo demás de este documento es teoría**: no hay ranking
posible para una URL que Google tiene prohibido rastrear y que además le pide
explícitamente que no la indexe.

---

## 1. Expectativa realista (leer antes del plan)

El pedido fue "que en cualquier búsqueda aparezca arriba del todo". Eso no es
alcanzable y conviene decirlo derecho, porque cambia dónde poner el esfuerzo:

- **Sí es alcanzable, y rápido:** ser el resultado #1 para las búsquedas de marca —
  `bengochea inversiones`, `bng selección global`, `bengochea corredor de bolsa`. Hoy
  hay demanda real de esas consultas (§6) y el dominio coincide con lo que la gente
  tipea. Con el sitio indexable, esto se gana en semanas.
- **Es alcanzable con trabajo de contenido sostenido:** competir por las consultas de
  categoría — `fondos de inversión Uruguay`, `dónde invertir en Uruguay`, `invertir en
  dólares Uruguay`. Ahí compiten Itaú, SURA, BROU, Santander y BBVA (bancos con
  décadas de dominio) más sitios de contenido/afiliados. Un sitio de **una sola
  página** no gana eso, por bien optimizado que esté: no hay superficie donde rankear.
- **No es alcanzable, y no debería intentarse:** aparecer arriba en búsquedas ajenas
  al rubro. Y en contenido financiero (YMYL) forzarlo es contraproducente — Google
  aplica ahí su estándar de calidad más estricto.

Traducido a estrategia: **ganar la marca ya, y construir superficie para la categoría
después.** El techo estructural de hoy no es técnico, es que el sitio tiene una página.

---

# PARTE I — El estudio

Todo lo de esta parte sale de **fuentes primarias** (documentación oficial de Google,
web.dev, schema.org), no de blogs de agencia. Lo aclaro porque en SEO 2026 el ruido
comercial es enorme y buena parte contradice lo que Google dice por escrito.

## 2. Qué mueve la aguja en 2026

### 2.1 Los fundamentos, según Google mismo

Google Search Essentials divide todo en tres: requisitos técnicos, políticas de spam y
buenas prácticas. Y es explícito en que **los requisitos técnicos son mínimos** — "hay
muy pocas cosas técnicas que necesitás hacerle a una página web; la mayoría de los
sitios pasan los requisitos técnicos sin darse cuenta". El peso está en el contenido y
en las señales de confianza, no en trucos de configuración.

Las seis prácticas que Google lista como de mayor impacto: contenido útil y
people‑first · términos de búsqueda en lugares prominentes (título, encabezados, alt,
texto de enlace) · enlaces rastreables · promoción activa · formatos correctos
(imágenes, video, datos estructurados, JS) · control de la apariencia en resultados.

### 2.2 E‑E‑A‑T y YMYL — acá está la palanca

Experiencia, Pericia, Autoridad y Confianza. La frase textual de Google que ordena
todo el resto: **"De estos aspectos, la confianza es el más importante."**

Un fondo de inversión es **YMYL** ("Your Money or Your Life") en su forma más pura:
plata de terceros. Google aplica ahí su vara más alta, y los evaluadores de calidad
tienen instrucción explícita de que **una página con baja confianza no puede ser de
alta calidad**, por experto que sea el autor.

Esto es una **ventaja competitiva**, no un obstáculo: la casa tiene lo que un sitio
de contenido genérico no puede fabricar — 1967 como fecha de fundación, registro ante
el BCU, membresía en la Bolsa de Valores de Montevideo, oficina física, equipo con
nombre y apellido, y código LEI. El problema es que **nada de eso está expresado en
forma legible por máquina en el dominio del fondo** (§4.2).

El marco "Quién / Cómo / Por qué" de Google se lee directo como checklist:
- **Quién** — autoría e identidad visibles, con respaldo verificable.
- **Cómo** — transparencia sobre cómo se produce el contenido (y divulgación si hay IA).
- **Por qué** — el contenido existe para ayudar a la persona, no para captar rankings.

### 2.3 Core Web Vitals — umbrales vigentes

Medidos en **campo** (usuarios reales, CrUX), al **percentil 75**, segmentado mobile/desktop:

| Métrica | Bueno | Qué mide |
|---|---|---|
| **LCP** | < 2,5 s | Cuándo aparece el elemento principal |
| **INP** | < 200 ms | Respuesta a la interacción (reemplazó a FID) |
| **CLS** | < 0,1 | Estabilidad visual |

Sin cambios previstos al set de métricas. Nota para este proyecto: **INP es el talón
de Aquiles** de una app React con Framer Motion + Lenis, y es el que más se falla en
2026. Pero hoy el sitio no tiene datos de campo porque no tiene tráfico — CWV se vuelve
accionable recién después de indexar.

### 2.4 Buscadores de IA (AI Overviews, ChatGPT, Perplexity) — el anti‑hype

Acá es donde la industria vende humo. La posición **oficial y textual** de Google:

> "No hay requisitos adicionales para aparecer en AI Overviews o AI Mode, ni otras
> optimizaciones especiales necesarias."

> "No necesitás crear archivos legibles por máquina nuevos, archivos de texto para IA,
> ni marcado para aparecer en estas funciones. Tampoco hay datos estructurados
> schema.org especiales que necesites agregar."

Eso mata dos cosas que se venden caras: **`llms.txt` no sirve para Google**, y no
existe un "schema de GEO". El único requisito real es que la página **esté indexada y
sea elegible para mostrarse con snippet**. O sea: el prerrequisito de aparecer en IA es
exactamente el que hoy está roto (§0).

Lo que sí es real y aditivo, sin costo extra si el SEO está bien hecho:
- **Responder arriba.** Los sistemas de recuperación en tiempo real evalúan la
  relevancia por el contenido de apertura. La respuesta va en las primeras líneas, no
  al final de un recorrido narrativo.
- **Contenido en texto.** Lo que está sólo en un canvas, un SVG o una animación no
  existe para el extractor.
- **Datos estructurados que coincidan con lo visible** — Google lo pide explícitamente.
- **Citas de terceros creíbles** — es lo que hace elegible a una fuente.
- **Permitir los crawlers de IA** (GPTBot, ClaudeBot, PerplexityBot, Google‑Extended).
  Ya está decidido que sí (`docs/SEO-plan.md` D4) y el `*` los cubre.

### 2.5 Datos estructurados — qué sigue dando resultado

De la galería oficial: siguen vigentes **Organization, Article, Breadcrumb, Video,
Profile page, Q&A, Local business, Product, Dataset, Event, Review snippet**, entre otros.
**FAQ y HowTo ya no figuran** — quedaron fuera de los rich results.

Dos piezas importan especialmente acá:

- **`Organization`** — sin propiedades obligatorias; se agregan las que apliquen. Las
  relevantes para una financiera regulada: `legalName`, `foundingDate`, `address`,
  `telephone`, `email`, `logo` (≥112×112, rastreable), `sameAs`, `areaServed`, y sobre
  todo **`leiCode`** (Legal Entity Identifier), `vatID`/`taxID`, `iso6523Code` — Google
  las soporta explícitamente y son señales de identidad verificable difíciles de falsear.
- **`WebSite`** — es lo que **controla el nombre del sitio en el SERP**. Tiene que estar
  en la home del dominio, funciona a nivel dominio/subdominio (no de subcarpeta), y
  Google la prioriza por encima de `og:site_name`, el `<title>` y los encabezados.

Para el producto existe **`InvestmentFund`** (schema.org): `Thing → Intangible →
Service → FinancialProduct → InvestmentOrDeposit → InvestmentFund`. No da rich result,
pero describe la entidad para grafos de conocimiento y motores de IA. Ojo con el marco
legal: `interestRate` / `annualPercentageRate` **no se usan** — poner rendimientos como
claim estructurado es exactamente lo que la revisión legal evitó en el copy visible.

### 2.6 Título, encabezados y nombre del sitio

Google arma el "title link" automáticamente y toma de: el `<title>`, el título visual
principal, los **encabezados (H1)**, `og:title`, texto prominente, el cuerpo, el
**anchor text de quienes enlazan**, y los datos estructurados `WebSite`.

Consecuencia práctica: el H1 no es decoración. Si el H1 no nombra el producto, se está
tirando la señal más fuerte de la página.

### 2.7 hreflang

**No hace falta.** Es para contenido multilingüe o multirregional. Sitio monolingüe
es‑UY apuntando a un país = no se usa. `<html lang="es-UY">` ya está bien puesto.

### 2.8 Enlaces y autoridad

Lo que funciona en 2026 es **PR digital y menciones de marca**, no construcción de
enlaces a volumen. Las políticas de spam de Google desmantelaron directorios masivos,
redes de blogs privadas y guest posting industrial; la relación riesgo/beneficio de
comprar enlaces es francamente mala.

Y hay un matiz que importa para IA: **las menciones de marca sin enlace también suman**.
Alimentan la co‑ocurrencia de entidades que los sistemas de IA usan para decidir a quién
citar. Una nota en prensa financiera uruguaya que nombre el fondo vale aunque no linkee.

### 2.9 Local

El Local Pack (Google Maps) se lleva entre 30% y 50% de los clics en búsquedas locales
y se alimenta **exclusivamente** de Google Business Profile, que exige dirección física
verificable. La casa tiene oficina en el WTC — es un activo desaprovechado si el perfil
no está optimizado.

---

# PARTE II — Auditoría del sitio publicado

## 3. Lo que está bien (no tocar)

Mérito del trabajo ya hecho, verificado en vivo:

- **Jerarquía de encabezados impecable** — un solo H1, H2/H3 anidados con lógica.
- **Redirects correctos** — `http→https` 301, `www→apex` 301, y el path físico
  `/bng-seleccion-global` → `/` (o sea, una sola URL por página, sin duplicado).
- **Canonical absoluto** al apex, coherente con el redirect.
- **`<html lang="es-UY">`**, `theme-color`, favicons completos, manifest.
- **Cabeceras de seguridad completas** — CSP, HSTS con preload, X‑Content‑Type‑Options,
  Referrer‑Policy, Permissions‑Policy. Contribuye a la señal de confianza.
- **Cache correcto** — `immutable` para `/_next/static/*`, `must-revalidate` para HTML.
- **Sitemap válido** con la URL única del sitio.
- **2.230 palabras de texto real** en la página. No es una landing hueca.
- **Título brand‑first** bien armado: `BNG Selección Global · Gastón Bengochea & Cía.`

## 4. Hallazgos, por impacto

### 🔴 B1 — Bloqueante: el sitio es no indexable

`robots.txt` con `Disallow: /` **y** `<meta name="robots" content="noindex, nofollow">`.
Causa: el build se corrió sin `SEO_INDEXABLE=1`. Es un flag de **build**, no de runtime:
exige rebuild + redeploy, no alcanza con reiniciar.

### 🔴 C1 — Cero datos estructurados en el dominio del fondo

Verificado: `0` ocurrencias de `ld+json` en el HTML servido. No hay `Organization`, no
hay `WebSite`, no hay nada.

Es el hallazgo de mayor relación impacto/esfuerzo del documento. El repo **ya tiene**
`lib/jsonld.ts` con `organizationLd()` y `websiteLd()` construidos con datos verificados
del cliente (dirección WTC Torre I Of. 707, teléfono, geo, fundación 1967, membresía
BVM, Instagram) — pero están cableados a `SITE_URL` (el dominio institucional) y el
route group `app/(fondo)` no los usa. La página del fondo se publicó sin ninguno.

Para un producto financiero YMYL en un dominio sin historial, esto es dejar afuera
justo las señales que Google usa para decidir si la fuente es confiable.

### 🔴 C2 — Sin imagen Open Graph

No hay `og:image` en el `<head>`, y los cuatro destinos posibles dan 404:
`/opengraph-image`, `/opengraph-image.png`, `/og-default.png`, `/twitter-image`.
`scripts/build-fondo.mts` no la emite ni la copia.

Efecto concreto: **compartir el link por WhatsApp, LinkedIn o Slack no muestra imagen**.
En Uruguay, WhatsApp es el canal de distribución real de este tipo de material — el
asesor le manda el link al cliente. Hoy llega como una tira de texto gris.

### 🔴 C3 — El dominio con autoridad no enlaza al fondo

`gbengochea.com.uy` está indexado, tiene historia, aparece en LinkedIn, en el registro
del BCU y en bases de datos de entidades legales. **No menciona el fondo en ninguna
parte** (verificado sobre el HTML servido: sirve todavía el sitio viejo).

`bengocheainversiones.com` se registró en julio de 2024 y se publicó ahora, sin enlaces
entrantes. Un enlace desde la home del dominio institucional al fondo es la
transferencia de autoridad más barata, más rápida y más legítima disponible — y hoy no
existe. Es más importante que cualquier ajuste técnico de la lista.

Bonus del mismo diagnóstico: el `robots.txt` de `gbengochea.com.uy` declara
`Sitemap: https://domain.com/sitemap.xml` — un placeholder que quedó sin reemplazar.

### 🟠 I1 — El H1 no nombra el producto

H1 actual: *"Una estrategia balanceada y gestionada profesionalmente, con
diversificación global."*

Es buen copy editorial y **no propongo romperlo**, pero Google usa el H1 como fuente
primaria para el title link y para entender de qué trata la página, y ese H1 no contiene
ni "BNG Selección Global" ni "fondo". La marca aparece en el `<title>` y en H2 más
abajo, lo cual mitiga pero no reemplaza. Hay una redacción que conserva el registro
editorial y nombra el producto — es una decisión de copy, no técnica (§7, D2).

### 🟠 I2 — Colisión de entidad de marca

El autocompletado de Google para `bengochea` devuelve, en orden: `bengochea`,
**`bengochea peñarol`**, `bengochea inversiones`, **`bengochea pablo`**, `bengochea 5`,
`bengochea gaston`, `bengochea y asociados`, `bengochea corredor de bolsa`.

La marca compite en el grafo de entidades con un personaje del fútbol uruguayo mucho
más famoso. Esto se resuelve con desambiguación explícita: `sameAs` a los perfiles
oficiales (LinkedIn de la empresa, X `@bengochea_sb`, Instagram), `leiCode`, `legalName`
completo y la ficha del BCU. Sin eso, Google tiene que adivinar.

### 🟠 I3 — El deploy vivo está atrasado respecto al código

El HTML servido precarga **6 archivos de fuente**. El `app/layout.tsx` del working tree
ya tiene la corrección que deja **una sola** (`preload: false` en la itálica, Plex Sans
y Plex Mono) — documentada en `docs/rendimiento-fondo.md` §2, con la medición de que el
renderer usaba una y bajaba 135 KB al pedo con prioridad `High`, compitiendo con el CSS
que bloquea el render.

Ese cambio está sin commitear y sin deployar. Es una mejora de LCP ya hecha y pagada que
no está llegando a los usuarios.

### 🟠 I4 — Sin Brotli

Apache comprime con `mod_deflate` (gzip). Pedir `Accept-Encoding: br` no devuelve
`Content-Encoding: br`. Brotli sobre este payload de texto típicamente ahorra 15‑20%.

Medición del primer viaje, en el cable: **HTML 67 KB + assets 512 KB = 579 KB**
(14 JS, 3 CSS, 6 fuentes). No es alarmante para una página de 13.000 px, pero las
fuentes de I3 y Brotli son dos recortes gratis sobre el mismo número.

### 🟡 I5 — Sin Search Console ni analítica en este dominio

No hay verificación (`GOOGLE_SITE_VERIFICATION` no está seteado) ni medición. Sin Search
Console no hay forma de ver qué indexó Google, qué consultas traen impresiones, ni los
Core Web Vitals de campo. Es el instrumental básico y hay que tenerlo **antes** de
indexar, para poder ver el efecto.

### 🟡 I6 — El redirect del path es 307, no 301

`/bng-seleccion-global` → `/` responde **307** (temporal). Google consolida igual, pero
para unificación permanente de URLs el 301 es la señal correcta. Cambio de una línea en
el `.htaccess` que genera `scripts/build-fondo.mts`.

### 🟡 I7 — Una sola página es el techo estructural

2.230 palabras en una URL. Alcanza y sobra para las consultas de marca. Para las de
categoría no hay dónde rankear: cada intención de búsqueda necesita su página. Esto no
se arregla con configuración — es trabajo editorial (§5, Fase 4).

---

# PARTE III — El plan

## 5. Por fases, en orden de ejecución

### Fase 0 — Desbloquear (sin esto nada existe)

| # | Acción | Dónde |
|---|---|---|
| 0.1 | `SEO_INDEXABLE=1` en el entorno de build del fondo | `.env` / CI |
| 0.2 | Rebuild + redeploy a cPanel (arrastra I3 de regalo) | `scripts/build-fondo.mts` |
| 0.3 | Verificar en vivo: `robots.txt` con `Allow`, sin `noindex` en el HTML | `curl` |
| 0.4 | Alta en Google Search Console (verificación por **DNS TXT**) + enviar sitemap | GSC |
| 0.5 | Alta en Bing Webmaster Tools (importa desde GSC en 2 minutos) | BWT |

**Gate legal antes de 0.2:** confirmar que los disclaimers de no‑oferta y
no‑asesoramiento‑personalizado están en la página. Ya se hicieron dos pasadas legales
(commits `861ef74` y `c56c823`), así que probablemente sea sólo verificar — pero abrir a
indexación es publicar de verdad, y `docs/SEO-plan.md` lo dejó como condición explícita.

### Fase 1 — Identidad legible por máquina (mayor impacto/esfuerzo)

| # | Acción | Detalle |
|---|---|---|
| 1.1 | `Organization` JSON‑LD en el dominio del fondo | Adaptar `lib/jsonld.ts` para que reciba origen; sumar `leiCode`, `legalName`, LinkedIn y X a `sameAs` |
| 1.2 | `WebSite` JSON‑LD | Controla el nombre del sitio en el SERP. Va en la home del dominio |
| 1.3 | `InvestmentFund` para el producto | `provider` → `@id` de la Organization. **Sin** `interestRate`/`annualPercentageRate` |
| 1.4 | Imagen OG 1200×630 | Emitirla en `build-fondo.mts` y cablearla en `fondoMetadata()` |
| 1.5 | Enlace desde `gbengochea.com.uy` al fondo | Anchor text descriptivo, no "click acá" |
| 1.6 | Arreglar el `robots.txt` de `gbengochea.com.uy` | Hoy apunta a `https://domain.com/sitemap.xml` |

El JSON‑LD del fondo, concretamente (todo dato verificable; lo que esté marcado va a
confirmación del cliente):

```jsonc
{
  "@context": "https://schema.org",
  "@type": "InvestmentFund",
  "name": "BNG Selección Global",
  "url": "https://bengocheainversiones.com/",
  "description": "…el mismo texto que la description visible…",
  "inLanguage": "es-UY",
  "areaServed": "UY",
  "provider": { "@id": "https://bengocheainversiones.com/#organization" },
  "feesAndCommissionsSpecification": "Hasta 1,5% anual IVA incluido sobre el patrimonio del fondo."
}
```

> **Regla que no se rompe:** los datos estructurados tienen que coincidir con lo visible
> en la página (Google lo exige). Y nada de rendimientos como claim — es la misma línea
> que trazó la revisión legal en el copy.

### Fase 2 — Rendimiento y detalles técnicos

| # | Acción | Ganancia |
|---|---|---|
| 2.1 | Habilitar Brotli en Apache (`mod_brotli`) | ~15‑20% sobre 579 KB |
| 2.2 | 307 → **301** en el redirect del path | Señal de consolidación correcta |
| 2.3 | Medir CWV de campo en Search Console | Recién tiene sentido con tráfico |
| 2.4 | Auditar **INP** con la interacción real | El CWV que más riesgo tiene acá |

Nota metodológica para 2.4: medir reproduciendo la interacción real y leyendo estado
computado, no inyectando overrides que toquen la propiedad bajo prueba.

### Fase 3 — Marca y autoridad

| # | Acción |
|---|---|
| 3.1 | Google Business Profile de la oficina del WTC, completo y verificado |
| 3.2 | Desambiguación de entidad: `sameAs` a LinkedIn de la empresa, X `@bengochea_sb`, Instagram |
| 3.3 | Coherencia NAP (nombre‑dirección‑teléfono) idéntica en sitio, GBP y directorios |
| 3.4 | PR digital: prensa financiera uruguaya. Las menciones sin enlace también cuentan |

### Fase 4 — Superficie de contenido (el techo real)

Acá se juega si el sitio compite por categoría o se queda en la marca. Cada intención
necesita su URL. Candidatas, derivadas del keyword research real de §6:

- "Qué es un fondo de inversión y cómo funciona" (informativa, tope del embudo)
- "Cómo invertir en dólares desde Uruguay"
- "Fondo de inversión vs. plazo fijo vs. comprar ETFs por tu cuenta" (comparativa —
  las consultas de comparación son las que más se citan en respuestas de IA)
- "Cómo se tributa un fondo de inversión en Uruguay"
- Glosario de términos (captura long tail y sirve de destino de enlaces internos)

Con **autoría real firmada** (el equipo existe y tiene credenciales) esto es E‑E‑A‑T de
primera mano, que es exactamente lo que Google premia en YMYL y lo que un sitio de
afiliados no puede replicar.

Decisión abierta: si estas páginas viven en el dominio del fondo o en el institucional.
Argumento a favor del institucional: consolida autoridad en el dominio que ya la tiene,
y el fondo es un producto, no un medio. Ver §7 D3.

---

## 6. Keyword research — datos reales

Obtenidos del autocompletado de Google con geolocalización Uruguay (`gl=uy`, `hl=es`).
Son consultas que la gente **efectivamente escribe**, no estimaciones.

**Marca — demanda existente, ganable ya:**

```
bengochea              → bengochea peñarol · bengochea inversiones · bengochea pablo
                         bengochea gaston · bengochea y asociados · bengochea corredor de bolsa
```

`bengochea inversiones` es el tercer autocompletado. **El dominio coincide con lo que la
gente tipea** — es un activo real y desaprovechado mientras el sitio esté en noindex.

**Categoría — competitiva, requiere contenido:**

```
fondo de inversion     → itau · uruguay · sura · brou · prex · santander · gletir · bbva
fondos de inversion uruguay → fondos comunes de inversion uruguay · itau · sura · santander · bbva
corredor de bolsa uruguay   → puente · gletir · fenix · sura · perez marexiano · balanz
invertir en uruguay    → con poco dinero · 2026 · desde argentina · desde chile · donde invertir
```

Lecturas accionables:

1. **La competencia de categoría son bancos** (Itaú, BROU, Santander, BBVA, SURA), no
   corredores. Pelear de frente por `fondo de inversión uruguay` es caro.
2. **`corredor de bolsa uruguay` es el nicho realista** — ahí compiten pares (Puente,
   Gletir, Fénix, Balanz, Perez Marexiano), no bancos. Y esa consulta le corresponde al
   sitio **institucional**, no al del fondo.
3. **`invertir en uruguay desde argentina` / `desde chile`** es demanda regional
   entrante, coherente con un fondo domiciliado en Uruguay. Nicho poco disputado.
4. **`con poco dinero`** revela intención de entrada baja — hay que ver si encaja con el
   mínimo de suscripción real del fondo antes de perseguirla.

---

## 7. Decisiones que necesito

Estas no las puedo tomar yo porque son de negocio, no técnicas.

**D1 — ¿Se abre a indexación ahora?**
Es el interruptor. Requiere confirmar el gate legal (disclaimers en página) y aceptar
que el fondo pasa a ser públicamente buscable. Todo lo demás depende de esto.

**D2 — ¿Se toca el H1?**
Hay tensión real entre el copy editorial aprobado por el cliente y la señal SEO. Mi
recomendación es una redacción que nombre el producto **sin** perder el registro, pero
el copy pasó pasada del cliente y no lo cambio por mi cuenta.

**D3 — ¿Dónde vive el contenido de la Fase 4?**
Dominio del fondo (refuerza el producto, pero construye autoridad desde cero) o
institucional (aprovecha la autoridad existente, pero el fondo queda como producto sin
contenido propio). Mi recomendación: **institucional**, con enlaces al fondo.

**D4 — ¿Se avanza con Google Business Profile?**
Requiere acceso/verificación por parte del cliente sobre la oficina física.

---

## 8. Fuentes

Documentación oficial consultada para este estudio:

- [Google Search Essentials](https://developers.google.com/search/docs/essentials)
- [Creating helpful, reliable, people-first content](https://developers.google.com/search/docs/fundamentals/creating-helpful-content)
- [Google Search features and your website (AI features)](https://developers.google.com/search/docs/appearance/ai-features)
- [Core Web Vitals — web.dev](https://web.dev/articles/vitals)
- [Structured data markup that Google Search supports](https://developers.google.com/search/docs/appearance/structured-data/search-gallery)
- [Organization structured data](https://developers.google.com/search/docs/appearance/structured-data/organization)
- [Site names in Google Search](https://developers.google.com/search/docs/appearance/site-names)
- [Control your title links](https://developers.google.com/search/docs/appearance/title-link)
- [Localized versions of your page (hreflang)](https://developers.google.com/search/docs/specialty/international/localized-versions)
- [schema.org/InvestmentFund](https://schema.org/InvestmentFund)
- [A guide to Google Search ranking systems](https://developers.google.com/search/docs/appearance/ranking-systems-guide)

Referencia de la vara de calidad YMYL: [Search Quality Rater Guidelines
(overview)](https://services.google.com/fh/files/misc/hsw-sqrg.pdf) ·
[YMYL explicado](https://searchengineland.com/guide/ymyl).
