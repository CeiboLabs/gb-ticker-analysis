# Runbook — el sitio del fondo en Cloudflare

Cómo se publica **BNG Selección Global** (`app/(fondo)`) en Cloudflare, en una
**cuenta separada** de la que hostea `main` (proyecto histórico
`gb-ticker-analysis`, cuenta Ceibo Labs).

La ingesta de datos del fondo —NAV por mail, backfill, benchmark— es otro
documento: `RUNBOOK-fondo.md`. Acá va sólo el hosting.

---

## Qué se deploya, y por qué así

**No es un deploy de Next.** El sitio del fondo son **assets estáticos + un
worker chico**, y la decisión tiene fundamento:

- **La página no renderiza ni un dato en el server.** Valor cuota, tenencias y
  documentos los pide el cliente por `/api/fondo*` (`lib/useFondo.ts`,
  `FondoDocumentos`). Lo único que la hacía dinámica era leer el `Host` para
  decidir si los links a la casa son absolutos o relativos — y en su propio
  dominio esa respuesta es constante. Eso es lo que resuelve el flag
  `FONDO_STANDALONE` (`lib/sitios.ts` → `lib/sitiosServer.ts`).
- **Servido como asset, Cloudflare no invoca código**: *"if a requested URL
  matches a file in the static assets directory, that file will be served —
  without invoking Worker code"*, y esos requests **no se facturan**. Correr Next
  adentro de un worker (OpenNext) haría pasar todo el HTML por el adaptador, con
  su impuesto en cada request y su fragilidad entre versiones de Next.
- **El worker queda para los tres endpoints de datos**, que es justo para lo que
  sirve un worker. La lógica es la MISMA que sirve la app en el dev y en el home
  server: vive compartida en `lib/fondoApi.ts` para que no puedan divergir.

```
dist/fondo/          ← assets: index.html, _next/static, favicon, robots, sitemap,
                       404.html, _headers, _redirects        (los sirve el borde)
workers/fondo-site/  ← worker: /api/fondo, /api/fondo/documentos[/tipo]
```

---

## Lo que tiene que hacer una persona (no lo puede hacer el repo)

1. **Crear la cuenta de Cloudflare del fondo** y ponerle plan **Workers Paid**
   (US$5/mes). El plan Free no sirve para R2 y deja el margen de CPU al límite.
2. **Habilitar R2** en esa cuenta (una vez, desde el dashboard: pide método de
   pago aunque el tramo gratis alcance).
3. **Definir el dominio.** Ver la sección Dominio más abajo: no es indistinto.
4. **Emitir un API token** para deployar desde acá (sección siguiente).

---

## Autenticarse SIN pisar la sesión de la otra cuenta

`wrangler login` guarda **un solo** token OAuth en
`~/Library/Preferences/.wrangler/`: loguearse con la cuenta del fondo reemplaza
el de la cuenta de `main`. Para no pisarla, se usa un **API token por variable de
entorno**, que tiene precedencia y no toca nada guardado:

```bash
# Dashboard de la cuenta del fondo → My Profile → API Tokens → Create Token.
# Permisos: Workers Scripts:Edit · Workers R2 Storage:Edit · D1:Edit
#           (+ Zone:DNS:Edit si el dominio va en esa cuenta)
export CLOUDFLARE_API_TOKEN='…'
export CLOUDFLARE_ACCOUNT_ID='…'   # obligatorio si el token ve más de una cuenta

npx wrangler whoami                 # confirmar que dice la cuenta del fondo
```

Guardalos fuera del repo (llavero, o un `.env` que no se commitea).

---

## Estado actual (2026-07-31)

**Ya está deployado y andando.**

| | |
|---|---|
| Cuenta | `Emirod1955@gmail.com's Account` — `d991d6dfeee96a8b4fd2152385beb594` |
| Worker | `bng-fondo-site` |
| URL | https://bng-fondo-site.emirod1955.workers.dev |
| D1 | `bng-fondo` — `701fbb09-6348-47ab-ab82-a3d8aa65bbbc` (región ENAM) |
| Credenciales | `~/.config/bng-fondo-cf.env` (chmod 600) |
| R2 | **sin crear** — el binding está comentado hasta que haya documentos |

Verificado en producción: página 200 con `cf-cache-status: HIT` y TTFB ~45 ms, la
tanda completa de cabeceras de seguridad, chunks como `text/javascript` con
`immutable`, `/api/fondo` sirviendo el benchmark desde la D1 remota, el redirect
307 del path viejo, el 404 propio, y la página hidratando (los selectores de
período y de vista responden). `robots.txt` bloquea todo porque `SEO_INDEXABLE`
sigue apagado — correcto en pre-lanzamiento.

## Puesta a punto de la cuenta (ya hecha; queda como referencia)

