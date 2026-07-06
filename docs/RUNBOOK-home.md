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
| `PANEL_PEPPER` | Firma contraseñas y cifra secrets TOTP. **Rotarlo invalida todas las credenciales.** Backup en gestor de contraseñas. |
| `ADMIN_TOKEN` | Gate de `/admin/setup` (bootstrap) y del dashboard de métricas del analizador. |
| `DATA_DIR` | Dónde viven sqlite + PDFs (default `./data`). |
| `TRUSTED_PROXY` | `1` = confiar X-Forwarded-For del proxy propio (lockouts por IP). |
| `PANEL_COOKIE_INSECURE` | `1` = cookie sin `Secure` (sólo http de prueba). |
| `PANEL_PBKDF2_ITERS`, `PANEL_SESSION_TTL_HOURS`, `PANEL_SESSION_IDLE_MINUTES` | Ajustes finos de auth (defaults sanos; en un server propio no hay límite de CPU — se puede subir el costo del hash). |

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
