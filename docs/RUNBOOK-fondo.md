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
      (`db/seeds/fondo-holdings.sql`, `as_of='2026-07-28'`, 8 tenencias del
      cliente + el residual `OTROS` 40%): las tenencias que hay cargadas allá
      también son simuladas
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
      ⚠️ El bloque **Exposición geográfica** NO sale de las tenencias ni de la
      base: los pesos por región están hardcodeados en
      `components/institucional/FondoGeografia.tsx` (`REGIONES`). Desde el
      3-ago-2026 son la **asignación objetivo de la estrategia** que pasó el
      equipo (46 / 24 / 22 / 5 / 3), no datos inventados — por eso el bloque
      volvió a la página. Como son objetivo y no una foto a una fecha, el pie no
      lleva fecha de corte y no envejece solo: **si el objetivo cambia, hay que
      editarlo a mano ahí.** Los países de cada bucket están en `PAIS_A_REGION`
      del mismo archivo, y cada punto del mapa sabe su país por
      `worldDotsCountries.ts` (lo genera `scripts/gen-dotmap-countries.mjs`, que
      aborta si el GeoJSON de upstream se movió).
- [ ] Parser del mail (Etapa 3, depende de un mail de muestra).
- [x] **Etapa 4 — benchmark** (2026-07-28): compuesto definido y serie cargable.
      **60% MSCI ACWI / 40% Bloomberg Global Aggregate** (tickers Bloomberg
      `ACWI` / `LEGATRUU`), confirmado con el equipo el día del lanzamiento.
      Serie reconstruida con **proxies ETF** — ver sección "Benchmark" más abajo.
      ⚠️ Desde el 3-ago-2026 la serie del benchmark **no se grafica sola**: se
      dibuja contra el fondo, no en su lugar (ver abajo). Se sigue cargando y
      verificando igual — es lo que el gráfico va a comparar el día que haya
      valor cuota.

## Qué muestra la sección Performance según el estado de los datos

El gráfico tiene un **selector de serie** a la izquierda (11-ago-2026): elige qué
se dibuja en la misma caja. Lo que cambia con el estado de los datos es qué
opciones ofrece y cuál viene elegida de fábrica.

| `fund_nav` | Opciones del selector | Cuál por defecto | Qué se ve |
| --- | --- | --- | --- |
| con filas | Valor cuota · Base 100 · Backtest | **Valor cuota** | El módulo completo: cotización, curva del fondo (+ benchmark en Base 100), tablas e indicadores. |
| vacía | Valor cuota · Backtest | **Backtest** | Cotización y tablas del Fondo en «—». En «Backtest», la simulación; en «Valor cuota», el aviso de **«Próximamente»** en el medio del marco. |
| vacía y sin el JSON del backtest | Valor cuota | Valor cuota | Igual que antes del 10-ago-2026: el aviso ocupando el marco entero. Es el fallback si el asset no carga. |

«Base 100» sólo aparece con serie del fondo: es una vista de ESA serie, no tiene
sentido sin ella.

⚠️ **El Fondo empieza a operar ANTES de que su valor cuota llegue a la página**
— una o dos semanas antes (confirmado por el cliente, 3-ago-2026). O sea que
existe una ventana en la que el Fondo está operando de verdad y la página sigue
mostrando el aviso. Toda la copy de ese estado está escrita para ser cierta
también ahí: el aviso dice «se publicará aquí en las próximas semanas» y no «en
cuanto el Fondo comience a operar», el pie de la tabla dice «pendiente de
publicación» y no «el fondo aún no registra rendimientos», y la respuesta
«¿Cómo sigo la evolución?» de la FAQ tampoco lo ata al arranque. **No volver a
atarlo**: en esa ventana la promesa queda desmentida por los hechos.

Corolario: «las próximas semanas» es copy con fecha de vencimiento. Si el
arranque se corre varios meses, hay que revisarla — el aviso se apaga solo
cuando entra la primera fila a `fund_nav`, pero nadie lo apaga si el plazo se
estira.

Decisión del cliente (3-ago-2026). Lo que se sacó es el **modo "sólo
benchmark"**: hasta ese día, sin valor cuota la página graficaba igual la serie
de la referencia, y su vista en USD la expresaba como una cuota hipotética de
1.000 → 1.300. Era la misma serie del compuesto 60/40 multiplicada por una
constante, y estaba rotulada como tal en cuatro lugares, pero en la página de un
fondo una curva que sube con el eje en USD se lee como el track record del
fondo. Por el mismo motivo la fila del benchmark tampoco entra a las tablas
mientras la del fondo esté vacía.

No hay flag que prender ni apagar: el interruptor es el dato. Con el primer
cierre real en `fund_nav`, `/api/fondo` pasa a `live`, la curva y el benchmark
aparecen solos y el aviso se va — sin tocar código ni volver a deployar. El
**modo demo** de acá abajo hace lo mismo, que es para lo que existe.

