# Runbook — feed de Instagram en el sitio

Cómo poner en marcha (y operar) el módulo que muestra los últimos posteos de
**@bengochea_inversiones** en la web, renderizados con el diseño de la casa.

**Arquitectura:** un **Scheduled Worker** (`workers/instagram-ingest/`) corre cada
6 h → pide los últimos posteos a la **API de Instagram (Instagram Login)** → copia
cada imagen (still) a **R2** (las URLs del CDN de Instagram expiran, no se pueden
hotlinkear) y escribe la metadata en **D1** (`instagram_posts`) → el sitio lo lee
por `/api/instagram` y sirve las imágenes same-origin por
`/api/instagram/media/[id]` (el CSP es `img-src 'self'`). El token vive en D1
(`instagram_auth`) y el worker lo **refresca solo**. Espeja el pipeline del fondo
(`docs/RUNBOOK-fondo.md`).

/ Código en rama `feat/institucional` (WIP, sin commitear). NO mergear a `main`
/ (prod) sin pedido explícito.

## Estado (2026-07-02)

- [x] **Código completo y validado** — migración + schema, `lib/instagramIngest`
      (puro, 21/21 tests), `lib/instagramStore` (I/O D1 + R2), worker
      (`wrangler deploy --dry-run` OK), rutas `/api/instagram` y
      `/api/instagram/media/[id]`, hook `useInstagram`, componente `InstagramFeed`.
      tsc + eslint limpios. **Nada desplegado todavía.**
- [ ] App de Meta + token largo (paso 1). *Depende del cliente / dueño de la cuenta.*
- [ ] Bucket R2 (paso 2).
- [ ] Migración D1 aplicada (paso 3).
- [ ] Token sembrado en `instagram_auth` (paso 4).
- [ ] Deploy del worker + secrets (pasos 5–6).
- [ ] Primer pull (paso 7).
- [ ] Componente montado en la página (paso 8).

## Requisitos

- Cuenta **Business o Creator** (confirmado). Las personales están fuera de la API.
- La app de Meta queda en **Development Mode** con la cuenta como tester → **no
  hace falta App Review** (sólo accedemos a nuestra propia cuenta).

---

## Paso 1 — App de Meta + token largo (Instagram Login)

1. `developers.facebook.com/apps` → **Create app** → tipo **Business**.
2. **Add product → Instagram → "API setup with Instagram login"**.
3. Agregá la cuenta **@bengochea_inversiones** y generá un **token corto** (botón
   *Generate token* del panel, con el login de la cuenta).
4. Cambiá el token corto por uno **largo (~60 días)**:
   ```bash
   curl -s "https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=<APP_SECRET>&access_token=<TOKEN_CORTO>"
   # → { "access_token": "<TOKEN_LARGO>", "token_type": "bearer", "expires_in": 5183944 }
   ```
   Guardá el `access_token` (largo) y el `expires_in` (segundos) para el paso 4.

## Paso 2 — Bucket R2

```bash
npx wrangler r2 bucket create instagram-media
```
El binding `INSTAGRAM_MEDIA` ya está declarado en `wrangler.toml` (raíz, para
Pages) y en `workers/instagram-ingest/wrangler.toml` (worker).

## Paso 3 — Migración D1 (idempotente; repetir no rompe)

```bash
npx wrangler d1 execute ticker-metrics --remote --command="$(cat db/migrations/2026-07-02-instagram-feed.sql)"
# local (para probar con wrangler pages dev):
npx wrangler d1 execute ticker-metrics --local  --command="$(cat db/migrations/2026-07-02-instagram-feed.sql)"
```

## Paso 4 — Sembrar el token en D1

Una sola vez. `expires_at` es epoch **ms**; con el `expires_in` del paso 1:
```sql
INSERT INTO instagram_auth (id, access_token, expires_at, updated_at)
VALUES (1, '<TOKEN_LARGO>', (unixepoch() + 5183944) * 1000, unixepoch() * 1000)
ON CONFLICT(id) DO UPDATE SET
  access_token = excluded.access_token, expires_at = excluded.expires_at, updated_at = excluded.updated_at;
```
```bash
npx wrangler d1 execute ticker-metrics --remote --command="$(cat archivo-seed.sql)"
```
(Si no anotaste `expires_in`, usá `(unixepoch() + 60*24*3600) * 1000`; el worker
corrige el vencimiento en el primer refresh.)

## Paso 5 — Deploy del worker