```bash
# 1. La base del fondo
npx wrangler d1 create bng-fondo
#    → pegar el database_id que devuelve en workers/fondo-site/wrangler.jsonc

# 2. Esquema y seeds
npx wrangler d1 execute bng-fondo --remote --file=db/schema.sql
npx wrangler d1 execute bng-fondo --remote --file=db/seeds/fondo-benchmark.sql
npx wrangler d1 execute bng-fondo --remote --file=db/seeds/fondo-holdings.sql

# 3. El bucket de los PDFs — SÓLO cuando haya documentos que publicar;
#    además hay que descomentar el binding en wrangler.jsonc.
npx wrangler r2 bucket create bng-fondo-docs
```

`db/schema.sql` crea todas las tablas del proyecto; esta base **usa sólo** las
del fondo (`fund_nav`, `fund_benchmark`, `fund_holdings_*`, `fund_audit`,
`fund_ingest_seen`) más `site_flags` y `fondo_documentos`. Se aplica entero
porque es el archivo canónico y siempre está al día — las tablas de más quedan
vacías y no cuestan nada.

> **Ojo con `--file --remote`:** usa el API de *import* y falla con
> `Authentication error [code: 10000]` si el token está viejo o le faltan
> scopes. Alternativa: `--command="$(cat archivo.sql)"` (con el `=` PEGADO).

---

## Ciclo de trabajo

```bash
npm run fondo:build     # copia el repo, buildea y arma dist/fondo
npm run fondo:dev       # + wrangler dev en :8787 con D1 local (miniflare)
npm run fondo:deploy    # + wrangler deploy
```

Para la D1 **local** de las pruebas, los mismos tres comandos de arriba con
`--local --config workers/fondo-site/wrangler.jsonc` en vez de `--remote`.

**El build corre en una COPIA del repo** (`$TMPDIR/bng-fondo-build`, o
`FONDO_BUILD_DIR`). No es capricho: `next build` escribe en `.next/`, que es
donde el `next dev` del desarrollador tiene su estado — buildear en el working
tree le voltea el dev server. `node_modules` se clona con copy-on-write, así que
la copia es instantánea y no ocupa disco.

Si sólo tocaste el armado y no el código: `npm run fondo:build -- --rearmar`
reusa el último build.

### Flags de build (se hornean en el HTML — exigen rebuild, no alcanza redeploy)

| Variable | Qué hace |
|---|---|
| `NEXT_PUBLIC_FONDO_URL` | Dominio del fondo: canonical, OG y sitemap. |
| `NEXT_PUBLIC_SITE_URL` | Dominio de la casa: destino de los links que salen. |
| `SEO_INDEXABLE` | Kill-switch de indexación. **Sin `=1`, `robots.txt` bloquea todo.** Se prende al lanzar. |
| `FONDO_STANDALONE` | Lo pone el script. Es lo que hace la página prerenderizable. |

El script imprime los tres primeros al arrancar: mirar esa línea antes de
deployar es la forma barata de no publicar el canonical equivocado.

---

## Dominio

**Decidido 2026-07-31: el fondo se sirve en la RAÍZ de `bengocheainversiones.com`**,
y el institucional se conserva en `gbengochea.com.uy`. El dominio ya está
horneado como default en `lib/sitios.ts` — no hace falta exportar
`NEXT_PUBLIC_FONDO_URL` en cada build.

Pasos (los dos primeros son de quien administra la cuenta y el registrador):

1. Dashboard → **Add a site → Connect a domain** → `bengocheainversiones.com` →
   plan Free. Apagar **"Block training in robots.txt"**: este deploy genera su
   propio `robots.txt` y no queremos que el borde le inyecte directivas.
2. En el registrador, reemplazar los nameservers por los dos que da Cloudflare.
3. Con la zona activa: Workers → `bng-fondo-site` → Settings → Domains & Routes →
   **Add Custom Domain**. Por CLI el token necesita además `Zone: DNS: Edit` y
   `Zone: Workers Routes: Edit`.

**Por qué no se puede colgar de `gbengochea.com.uy`:** un Custom Domain exige la
zona en la misma cuenta, ese dominio resuelve en Antel, y Cloudflare **sólo
delega subdominios sueltos en plan Enterprise**. Habría que mudar la zona
entera, mail incluido.

## ⚠️ Links al institucional: traducción temporal

El sitio del fondo linkea `/contacto`, `/equipo` e `/informes` — las rutas de la
app. Pero `gbengochea.com.uy` sirve todavía el **sitio PHP viejo**, donde esas
rutas dan **404** (verificado). Publicar así dejaba el CTA principal del fondo
—"Hablar con un asesor"— cayendo en una página de error.

`scripts/build-fondo.mts` las traduce al armar (tabla `CASA_LEGACY`):

| Ruta de la app | URL del sitio viejo |
|---|---|
| `/contacto` | `/contacto.php` |
| `/equipo` | `/nosotros.php` (su encabezado es "Nuestro equipo") |
| `/informes` | `/informes.php` |