⚠️ Se resuelve **en el cliente**, no en el build: el sitio del fondo es HTML
estático y su render no consulta la base. El HTML publicado trae el aviso, y en
régimen la curva entra apenas responde `/api/fondo`.

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

### Se nombra siempre que esté en pantalla (11-ago-2026)
Toda línea de comparación se identifica: el nombre completo del compuesto va al
pie del módulo, junto a `BENCHMARK.aviso` —índice no gestionado, sin costos, no
invertible, y el Fondo es de gestión activa y no lo replica—. Es la convención
transversal a los tres regímenes que regulan esto (Form N-1A pide el índice
nombrado en prospecto e informe al accionista; el Q&A de ESMA lo exige en el
KIID cuando el fondo se mide contra un índice; GIPS obliga a describirlo, y si
no hay benchmark, a decir por qué; FINRA 2210 pide identificarlo y declarar las
diferencias materiales), y es lo que hace cualquier ficha: el peer más cercano,
el American Funds Global Balanced, publica el mismo 60/40 ACWI/Global Aggregate
con nombre completo en datos clave, leyenda y notas.

Hasta el 11-ago el párrafo existía pero colgaba de `hasBench`, que es
`live && …`: en pre-lanzamiento —cuando la única curva de la página es una
referencia— no se renderizaba. Ahora entra también con el backtest en pantalla.
**Lo que NO se movió es `BENCHMARK_PROXY.nota`**: describe cómo reconstruimos
con ETFs la serie de `fund_benchmark`, y la del backtest no la reconstruimos
nosotros. Sigue atada a la serie del Fondo.

En el gráfico la línea subordinada se llama **«Benchmark»** en las tres vistas
(`BENCHMARK.corto`), backtest incluido: es una sola caja que cambia de serie, y
un rótulo propio por vista —hasta el 11-ago decía «Referencia 60/40»— hace que
la misma línea parezca otra cosa según el selector. La composición no se pierde:
vive en la nota pegada a la tabla, que es donde se lee.

No hay fila «Benchmark» en la ficha técnica, y es a propósito: esa tabla tiene
fuente única declarada —cada fila señalable en un literal del Reglamento de
Gestión— y el compuesto no sale de ahí, sino del gestor.

### Cómo está armada la serie HOY (proxy ETF)
Los niveles de MSCI ACWI y del Bloomberg Global Aggregate son **datos
licenciados**: no hay fuente pública que los sirva (se verificaron Yahoo y Twelve
Data). Mientras el administrador no pase el export real, la serie se
**reconstruye con ETFs** a precios ajustados por dividendos (total return, que es
lo que miden los índices originales) y rebalanceo diario:

| Pata | Peso | ETF | Por qué |
|---|---|---|---|
| Renta variable | 60% | `ACWI` (iShares MSCI ACWI) | réplica directa del índice |
| Renta fija | 40% | `AGG` (iShares Core U.S. Aggregate) | todo el tramo |

El tramo de renta fija es el aproximado: **no existe** un ETF accesible que siga
al Global Aggregate sin cobertura de moneda (BNDX/BNDW/AGGU están cubiertos, y la
cobertura es justo lo que separa a LEGATRUU de su gemelo cubierto).

> **Cambio del 5-ago-2026.** Hasta esa fecha el tramo se partía 45/55 entre `AGG`
> y `BWX` (SPDR Bloomberg Intl. Treasury, sin cobertura), imitando la partición
> por moneda del índice real (~45% USD / ~55% resto). Se pasó a AGG solo porque
> la pasada de contenido del cliente dejó la nota al pie de la página nombrando
> sólo ACWI y AGG, y una nota que enumera dos ETFs sobre una serie hecha con tres
> describe mal el cálculo. Se eligió alinear el cálculo al texto.
>
> **Qué cuesta:** sin `BWX`, el 40% de renta fija queda 100% en deuda de EE.UU. y
> en dólares — se va justo lo que hace *global* al Global Aggregate. Y no es
> neutro en el número: sobre la ventana de 5 años, el compuesto pasó de **30,03%
> acumulado / 5,39% anualizado** a **38,81% / 6,78%** (el dólar fuerte de esos
> años castigó a la deuda no-USD). O sea que el benchmark contra el que se va a
> medir el Fondo quedó ~1,4 puntos anuales más alto.
>
> Para revertirlo: reponer `BWX` en `BENCHMARK_PROXY` (lib/fondo.ts) con los
> pesos `0.4 * 0.45` / `0.4 * 0.55`, correr de nuevo el script y actualizar la
> nota de la página.

**Al cambiar los pesos hay que regenerar la serie:** `BENCHMARK_PROXY` sólo
gobierna cálculos nuevos, no las filas ya cargadas en `fund_benchmark`. Correr
`npx tsx scripts/fondo-benchmark-proxy.ts` y reemplazar el seed, o el gráfico
sigue mostrando la serie vieja.

