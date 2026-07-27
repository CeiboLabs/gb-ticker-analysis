# Runbook — ingesta de datos del fondo BNG Selección Global

Cómo poner en marcha (y operar) el pipeline que reemplaza los datos estáticos del
fondo por datos reales. Arquitectura: el valor cuota llega por mail diario del
administrador → el cliente lo reenvía a una dirección secreta → **Email Worker**
de Cloudflare (`workers/nav-ingest/`) lo valida y escribe en D1 `fund_nav` → el
sitio lo lee por `/api/fondo`. Detalle de diseño en
`~/.claude/.../memory/project_fondo_ingesta.md` y en el plan
`~/.claude/plans/delightful-jumping-mccarthy.md`.

/ Código en rama `feat/institucional` (WIP, sin commitear). NO mergear a `main`
/ (prod) sin pedido explícito.

## Estado (2026-06-29)

- [x] **Etapa 1** — sitio honesto + carga manual: schema, validación
      (`lib/fondoIngest.ts`), I/O (`lib/fondoStore.ts`), placeholder gateado a
      dev-only, `FondoTenencias` cableado al seam real. La carga manual
      (backfill / corrección / tenencias) se hace por **SQL directo a D1** — el
      panel `/admin/fondo` y sus rutas se quitaron (2026-06-29). Verificado.
- [x] **Etapa 2** — Email Worker construido (`workers/nav-ingest/`) y validado
      (`wrangler deploy --dry-run` OK). **NO desplegado.**
- [x] **Migración aplicada a la D1 remota** (`ticker-metrics`): existen `fund_nav`
      (+ status/source/message_id/sender_hash), `fund_audit`, `fund_ingest_seen`,
      `fund_benchmark`, `fund_holdings_snapshot`, `fund_holdings_item`.
- [x] ~~`FUND_INGEST_TOKEN`~~ — era el login del panel; **ya no se usa** (el panel
      se quitó). Se puede borrar el secret de Pages: `npx wrangler pages secret
      delete FUND_INGEST_TOKEN --project-name=gb-ticker-analysis`.
- [ ] Deploy del Email Worker.
- [ ] Secrets del worker + Email Routing + reenvío del cliente.
- [ ] Histórico real cargado (depende del administrador).
      ⚠️ **En el home server (gestapp) hay serie SIMULADA cargada** desde
      2026-07-22, para que el equipo vea los gráficos en la preview: 666 cierres
      (2024-01-02 → 2026-07-21) en `fund_nav` + `fund_benchmark`, generados con
      las mismas fórmulas del placeholder de `lib/fondo.ts` (start 1000, beta
      1.18 para el 60/40). Cada fila lleva `source='backfill'` y una `nota` que
      la marca como simulada (la `nota` no se expone al frontend), y hay una fila
      en `fund_audit`. Se cargó además un **snapshot de tenencias simulado**:
      `as_of='2026-05-31'` (tiene que ser ≤ hoy − `HOLDINGS_LAG_DAYS`=30 para
      ser divulgable), 18 líneas RV/RF/Otros = 51,5/34,0/14,5% sumando 10000 bps,
      con `note` marcándolo como simulado. **Borrar antes de cargar lo real:**
      `DELETE FROM fund_nav; DELETE FROM fund_benchmark;`
      `DELETE FROM fund_holdings_item; DELETE FROM fund_holdings_snapshot;`
      (sin filas, la página vuelve sola al estado honesto de pre-lanzamiento).
      ⚠️ El bloque **Exposición geográfica** NO sale de las tenencias: los pesos
      por región están hardcodeados en `components/institucional/FondoGeografia.tsx`
      (`REGIONES`), y son datos inventados que siguen ahí desde antes.
- [ ] Parser del mail (Etapa 3, depende de un mail de muestra).
- [ ] Benchmark (Etapa 4, a confirmar con Adrián).

## Gotchas de Cloudflare (ya aprendidos)

- `wrangler d1 execute --file --remote` usa el API de **import** y falla con
  `Authentication error [code: 10000]` si el token OAuth está viejo. Workaround:
  aplicar por **query API** con `--command="$(cat archivo.sql)"` (el `=` pegado;
  si el valor empieza con `--`, yargs lo malparsea). O `wrangler login` para
  refrescar el token.
