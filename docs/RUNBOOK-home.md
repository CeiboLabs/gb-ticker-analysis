# RUNBOOK — Sitio + panel en el home server (sin Cloudflare)

El sitio y el panel corren como una app Next.js normal de Node. Los servicios
de Cloudflare quedaron reemplazados por bindings locales que registra
`instrumentation.ts` al arrancar el server (`lib/homeBindings.ts`):

| En Cloudflare | En el home server |
|---|---|
| D1 `ticker-metrics` | **SQLite** `DATA_DIR/bengochea.sqlite3` (WAL, better-sqlite3) |
| R2 `bengochea-docs` (binding `DOCS`) | carpeta `DATA_DIR/r2/docs/` |
| R2 `instagram-media` | carpeta `DATA_DIR/r2/instagram-media/` |
| runtime edge | runtime Node (se quitó `export const runtime = "edge"` de todo `app/`) |

El resto del código no cambió: todo habla contra las interfaces `D1Database`/
`R2Bucket` de `lib/metrics.ts`, y los adaptadores las implementan. El esquema
(db/schema.sql + la migración del panel, con su seed de informes) se aplica
solo, la primera vez, al arrancar.

## Puesta en marcha (Docker, recomendado)

```bash
git clone <repo> && cd ticker
cat > .env <<'EOF'
PANEL_PEPPER=<openssl rand -base64 32>
ADMIN_TOKEN=<token largo y aleatorio>
OPENAI_API_KEY=<key>           # analizador /analyze
# RESEND_API_KEY=... CONTACT_TO=...   # opcional: mails del form de contacto
# TRUSTED_PROXY=1                     # sólo detrás de un reverse proxy propio
EOF
docker compose up -d --build
```

Los datos quedan en `./data` (montado en el contenedor): **backup = copiar esa
carpeta** (sqlite + PDFs). Con el server arriba: `https://<host>/admin/setup` →
pegar el `ADMIN_TOKEN` → crear el primer admin → login → enrolar la app
autenticadora. El resto de la operación del panel está en `docs/RUNBOOK-panel.md`.

## Puesta en marcha (Node pelado, sin Docker)

```bash
# Node 20+ (mejor 22)
npm ci
npm run build
PANEL_PEPPER=... ADMIN_TOKEN=... npx next start -p 3000 -H 0.0.0.0
```

Para dejarlo como servicio, un systemd unit mínimo:

```ini
[Unit]
Description=Bengochea web + panel
After=network.target

[Service]
WorkingDirectory=/srv/ticker
EnvironmentFile=/srv/ticker/.env
ExecStart=/usr/bin/npx next start -p 3000 -H 0.0.0.0
Restart=always
User=www-data

[Install]
WantedBy=multi-user.target
```

## TLS, cookies y lockouts — leer antes de exponerlo

- **El panel exige HTTPS en producción**: la cookie de sesión es `__Host-…;
  Secure`. Poné un reverse proxy con TLS adelante (Caddy lo hace solo:
  `reverse_proxy localhost:3000`). Sin TLS (pruebas en LAN) seteá
  `PANEL_COOKIE_INSECURE=1` — y quitalo al pasar a HTTPS.
- **Lockouts por IP**: sin Cloudflare no existe `cf-connecting-ip`. Si el
  reverse proxy PISA `X-Forwarded-For`/`X-Real-IP` (nginx `proxy_set_header`,
  Caddy lo hace por defecto), seteá `TRUSTED_PROXY=1` para que el rate-limit de
  login se kee por IP real. **Jamás** con el puerto de Node expuesto directo
  (el header sería falsificable). Sin ese env, el lockout por IP se desactiva
  pero el de por-cuenta (10 fallas/h) sigue firme.
- No expongas el puerto de Node a internet: sólo el proxy.

## Env vars

