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
      🚨 **BLOQUEANTE DE LANZAMIENTO (verificado 2026-07-28)**: el home server
      —que se publica por Tailscale Funnel, o sea es PÚBLICO— sigue sirviendo los
      666 cierres simulados. Es un track record inventado de 2,5 años para un
      fondo que arranca hoy. Hay que borrarlo (comandos abajo) y cargar en su
      lugar `db/seeds/fondo-benchmark.sql` + la cartera real
      (`db/seeds/fondo-holdings.sql`, `as_of='2026-07-28'`, 17 líneas del
      cliente): las tenencias que hay cargadas allá también son simuladas
      (`note` = "preview — cartera simulada").
      ⚠️ **En el home server (gestapp) hay serie SIMULADA cargada** desde
      2026-07-22, para que el equipo vea los gráficos en la preview: 666 cierres
      (2024-01-02 → 2026-07-21) en `fund_nav` + `fund_benchmark`, generados con
      las mismas fórmulas del placeholder de `lib/fondo.ts` (start 1000, beta
      1.18 para el 60/40). Cada fila lleva `source='backfill'` y una `nota` que
      la marca como simulada (la `nota` no se expone al frontend), y hay una fila
      en `fund_audit`. Se cargó además un **snapshot de tenencias simulado**:
      `as_of='2026-05-31'` (tiene que ser ≤ hoy − `HOLDINGS_LAG_DAYS`, hoy 0, para
      ser divulgable), 18 líneas RV/RF/ALT = 51,5/34,0/14,5% sumando 10000 bps,
      con `note` marcándolo como simulado. **Borrar antes de cargar lo real:**
      `DELETE FROM fund_nav; DELETE FROM fund_benchmark;`
      `DELETE FROM fund_holdings_item; DELETE FROM fund_holdings_snapshot;`
      (sin filas, la página vuelve sola al estado honesto de pre-lanzamiento).
      ⚠️ El bloque **Exposición geográfica** NO sale de las tenencias: los pesos
      por región están hardcodeados en `components/institucional/FondoGeografia.tsx`
      (`REGIONES`), y son datos inventados que siguen ahí desde antes.
- [ ] Parser del mail (Etapa 3, depende de un mail de muestra).
- [x] **Etapa 4 — benchmark** (2026-07-28): compuesto definido y serie cargable.
      **60% MSCI ACWI / 40% Bloomberg Global Aggregate** (tickers Bloomberg
      `ACWI` / `LEGATRUU`), confirmado con el equipo el día del lanzamiento.
      Serie reconstruida con **proxies ETF** — ver sección "Benchmark" más abajo.
      Con `fund_nav` vacía y `fund_benchmark` cargada, la página entra en modo
      **sólo benchmark**: grafica la referencia (rotulada como tal, línea
      punteada, nota arriba del gráfico) en vez de un gráfico vacío.

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
**bps** que suman ~10000 (100%); `asset_class` ∈ `RV` / `RF` / `ALT`. El sitio lo
muestra tras el rezago de divulgación (`HOLDINGS_LAG_DAYS`, en **0** mientras el
Fondo no opere — restaurar a 30 cuando empiece):
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

## Benchmark — 60% MSCI ACWI / 40% Bloomberg Global Aggregate

Compuesto confirmado con el equipo (2026-07-28). Tickers Bloomberg de los
índices: `ACWI` y `LEGATRUU`. La definición vive en `BENCHMARK` (`lib/fondo.ts`)
y la serie, en `fund_benchmark`.

### Cómo está armada la serie HOY (proxy ETF)
Los niveles de MSCI ACWI y del Bloomberg Global Aggregate son **datos
licenciados**: no hay fuente pública que los sirva (se verificaron Yahoo y Twelve
Data). Mientras el administrador no pase el export real, la serie se
**reconstruye con ETFs** a precios ajustados por dividendos (total return, que es
lo que miden los índices originales) y rebalanceo diario:

| Pata | Peso | ETF | Por qué |
|---|---|---|---|
| Renta variable | 60% | `ACWI` (iShares MSCI ACWI) | réplica directa del índice |
| Renta fija | 18% | `AGG` (iShares Core U.S. Aggregate) | 45% del tramo = parte USD del Global Agg |
| Renta fija | 22% | `BWX` (SPDR Bloomberg Intl. Treasury, **sin cobertura**) | 55% del tramo = parte no-USD |