Está en el script y no en los componentes a propósito: es una condición del
entorno, no del producto. **Cuando salga el institucional nuevo, se vacía ese
objeto y listo.** Los PDFs regulatorios del pie (`/files/*.pdf`) apuntan al sitio
viejo y responden 200 — ésos no se tocan.

---

## Documentos: acá viajan en el deploy, no en R2

**El panel no gobierna los documentos de este sitio.** Publica contra su propia
base y su propio filesystem —el home server—, y no hay puente hacia la D1 ni el
R2 de esta cuenta (pendiente 1). Se publicaron el Reglamento y la autorización
del BCU en el panel, el sitio los siguió mostrando como "Solicitar", y era
correcto: el API respondía la lista vacía porque acá `site_flags` está vacía y
`fondo_documentos` no tiene filas.

La salida elegida —a cambio de no habilitar R2— es que los PDFs ya publicados
**viajen como assets del deploy**:

```
public/documentos/*.pdf        ← los archivos, versionados con el repo
lib/fondoDocsEstaticos.ts      ← la lista: tipo, ruta, bytes, fecha
```

`FondoDocumentos` resuelve cada documento con el API primero y esta lista
después, así que donde el panel SÍ gobierna (el home server, y este sitio el día
que exista el puente) nada cambia — y cuando llegue el puente no hay que deshacer
nada, sólo vaciar la lista.

**Publicar o actualizar un documento acá es un cambio de código**: poner el PDF
en `public/documentos/`, editar `lib/fondoDocsEstaticos.ts` (los tres campos se
mueven juntos) y `npm run fondo:deploy`. Si `bytes` no coincide con el archivo, o
el archivo no llega al deploy, **el build corta** — no publica una fila que
anuncia un tamaño que no es o un link que da 404.

Consecuencia que hay que tener presente: un documento de esta lista **no se puede
pausar desde el panel**. Para los dos que hay —el Reglamento y la autorización—
no es un caso real: son los documentos constitutivos del Fondo, no se despublican.
Para cualquier otro, el camino es el puente, no agregarlo acá.

Los PDFs quedan además servidos por el sitio institucional en la misma ruta
(`public/` es compartido) y, cuando se prenda `SEO_INDEXABLE`, son rastreables:
`robots.txt` sólo bloquea `/api/`. Para documentos regulatorios es lo normal en
la industria; si alguna vez no se quiere, va un `X-Robots-Tag` en `_headers`.

---

## Pendientes conocidos

1. **El panel escribiendo a esta D1.** El panel de empleados viaja con el sitio
   institucional (que puede terminar en otro host) y hoy escribe contra su propia
   base. Para que publique el NAV y los documentos del fondo hay que darle un
   cliente D1 sobre el API HTTP de Cloudflare — otra implementación de la interfaz
   `D1Database` de `lib/metrics.ts`, que es el seam que ya existe. Sin eso, el
   valor cuota diario no llega al sitio.
2. **`workers/nav-ingest` apunta a la base vieja** (`ticker-metrics`, cuenta
   Ceibo Labs). Al mover el fondo hay que redeployarlo en la cuenta nueva con el
   `database_id` de `bng-fondo` y rehacer el Email Routing.
3. **Documentos**: en este sitio NO salen del panel — ver la sección siguiente.
4. **La página se comparte sin imagen de OG.** No es del hosting, pero se nota al
   pasar el link por WhatsApp o LinkedIn.

---

## Gotchas (vividos, no teóricos)

- **`BEGIN;` / `COMMIT;` en los seeds**: D1 rechaza las transacciones explícitas
  (*"use the state.storage.transaction() APIs instead"*). Los seeds ya salen sin
  ellas y el generador también — no volver a agregarlas.
- **`process is not defined`**: `lib/fondo.ts` lee `process.env.FONDO_DEMO` al
  cargar el módulo. Por eso el worker lleva `nodejs_compat`. Y **`FONDO_DEMO` no
  se declara nunca en este worker**: prende el valor cuota SIMULADO.
- **Chunks diferidos**: el runtime de Turbopack los referencia **relativos**
  (`"static/chunks/…"`, sin `/_next/`). El barrido del script contempla las dos
  formas y al final **verifica** que toda referencia resuelva a un archivo del
  deploy: si falta una, el build falla en vez de publicar una página con un
  módulo muerto (así se detectó, con el gráfico de performance sin dibujar).
- **404 cacheado en el browser** al iterar en local: si pediste una URL cuando el
  archivo todavía no estaba en `dist/fondo`, Chrome se queda con el 404. Forzar
  con `fetch(url, {cache: "reload"})` antes de concluir que el deploy está mal.
- **La CSP no viaja sola**: los assets se sirven sin pasar por la app, así que las
  cabeceras de seguridad van en `_headers`, generado desde
  `lib/headersSeguridad.ts` — la misma fuente que usa `next.config.ts`.