| Var | Qué hace |
|---|---|
| `MOCK_REPORT` | `true` = /analisis devuelve un stub sin llamar a OpenAI. En gestapp está en **`false`** desde 2026-07-22 (análisis reales). |
| `OPENAI_API_KEY` | Requerida cuando `MOCK_REPORT` no es `true`; sin ella la ruta cae. Junto con `FINNHUB_API_KEY` y `TWELVEDATA_API_KEY` completan el analizador. |
| `PANEL_PEPPER` | Firma contraseñas y cifra secrets TOTP. **Rotarlo invalida todas las credenciales.** Backup en gestor de contraseñas. |
| `ADMIN_TOKEN` | Gate de `/admin/setup` (bootstrap) y del dashboard de métricas del analizador. |
| `DATA_DIR` | Dónde viven sqlite + PDFs (default `./data`). |
| `TRUSTED_PROXY` | `1` = confiar X-Forwarded-For del proxy propio (lockouts por IP). |
| `PANEL_COOKIE_INSECURE` | `1` = cookie sin `Secure` (sólo http de prueba). |
| `PANEL_PBKDF2_ITERS`, `PANEL_SESSION_TTL_HOURS`, `PANEL_SESSION_IDLE_MINUTES` | Ajustes finos de auth (defaults sanos; en un server propio no hay límite de CPU — se puede subir el costo del hash). |
| `LEAD_GATE_SECRET` | Firma el token de "esta persona ya dejó su correo" (mín. 16 chars). **Sin esto el gate de /analisis NO se aplica** — fail-open deliberado, con aviso en el error reporter: una env var faltante no puede tumbar el analizador. Rotarlo sólo hace que todos vuelvan a ver el formulario una vez. |
| `LEAD_GATE_TTL_DAYS` | Vida del token del gate (default `365`). Es identidad, no sesión. |

## Gate de captura de correo en /analisis

Pide el correo **sólo para GENERAR** un análisis que todavía no existe (o para
"Actualizar análisis"). Leer uno ya hecho sale del cache y nunca pide nada: el
costo es por generación, no por lectura.

No es un muro seco sino una previsualización: se lee Yahoo (gratis — ni EDGAR ni
OpenAI) y se muestra la **cabecera real** con logo, nombre, precio, variación y
múltiplos; de ahí para abajo va un informe de **MUESTRA** desenfocado, con el
formulario encima. Misma estructura que uno real (banda de tesis, las trece
secciones, Sankey, escenarios) con texto de relleno; las métricas y el gráfico
de precio sí son datos reales de Yahoo, que ya teníamos gratis.

El contenido de muestra vive en `app/(institucional)/analisis/previewReport.ts`:
una **foto completa de un informe real de la casa** (hoy: AAPL) — el informe *y*
el `stockData` con el que se generó. Se usa contenido real porque con relleno
inventado las secciones quedaban a un tercio de su largo y el bloque de veredicto
se veía como una caja vacía.

**Se congelan los dos juntos, y no es opcional.** Si se mezcla este informe con
el `stockData` del ticker que la persona está mirando, el adaptador cruza datos
de dos empresas y fabrica números que no existen: el objetivo de AAPL contra el
precio de Chevron daba *"Upside +85,76 % desde USD 192,98"*, una afirmación falsa
y concreta sobre Chevron. Congelado el par, la muestra es una sola instantánea
coherente. Al regenerar: volcar `report` **y** `stockData` de la misma respuesta.

**El rating y el precio objetivo NO se dibujan**, aunque la muestra los tenga.
Son los dos únicos elementos grandes del bloque (56px y 28px) y seguían legibles
a través del desenfoque: debajo del encabezado del ticker que la persona buscó,
ese `HOLD` se leía como el veredicto de la casa sobre ESA acción — una
recomendación que nunca se emitió. En su lugar van `•••` y `USD —`. El resto del
bloque (convicción, copy, upside, rango, EV) sí usa los datos reales: a 11-13px
no se lee nada y el bloque conserva su peso visual.

Regla para cualquier cosa que se agregue a la muestra: **si es grande, no puede
decir nada atribuible.** El texto de las secciones va tal cual porque a 6px de
desenfoque es ilegible; los titulares y los números grandes, no.

El velo sólo renderiza la banda de tesis y "Dónde está el desacuerdo": las once
secciones que seguían es texto/gráficos que nadie ve, así que no se montan (antes
sí, y arrancaban la librería de charts para dibujar un precio recortado y
desenfocado — 80% de los nodos del velo, tirados). Por eso `previewReport.ts`
tampoco carga la prosa de esas secciones ni `historicalPrices`/`recentNews`: ~20 KB
menos de bundle. Si se vuelve a mostrar alguna sección, hay que reponer su dato al
regenerar la foto.

Casos que NO cobran peaje, a propósito:

- **Ticker cacheado** → se sirve el informe entero. Leer es gratis.
- **Ticker inexistente** → 404 normal. El camino largo vuelve a fallar en el
  mismo `fetchStockData`, así que tampoco gasta OpenAI; pedirle el correo a
  alguien que tipeó mal sería la peor primera impresión posible.