El tramo de renta fija es el aproximado: **no existe** un ETF accesible que siga
al Global Aggregate sin cobertura de moneda (BNDX/BNDW/AGGU están cubiertos, y la
cobertura es justo lo que separa a LEGATRUU de su gemelo cubierto). Los pesos
45/55 imitan la partición por moneda del índice real.

Contraste contra los índices reales (años calendario): 2022 −17,3% (real ≈ −17/−18%),
2023 +15,5% (≈ +15,5%), 2024 +9,1% (≈ +9,8%). La aproximación es buena, pero **no
es el valor oficial** — y el pie de la página lo dice (`BENCHMARK_PROXY.nota`).

### Generar / refrescar la serie
```bash
npx tsx scripts/fondo-benchmark-proxy.ts            # 5 años → db/seeds/fondo-benchmark.sql
npx tsx scripts/fondo-benchmark-proxy.ts --years=3  # otra ventana
sqlite3 data/bengochea.sqlite3 < db/seeds/fondo-benchmark.sql   # aplicar (local)
```
Es **idempotente** (UPSERT por `dia`): volver a correrlo extiende la serie hasta
el último cierre sin duplicar. Corriéndolo con el mercado abierto, el punto del
día queda con el precio en curso; una corrida post-cierre lo corrige.

⚠️ **Nadie lo corre solo todavía**: la serie no se actualiza sola. Hasta que haya
un cron (o llegue el dato real), refrescarla a mano cada tanto — si no, la línea
del benchmark se queda quieta mientras el mercado se mueve.

## Modo demo (presentaciones internas)

Para mostrarle el producto TERMINADO al equipo comercial antes de que el custodio
publique el primer cierre: enciende un valor cuota **simulado**, derivado de la
serie real del benchmark (beta 0,90 + ~1,5% anual de alfa), y con eso la página
se ve exactamente como en régimen — cotización del día, AUM con sparkline,
toggle Valor cuota ↔ Base 100, rendimientos, año calendario e indicadores de
riesgo.

```bash
FONDO_DEMO=1 npx next start          # o en el systemd unit: Environment=FONDO_DEMO=1
```

🚨 **SÓLO EN INSTANCIAS QUE NO ALCANCEN A UN INVERSOR.** La página no distingue
estos números de los reales —ése es el punto— así que quien la vea lee un track
record que el Fondo no tiene. En una instancia pública eso es publicar
rendimientos inventados de un fondo regulado por el BCU.

Por qué es un flag de entorno y no filas en la base (que es como se había hecho
en julio): apagarlo es **no setearlo**. No hay que acordarse de limpiar ninguna
tabla, no queda rastro simulado que alguien confunda con real más adelante, y no
puede filtrarse a un deploy sin que alguien lo escriba a mano. Además el demo
**sólo actúa si `fund_nav` está vacía**: en cuanto entra un cierre real manda el
dato real, aunque el flag haya quedado prendido.

Antes de una presentación, verificar qué va a mostrar la página sin levantar el
server:

```bash
npx tsx scripts/dev-tests/check-fondo-demo.ts               # como se ve hoy
FONDO_DEMO=1 npx tsx scripts/dev-tests/check-fondo-demo.ts  # con el demo prendido
```

⚠️ **El home server tiene Tailscale Funnel PRENDIDO** (verificado 2026-07-28):
`https://gestapp.tail75b274.ts.net` lo abre cualquiera con el link. Para una
demo interna hay que bajarlo a la tailnet —`tailscale funnel off` y
`tailscale serve https / http://127.0.0.1:8788`—, que deja el sitio accesible
sólo desde dispositivos de la tailnet. Con Funnel prendido, "no es público" es
falso.

### Cuando llegue el export real del administrador
Pedir niveles diarios de `ACWI` y `LEGATRUU` (o el 60/40 ya compuesto) en Excel/CSV.
Al cargarlos, poner `source='administrator'` y borrar antes lo del proxy:
`DELETE FROM fund_benchmark;`. No hay que tocar la UI — sólo cambia el origen del
dato y conviene revisar la nota de `BENCHMARK_PROXY` en `lib/fondo.ts`.

### Qué pasa cuando el fondo empiece a publicar valor cuota
`snapshotFromSeries` **acota** la serie del benchmark a la vida del fondo: la
tabla compara los dos sobre el mismo período y el gráfico no abre un eje de cinco
años para dibujar dos puntos de fondo. La historia larga se conserva en la tabla;
sólo se recorta al servir.

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