- Proyecto Pages real = **`gb-ticker-analysis`** (aunque `wrangler.toml` diga
  `name = "ticker"`): los comandos `wrangler pages …` necesitan
  `--project-name=gb-ticker-analysis`.
- Secrets de Pages: `wrangler pages secret put` aplica a **production**. Para
  testear en un **preview** hay que setear el secret también en ese entorno.

## Comandos

### Migración D1 (ya aplicada en remote; repetir es idempotente)
```bash
npx wrangler d1 execute ticker-metrics --remote --command="$(cat db/migrations/2026-06-26-fondo-ingesta.sql)"
# local (para probar el sitio del fondo con datos locales, wrangler pages dev):
npx wrangler d1 execute ticker-metrics --local  --command="$(cat db/migrations/2026-06-26-fondo-ingesta.sql)"
```

### Deploy del Email Worker
```bash
npx wrangler deploy --config workers/nav-ingest/wrangler.toml
```

### Secrets del worker (después del deploy)
```bash
cd workers/nav-ingest
npx wrangler secret put INGEST_ALLOWED_SENDERS   # mail del admin y/o el reenvío del cliente (coma-separado, minúsculas)
npx wrangler secret put RESEND_API_KEY           # misma cuenta Resend que el form de contacto
npx wrangler secret put FUND_ALERT_TO            # a dónde van las alertas (rechazos, dead-man, éxito)
# opcionales: FUND_ALERT_FROM, NAV_MAX_DAILY_MOVE (default 0.10), DEADMAN_MAX_STALE_DAYS (default 3)
```

### Email Routing (dashboard, una vez)
1. Cloudflare → el dominio → Email Routing → agregar un **subdominio** (ej.
   `ingest.gbengochea.com.uy`) con su MX, sin tocar el mail real de la empresa.
2. Crear una dirección **secreta** (ej. `nav-7h3k9x@ingest.…`) y enrutarla al
   worker `nav-ingest`.
3. El cliente arma un filtro: "del administrador → reenviar a esa dirección".

### Cargar / corregir datos a mano (SQL directo a D1)
Sin panel: las cargas manuales van por `wrangler d1 execute`. Probá SIEMPRE primero
con `--local` (D1 de staging) y recién después `--remote`. `updated_at` /
`ingested_at` son epoch en **ms** (`unixepoch()*1000`). Para SQL multilínea,
guardalo en un archivo y pasalo con `--command="$(cat archivo.sql)"` (el `=` pegado).

**Backfill / extender el histórico** (idempotente por `dia`; flippea el sitio a
datos reales en cuanto hay una fila `live`):
```sql
INSERT INTO fund_nav (dia, nav, aum, nota, updated_at, status, source)
VALUES ('2024-01-02', 100.0000, 11000000, NULL, unixepoch()*1000, 'live', 'backfill')
ON CONFLICT(dia) DO UPDATE SET
  nav=excluded.nav, aum=excluded.aum, nota=excluded.nota,
  updated_at=excluded.updated_at, status='live', source=excluded.source;
```

**Corregir un día ya publicado (override)** — el worker NUNCA pisa un valor: ante
conflicto rechaza y alerta, así que la corrección es a mano. Dejá rastro en
`fund_audit` (como hacía el panel; el motivo es obligatorio por disciplina):
```sql
INSERT INTO fund_nav (dia, nav, aum, updated_at, status, source)
VALUES ('2026-06-05', 101.2345, NULL, unixepoch()*1000, 'live', 'override')
ON CONFLICT(dia) DO UPDATE SET
  nav=excluded.nav, aum=excluded.aum, updated_at=excluded.updated_at,
  status='live', source='override';

INSERT INTO fund_audit (ts, actor, channel, action, decision, reason, target_dia, parsed_nav, raw_excerpt)
VALUES (unixepoch()*1000, 'admin', 'sql', 'override', 'superseded', 'ok', '2026-06-05', 101.2345, 'motivo de la corrección');
```