El orden dentro de `/api/analyze` importa y está comentado ahí: el peaje va
**después** del cap horario por IP (ya no es gratis: lee Yahoo) y **antes** del
cap diario de frescos (que es el presupuesto de OpenAI y no lo puede consumir un
pedido que terminó en el formulario).

- **Se prende desde el panel** (`/admin`, sección Secciones → *"Pedir correo
  para análisis nuevos"*). Default **OFF**: sin la fila en `site_flags` el
  analizador se comporta como siempre.
- Requiere `LEAD_GATE_SECRET` seteada. Si falta, el flag puede estar en ON y el
  peaje igual no se aplica — revisar el error reporter antes de dar por hecho
  que está cobrando.
- Las IPs de `RATE_LIMIT_IP_ALLOWLIST` (el equipo) nunca lo ven.
- Las altas caen en `newsletter_subscribers` con `source='analisis'`. La
  conversión se mide contra los eventos `status='email_gate'` de
  `analyze_events`:

```sql
SELECT (SELECT COUNT(*) FROM newsletter_subscribers WHERE source='analisis') AS altas,
       (SELECT COUNT(*) FROM analyze_events WHERE status='email_gate')       AS bloqueos;
```

### Validación de la dirección

Capa 1 IMPLEMENTADA (separa dos daños: costo de una llamada tirada vs. una base
con direcciones muertas que arruina la reputación de envío). Punto de captura
único (`components/institucional/NewsletterSignup.tsx`), así que /informes y
/analisis la heredan igual.

- **Corrector de typos** (`lib/emailValidation.ts`, puro, corre en el cliente):
  `gmial.com` → propone `gmail.com`. **Sugiere, no rechaza** — el segundo submit
  manda la dirección tal cual, para que un dominio corporativo raro no quede
  bloqueado. Umbral conservador (distancia 1, o 2 en dominios largos): un falso
  positivo —decirle a alguien que su dirección está mal— es peor que dejar pasar
  un typo. La lista `COMMON_DOMAINS` es también allowlist; incluye vecinos
  legítimos (mail.com, ymail.com, me.com) para no corregirlos entre sí.
- **Rechazo de desechables + MX** (`/api/newsletter`, server): dominio de correo
  temporal (`lib/emailValidation.ts`) o dominio que no puede recibir correo
  (`lib/emailMx.ts`, `node:dns`, con cache por dominio 6 h). Devuelve 400 y **no**
  da de alta ni emite la cookie del peaje. **Fail-open**: timeout/SERVFAIL dejan
  pasar — un problema de red nuestro no puede volverse "tu correo está mal".
  Nada de SMTP/`RCPT TO` (Gmail responde accept-all, greylistea y quema la IP).

Lo que la capa 1 NO ataja: `pepe1234@gmail.com` — dominio real, casilla que no
existe. Eso es la **capa 2** (columna `verified` + confirmación por click), que
sigue pendiente porque necesita que primero exista el envío de mails. El mail de
confirmación será el mail de ENTREGA del análisis: el click verifica sin pedir un
trámite aparte. Cuando se enchufe Resend, el webhook de hard-bounce debe marcar
`status='bounced'`, o la base se ensucia sola con el tiempo.

## Operación de la base (recuperaciones del RUNBOOK-panel, versión local)

El SQL de recuperación se corre con el CLI de sqlite contra el archivo:

```bash
sqlite3 data/bengochea.sqlite3 "UPDATE admin_users SET totp_secret=NULL, totp_pending_secret=NULL, totp_last_step=0 WHERE email='<email>';"
sqlite3 data/bengochea.sqlite3 "UPDATE admin_sessions SET revoked_at=strftime('%s','now')*1000 WHERE user_id=(SELECT id FROM admin_users WHERE email='<email>') AND revoked_at IS NULL;"
```

(Si no está `sqlite3`, `npx tsx` con better-sqlite3 hace lo mismo.) El
generador offline de hashes (`scripts/panel-hash-password.mts`) funciona igual:
necesita el `PANEL_PEPPER` del server.

**Migraciones futuras**: el bootstrap sólo corre en una base fresca
(`PRAGMA user_version=1`). Un cambio de esquema nuevo se aplica con
`sqlite3 data/bengochea.sqlite3 < db/migrations/<nueva>.sql`.

> **Pendiente de aplicar — artículos editoriales** (`2026-07-08-informe-contenido.sql`):
> agrega la columna `contenido` (JSON del artículo) a `informes`, para que
> /informes/[slug] se sirva como página en vez de PDF y se edite desde el panel.
> En base ya inicializada:
> ```
> sqlite3 data/bengochea.sqlite3 < db/migrations/2026-07-08-informe-contenido.sql
> ```
> (En base fresca ya viene en `schema.sql`, no correr el ALTER — daría "duplicate
> column". El store tolera la columna ausente: cae al seed de código hasta aplicarla.)

> **APLICADA en gestapp el 2026-07-22** — historial de veredictos (`2026-07-19-verdict-log.sql`):
> crea `verdict_log` (append-only, exenta de retención) con una fila por análisis
> fresco — el insumo del backtest de calidad de la recomendación — y siembra el
> historial con lo que `analyze_events` todavía conserva (~90 días). En base ya
> inicializada:
> ```
> sqlite3 data/bengochea.sqlite3 < db/migrations/2026-07-19-verdict-log.sql
> ```
> (En base fresca la tabla ya viene en `schema.sql`; la migración es 100%
> idempotente — re-correrla, backfill incluido, es un no-op. Mientras no se
> aplique, el write path de /api/analyze falla silencioso: el análisis sigue
> funcionando, sólo se pierde el historial.)

## Secciones sin publicar (lo que el equipo NO tiene que ver)

Se bloquea el **acceso**, no la visibilidad: el navbar y el footer siguen
listando estas secciones —el equipo tiene que ver el mapa completo del sitio—,
pero entrar devuelve 404. La lista vive en **`lib/paginasOcultas.ts`** y es la
única fuente de verdad. Una ruta ahí adentro:

- devuelve **404** (el 404 de la casa, con navbar y footer): la página llama
  `notFound()`. **No se hace con un `proxy.ts`** (el middleware de Next 16): se
  probó y falla acá — detrás de Tailscale Serve llega `X-Forwarded-Proto: https`,
  el rewrite arma `https://localhost:8788/...` y Next intenta TLS contra su
  propio puerto HTTP ⇒ 500 (EPROTO) en vez de 404. La guarda en la página no
  sale del proceso, así que es inmune al esquema;
- sale del **sitemap** (no se le ofrece a un crawler una URL que 404ea). El nav,
  el footer y los CTAs internos ("Ver el ecosistema", las filas de Mercados de
  la home, la salida al fondo al pie de cada informe) quedan tal cual.

**Publicar una sección terminada = borrar su línea de la lista y rebuildear.**
La página deja de 404ear y vuelve al sitemap; no hay nada más que tocar.

Estado al 2026-07-22 (preview para el equipo): bloqueadas `/nosotros`,
`/historia`, `/servicios`, `/educacion`, `/prensa` y `/oportunidades/*` (una
sola línea, `/oportunidades`, tapa los cuatro sectores por la regla de prefijo).
Quedan accesibles la home, `/equipo`, `/informes` (+ artículos), `/analisis`,
`/calculadora`, `/contacto` y **`/bng-seleccion-global`** (la página del fondo).

> Ojo: es un bloqueo de **build**, no un flag de la base. No se togglea desde el
> panel — cambiar la lista exige rebuild (que es lo que ya hace
> `docker compose up -d --build`).

## Cómo se llega al server

El home server es **`gestapp`** (Tailscale: `100.113.187.83`, LAN
`192.168.1.6`). El sitio NO está en el `:3000` de esa máquina —ese puerto lo
ocupa otra app (gestapp.uy)—: se publica por **Tailscale Serve** en

```
https://gestapp.tail75b274.ts.net
```

Es decir: sólo lo ven los dispositivos del tailnet. Para pasárselo al equipo,
cada integrante tiene que estar en la tailnet (o hay que exponerlo aparte).

## Qué quedó desactivado al salir de Cloudflare

- **Email Worker del fondo** (`workers/nav-ingest/`, NAV por mail) y **worker
  de Instagram**: dependen de Email Routing/crons de Cloudflare. El valor cuota
  se carga por el panel (`/admin/fondo`); Instagram sigue diferido (flag OFF).
  Si algún día hacen falta acá: IMAP polling / cron local — trabajo aparte.
- Los scripts `pages:*` de package.json y `wrangler.toml` quedan para un
  eventual retorno a Cloudflare; para volver habría que re-agregar
  `export const runtime = "edge"` a las rutas (está en la historia de git).

## Desarrollo

`npm run dev` (el de siempre, https://localhost:3000) ahora TAMBIÉN levanta los
bindings locales: el panel funciona en dev directo, sin wrangler ni
pages:preview. La base de dev es el mismo `./data` (borrala para arrancar de
cero). Tests del núcleo de auth: `npx tsx scripts/dev-tests/test-panel-auth.ts`.