```bash
npx wrangler deploy --config workers/instagram-ingest/wrangler.toml
```

## Paso 6 — Secrets del worker

```bash
npx wrangler secret put RESEND_API_KEY     --config workers/instagram-ingest/wrangler.toml   # alertas ante fallos
npx wrangler secret put INSTAGRAM_ALERT_TO --config workers/instagram-ingest/wrangler.toml   # a dónde van
npx wrangler secret put SYNC_TOKEN         --config workers/instagram-ingest/wrangler.toml   # habilita el trigger manual (paso 7)
# opcionales: INSTAGRAM_ALERT_FROM, INSTAGRAM_FETCH_LIMIT (default 6)
```

## Paso 7 — Primer pull (sin esperar el cron)

Con `SYNC_TOKEN` seteado, el worker acepta un trigger manual `POST /sync`:
```bash
curl -X POST -H "x-sync-token: <SYNC_TOKEN>" https://instagram-ingest.<subdominio>.workers.dev/sync
# → {"ok":true,"detail":"3 posteos (3 nuevos, 0 podados)"}
```
(Hay que tener habilitado el subdominio `workers.dev` de la cuenta, o usar una
ruta propia. Alternativa local: `npx wrangler dev --config workers/instagram-ingest/wrangler.toml`
y pegarle a `http://localhost:8787/sync`.)

## Paso 8 — Montar el componente

Dentro de una página `.site` (p. ej. la home, cerca del final antes del footer):
```tsx
import { InstagramFeed } from "@/components/institucional/InstagramFeed";
// …
<InstagramFeed count={3} />
```
Mientras `instagram_posts` esté vacía, el módulo **no aparece** (estado vacío
honesto). En cuanto el paso 7 carga posteos, aparece solo.

---

## Cómo funciona el refresh del token

Cada corrida, si al token le quedan **< 15 días**, el worker lo refresca contra
`graph.instagram.com/refresh_access_token` y **reescribe la fila** de
`instagram_auth` con el token nuevo y su vencimiento. Nunca hay que renovarlo a
mano salvo que **venza del todo** (p. ej. si el worker estuvo caído > 60 días):
ahí hay que rehacer los pasos 1 y 4. El worker alerta por Resend si el refresh
falla.

## Gotchas de Cloudflare (heredados del fondo)

- `wrangler d1 execute --file --remote` puede fallar con `Authentication error
  [code: 10000]` en tokens OAuth viejos → usar `--command="$(cat archivo.sql)"`
  (el `=` pegado) o `wrangler login`.
- Proyecto Pages real = **`gb-ticker-analysis`** (aunque el toml diga `name =
  "ticker"`): los comandos `wrangler pages …` necesitan `--project-name=gb-ticker-analysis`.
- Si en prod `/api/instagram/media/[id]` diera 404 con datos presentes, verificá
  que el binding R2 `INSTAGRAM_MEDIA` esté aplicado al proyecto Pages (igual que
  la D1 `METRICS_DB`; viene del `wrangler.toml` raíz en el `pages:build`).

## Verificación

```bash
# posteos cacheados:
npx wrangler d1 execute ticker-metrics --remote --command="SELECT id, taken_at, substr(caption,1,50) AS cap FROM instagram_posts ORDER BY taken_at_ms DESC;"
# auditoría del cron (sync / refresh / prune):
npx wrangler d1 execute ticker-metrics --remote --command="SELECT ts, action, decision, detail FROM instagram_audit ORDER BY ts DESC LIMIT 10;"
# vencimiento del token:
npx wrangler d1 execute ticker-metrics --remote --command="SELECT datetime(expires_at/1000,'unixepoch') AS vence FROM instagram_auth;"
# tests del normalizador:
npx tsx scripts/dev-tests/test-instagram-ingest.ts
```

## Operar

- **Ocultar un posteo** sin borrarlo (no querés que aparezca en el sitio):
  ```sql
  UPDATE instagram_posts SET status = 'hold' WHERE id = '<media_id>';
  ```
  El worker lo vuelve a poner en `'live'` si sigue entre los últimos N (el UPSERT
  fuerza `'live'`). Para excluirlo de forma estable, bajá `INSTAGRAM_FETCH_LIMIT`
  o filtralo aparte.
- **Forzar un re-sync**: repetir el paso 7.
- **Cuántos se muestran**: `count` en el componente (default 3); cuántos se
  guardan: `INSTAGRAM_FETCH_LIMIT` (default 6).