**Snapshot mensual de tenencias** — reemplaza el snapshot de ese `as_of`. Pesos en
**bps** que suman ~10000 (100%); `asset_class` ∈ `RV` / `RF` / `Otros`. El sitio lo
muestra recién tras el rezago de divulgación (`HOLDINGS_LAG_DAYS` = 30 días):
```sql
DELETE FROM fund_holdings_item WHERE as_of = '2026-05-31';

INSERT INTO fund_holdings_snapshot (as_of, status, source, ingested_at)
VALUES ('2026-05-31', 'live', 'admin', unixepoch()*1000)
ON CONFLICT(as_of) DO UPDATE SET status='live', source='admin', ingested_at=excluded.ingested_at;

INSERT INTO fund_holdings_item (as_of, ord, name, short, asset_class, weight_bps) VALUES
  ('2026-05-31', 0, 'iShares Core S&P 500 ETF', 'S&P 500', 'RV', 1800),
  ('2026-05-31', 1, 'iShares Core US Aggregate Bond ETF', 'US Agg', 'RF', 1200);
  -- … (la suma de weight_bps debe dar ≈ 10000)
```

⚠️ La validación que antes corría el panel (banda de cordura del NAV, pesos ~100%,
fechas reales, conflicto) **ya no se aplica** en estas vías: revisá los números a
ojo antes de tocar `--remote`. La ingesta por mail del worker SÍ sigue validando.

### Verificación
```bash
# tablas del fondo en remote:
npx wrangler d1 execute ticker-metrics --remote --command="SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'fund%';"
# salud / auditoría:
npx wrangler d1 execute ticker-metrics --remote --command="SELECT * FROM fund_audit ORDER BY ts DESC LIMIT 10;"
# tests de validadores:
npx tsx scripts/dev-tests/test-fondo-ingest.ts
npx tsx scripts/dev-tests/test-mime-parse.ts
```

## Etapa 3 — cerrar el parser (bloqueado por un mail de muestra)
Mientras `EXTRACTORS` (en `lib/fondoIngest.ts`) esté vacío, cada mail recibido se
**loguea saneado** en `fund_audit` (consultable por SQL, `decision='rejected'`) y dispara
una alerta. Con 1-3 mails reales se escribe la estrategia de extracción activa
(asunto / cuerpo / CSV / XLSX / PDF) y se enciende.

## Etapa 4 — benchmark (a confirmar con Adrián)
Fuente del 60/40: compuesto provisto por el administrador (recomendado) vs proxy
ETF (URTH+AGG) con la infra Yahoo existente. Se carga en `fund_benchmark`.

## Staging en el home server (preview)

Decisión (2026-06-28): **prod queda en Cloudflare** (plan pago o recorte de rutas
de test, cuando el institucional salga); el **home server es para preview/staging**.
Corre el build tal cual con `wrangler pages dev` (modo dev de Pages: D1 LOCAL vía
miniflare + secrets por `.dev.vars`, **sin límite de 3 MiB**), detrás de un
**Cloudflare Tunnel**. Datos **aislados de prod** (D1 local propia) → se puede
backfillear de prueba sin tocar nada real. Receta verificada localmente
(pre-launch → backfill → live ✓).

Prereqs en el server: Node 20+, git, `cloudflared`.

```bash
# 1. código en el server (ver "cómo subir el código")
cd ticker && npm ci

# 2. build (Pages output)
npm run pages:build

# 3. D1 local (idempotente)
npx wrangler d1 execute ticker-metrics --local --command="$(cat db/migrations/2026-06-26-fondo-ingesta.sql)"

# 4. .dev.vars (secrets de staging, gitignored — NO commitear)
#    OPENAI_API_KEY / ADMIN_TOKEN / RESEND_API_KEY si querés el resto andando

# 5. correr (cloudflared lo expone; el puerto queda local)
npx wrangler pages dev .vercel/output/static --port 8788 --ip 127.0.0.1
```

Para que levante solo: un **servicio systemd** que corra el paso 5
(`WorkingDirectory=<repo>`, `Restart=always`).

**Cloudflare Tunnel** (mantiene TLS/anti-DDoS, no expone IP ni abre puertos):
```bash
cloudflared tunnel login
cloudflared tunnel create bng-staging
cloudflared tunnel route dns bng-staging staging.gbengochea.com.uy   # el hostname que elijas
# config.yml → ingress: service http://localhost:8788
cloudflared tunnel run bng-staging        # o como servicio systemd
```

Acceso: `https://staging.<dominio>/bng-seleccion-global` (la página del fondo, con
los datos de la D1 local). Re-deploy tras cambios: `git pull` → `npm run pages:build`
→ reiniciar el servicio.