La aproximación es buena, pero **no es el valor oficial** — y el pie de la página
lo dice (`BENCHMARK_PROXY.nota`).

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

## Backtest de la estrategia (10-ago-2026)

Una de las series que dibuja el gráfico del módulo de performance: la estrategia
de hoy aplicada hacia atrás sobre precios históricos, en base 100, contra el
mismo 60/40 de referencia. Pedido del responsable del fondo, con el encuadre que
él mismo dictó: *«esto es lo que hubiera resultado, sólo de forma ilustrativa»*.

**Convive con el valor cuota, no lo reemplaza** (decisión del 11-ago-2026): es
UN gráfico con un selector de serie a la izquierda, no dos gráficos. Mientras no
haya valor cuota el selector abre en «Backtest»; el día que lo haya, abre en
«Valor cuota» y el backtest queda como la otra opción.

**No es una vuelta atrás de la decisión del 3-ago** (el modo «sólo benchmark»
que se sacó, más arriba). Lo que hace admisible a este bloque son cuatro reglas,
documentadas en `components/institucional/FondoBacktest.tsx`, y hay que
preservar las cuatro:

1. eje en **índice base 100**, nunca en USD ni en «valor cuota» — ése fue el
   error exacto de la reversión anterior;
2. línea en tono subordinado, **nunca** el navy con sombra del valor cuota;
3. la palabra **«simulada» dentro de la leyenda del gráfico** — es lo único del
   encuadre que sobrevive a una captura de pantalla;
4. la frase de encuadre en **cuerpo de lectura**, nunca en un pie de 12px, y
   **entre el selector de serie y el marco**: aparece y desaparece con la opción
   elegida, que es lo que la ata a la serie que se está mirando ahora que la
   misma caja muestra dos. (Estuvo adentro del marco el 10-ago y se sacó al día
   siguiente: leía como una caja dentro de otra y empujaba la curva.)

### Actualizar la serie
El cliente manda un Excel con dos hojas (`Resumen`, `Serie Diaria`; columnas
`Fecha`, `Portafolio`, `BM_6040`).

```bash
npx tsx scripts/fondo-backtest.mts ~/Downloads/backtest_Portafolio_<período>.xlsx
```

Escribe `public/fondo/backtest-estrategia.json` (columnar, ~33 KB; Apache lo
sirve comprimido a ~8). Valida la forma de la serie —orden, duplicados, huecos
de más de 5 días, base 100— y **corta el build si algo no cierra**. Después
imprime la tabla año a año: contrastarla a mano contra la hoja `Resumen`, que es
lo único que el script no puede verificar.

La página lo pide por `fetch` en diferido y sólo en pre-lanzamiento, así que
`scripts/build-fondo.mts` lo copia **a mano** al deploy: el barrido de assets
sale del HTML y de los CSS, y esto no aparece en ninguno de los dos. Hay guarda
—`verificarBacktest()`— que corta el build si el archivo no llegó o si ningún
chunk pide esa ruta (o sea, si alguien renombró `BACKTEST_URL`).

### Pendientes antes de publicarlo
- ⚠️ **¿La serie es neta de la comisión del Fondo?** (hasta 1,5% anual, IVA
  incluido). El Excel no lo dice. Si fuera bruta, no es homogénea contra el
  valor cuota futuro —que sí es neto— y hay que decirlo en el aviso al pie.
  Mientras no esté confirmado, la página **no afirma ni una cosa ni la otra**.
- ⚠️ **¿La columna `BM_6040` es el benchmark del mandato?** Desde el 11-ago la
  página la nombra —«el benchmark es el compuesto 60/40 del Fondo (60% MSCI
  ACWI · 40% Bloomberg Global Aggregate)»—, pero el Excel no dice de qué está
  hecha. El punto a chequear es el tramo de acciones: la definición del
  benchmark pasó de MSCI **World** a **ACWI** recién en jul-2026, así que un
  Excel anterior podría estar corriendo contra World. Si fuera así hay que
  corregir el **nombre** (nota de `FondoBacktest` y pie de `FondoPerformance`),
  no el cálculo.
- ⚠️ **Revisión legal.** Es rendimiento simulado de un fondo autorizado por el
  BCU que todavía no comenzó a operar. Que lo mire quien hizo la revisión del
  3-ago antes de que salga a producción.
- La serie del archivo de agosto termina el **1-jul-2026**, no «hasta hoy». El
  «en lo que va del año» queda con ese corte, y así está rotulado.

### El día del lanzamiento
**No hay que tocar nada.** Con la primera fila en `fund_nav`, el selector suma
«Base 100», pasa a abrir en «Valor cuota» y el aviso de «Próximamente» deja de
renderizarse solo. El backtest queda como la otra opción del selector, que es
para lo que se pidió el control.

Lo único que conviene revisar ese día es si la simulación sigue aportando algo
al lado de una serie real, y que la respuesta de la FAQ y el copy de la sección
sigan siendo ciertos con las dos series en pantalla.

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
