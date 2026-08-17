# Panel del fondo para Adrián + salida de Cloudflare

Plan escrito el 2026-08-16. Reemplaza la decisión diferida del 2026-08-13
("hornear el JSON en el build"), que se cae por la razón que está en §1.

Lo que resuelve, en una línea: **que Adrián cargue tenencias y documentos en el
panel y eso aparezca en `bengocheainversiones.com` sin que nadie rebuildee ni
suba nada por FTP** — y, de paso, que Cloudflare deje de estar en el medio.

---

## 1. Por qué cambia el plan anterior

El 13-ago se aprobó sacar Cloudflare del fondo horneando los datos como JSON en
el build. Ese plan asumía que el ciclo real de los datos ya era "editar un
archivo del repo → publicar", porque las tenencias las empujaba un seed SQL a
mano.

Con un panel eso deja de ser cierto. Si los datos viajan en el build, publicar
pasa a ser *Emiliano rebuildeando y subiendo* cada vez que Adrián toca algo —
exactamente el modo de falla que hizo diferir la decisión. Un panel cuyo botón
"Guardar" no publica nada no es un panel: es un formulario que genera trabajo.

Así que la pregunta ya no es "¿worker o JSON horneado?" sino **qué lee el sitio
vivo, y cómo llega ahí lo que Adrián guarda**.

## 2. El panel ya existe

Conviene tenerlo claro antes de estimar: `/admin` está construido —login propio,
TOTP obligatorio, permisos por sección— y corre como app Node normal contra
SQLite + filesystem (`lib/homeBindings.ts`, `docs/RUNBOOK-home.md`). *Dónde* se
sirve en producción es la pregunta abierta del plan (§9); no cambia nada del
diseño, sólo dónde van las env y las migraciones. La sección Fondo
(`app/admin/(panel)/fondo`, `components/admin/FondoAdmin.tsx`) tenía seis
pestañas al escribir esto:

| Pestaña | Ruta | Qué hace |
|---|---|---|
| Estado | `/api/admin/panel/fondo/status` | pre-launch / live, últimas cargas |
| Valor cuota | `…/nav` | carga diaria, con bandas de cordura |
| Backfill | `…/backfill` | carga en lote |
| Corregir | `…/override` | pisar un día ya cargado, auditado |
| **Tenencias** | `…/holdings` | Σ pesos ≈ 10000 bps, clase de enum cerrado, upsert atómico |
| **Documentos** | `…/documentos` | PDFs con validación de magic bytes |

Las dos que pediste —tenencias y documentos— **ya están hechas**, con validación,
escritura atómica (`db.batch`) y doble auditoría (`fund_audit` + `admin_audit`).

Lo que falta no es el panel. Es que lo que el panel escribe llegue al sitio.

## 3. El problema real: dos bases

```
HOY

  Adrián ──✗ (no tiene cuenta, y aunque la tuviera…)

  panel ─────────> SQLite del panel ──> /api/fondo de Next ──> nadie lo mira
                                                                (sólo la preview)

  seed SQL a mano ──> D1 «bng-fondo» (CF) ──> worker ──> api.php (proxy 240 líneas)
                                                            ──> fetch('/api/fondo')
                                                                ──> useFondo ──> la página
```

Son dos bases distintas. Por eso en agosto se publicaron el Reglamento y la
autorización del BCU en el panel y el sitio siguió mostrando "Solicitar": el
panel escribió en la suya y el sitio leyó la otra.

```
OBJETIVO

  Adrián ──> panel ──────────> SQLite del panel        ← única fuente de verdad
                                      │
                                      │ botón «Publicar»
                                      ▼
                            respuestaFondo(db)          ← YA ESCRITO (lib/fondoApi.ts)
                                      │
                                      │ HTTPS POST + HMAC
                                      ▼
                            publicar.php (cPanel)       ← ~70 líneas, escritura atómica
                                      │
                                      ▼
                            publicado/fondo.json        ← archivo estático, lo sirve Apache
                                      │
                                      ▼
                            useFondo ──> la página
```

Cloudflare desaparece entero: la cuenta, el worker, la D1, y 240 líneas de PHP
que se reemplazan por 70.

## 4. Por qué esta forma y no otra

**Por qué el generador ya está escrito.** `lib/fondoApi.ts` es código compartido
entre las rutas de Next y el worker de Cloudflare — se hizo así justamente para
que no divergieran. En el panel, `respuestaFondo(db)` contra la SQLite local
produce **exactamente el mismo JSON** que hoy produce el worker contra D1. No hay
que escribir un serializador, ni reimplementar los rendimientos, ni mantener dos
versiones de la lógica financiera. Es la misma función con otro `db`.

**Por qué push y no pull.** Un cron en cPanel que vaya a buscar el JSON al panel
evitaría tener un endpoint de escritura en el sitio público. Pero le saca a
Adrián el lazo de realimentación: guarda, y no sabe si salió. Con push, el botón
dice "publicado a las 15:42" o dice qué falló. La superficie de riesgo se acota
con HMAC + ventana de tiempo + dos nombres de archivo fijos (§6.2). Si el hosting
complica el POST entrante, el fallback es pull con cron — mismo publicador.

**Por qué archivo estático y no PHP por request.** Apache sirve el JSON sin
levantar un proceso PHP. Se cae el rate limit, se cae la caché en disco, se cae
el timeout de 8 s contra un upstream: no hay upstream. El único PHP que queda
corre cuando publica Adrián, no cuando entra un visitante.

**Modo de falla, que es mejor que el de hoy.** Si el panel está caído, el sitio
sigue sirviendo el último JSON publicado indefinidamente; lo único que se rompe
es *publicar*. Hoy es al revés: si Cloudflare falla, `api.php` aguanta con la
copia vencida y después la página se queda sin datos.

---

## 5. Decisiones previas (bloquean el arranque)

### 5.1 Exposición geográfica — RESUELTO (2026-08-16)

**Adrián la va a cambiar cada tanto, y lo que carga es el OBJETIVO DEL MANDATO**
—lo que la estrategia busca sostener—, no la exposición efectiva medida a una
fecha. Consecuencias, que es lo que hace que esta decisión sea barata:

- **el pie no cambia.** Sigue diciendo "Asignación objetivo de la estrategia — la
  exposición efectiva varía con el mercado, y la vigente te la informa un asesor",
  que es la redacción que salió de la revisión legal del 3-ago-2026. Si en algún
  momento se publicara la exposición *efectiva*, esa última cláusula deja de ser
  cierta y hay que volver a legales;
- **no lleva fecha de corte** y el bloque sigue sin envejecer;
- **no aplica el rezago** anti front-running de las tenencias: un objetivo no es
  información de posición.

**Descartado: derivar la geografía de las tenencias.** Era mi recomendación
inicial y no sobrevive a mirar el snapshot. Dos razones independientes:

```
 750 bps  RV     Jupiter Merian World Equity Fund
 750 bps  RV     Thornburg Equity Income Builder Fund
 750 bps  RV     Invesco QQQ Trust Series 1
 …
4500 bps  OTROS  Otros
```

el 45% de la cartera es una fila "Otros" sin región posible, y las líneas
nombradas son **fondos, no activos** — un "World Equity Fund" no tiene región,
está diversificado por dentro. No hay `region` que agregarle a `fund_holdings_item`.

#### Cómo se modela: taxonomía en código, pesos en datos

La distinción que hace chico el cambio:

| | Dónde vive | Por qué |
|---|---|---|
| Las 5 regiones (`key`, `label`, `sinMapa`) y el mapa país→región (`PAIS_A_REGION`) | **código** | Agregar una región exige además clasificar los países que le corresponden. Es una taxonomía, no un número; que sea un cambio de código es correcto. |
| Los 5 pesos | **datos** (panel) | Es lo único que se mueve "cada tanto". |

Esto es lo que mantiene `PAIS_A_REGION` y `GRUPOS` estáticos a nivel de módulo en
`FondoGeografia.tsx` — `GRUPOS` agrupa los puntos del mapa por región y depende
de `key`/`sinMapa`, **no de `peso`**. Sólo `MAX_PESO` y `COLOR_BY_REGION` pasan a
`useMemo` sobre el dato.

#### El costo real: el bloque pasa a depender del fetch

Hoy pinta instantáneamente porque los pesos son una constante. Al venir del
snapshot, hay un hueco hasta que resuelve. No es un pedido de red nuevo —el
`useFondo` cachea la promesa a nivel de módulo y la página ya lo hace—, pero sí
un estado de carga que antes no existía.

La salida es barata y reusa lo que ya está: **el mapa se dibuja igual desde el
primer frame** (la forma es taxonomía, que es estática) en el tono neutro de "sin
exposición", y transiciona a los colores por región cuando llega el dato — con la
misma animación de alfas de 240 ms que el bloque ya corre en `hover`. Los números
de la leyenda aparecen con el dato. Es además el mismo patrón que `FondoTenencias`,
que está en la misma página y ya carga así.

### 5.2 Qué carga Adrián, exactamente

El plan asume **tenencias + geografía + documentos + valor cuota**, con cadencias
muy distintas:

| Dato | Cadencia | Estado |
|---|---|---|
| Valor cuota | diario (post-lanzamiento) | pestaña hecha |
| Tenencias | mensual / trimestral | pestaña hecha |
| Documentos | cuando salen | pestaña hecha |
| Geografía | "cada tanto" | **a construir** (§5.1) |

El valor cuota es el que decide el dimensionado — es el único diario, y es lo que
hace que el paso de publicación tenga que ser de un clic y no de un deploy.

**Se asume que Adrián lo carga a mano** hasta que llegue la ingesta automática
(«en un futuro será automático, pero no te preocupes por eso ahora», 2026-08-16).
Si esa suposición es falsa, el "Publicar" pasa a ser semanal en la práctica y la
Fase 1 se puede recortar.

### 5.3 `HOLDINGS_LAG_DAYS` está en 0 — y es deliberado

`lib/fondoStore.ts:32`. Lo había anotado como una decisión pendiente; **no lo
es**: el código ya la explica y le pone condición de reversión. El rezago
protege a un fondo EN MARCHA (que nadie opere contra las posiciones que el Fondo
está armando o deshaciendo), y el Fondo todavía no comenzó a funcionar — el
inicio se comunica al BCU con 10 días hábiles de anticipación, art. 74 RNMV.
Sin nada contra qué operar, la cartera publicada se ve el mismo día.

Lo que sí queda pendiente es **restaurarlo a 30 cuando el Fondo empiece a
operar**, junto con la primera fila real de `fund_nav`. No aplica a la
geografía: un objetivo del mandato no es información de posición.

---

## 6. Las fases

### Fase 0 — Reconciliar las dos bases ⚠️

**Es el paso peligroso del plan, pero NO es un prerrequisito para empezar a
construir** (corregido 2026-08-16: lo había puesto como bloqueante y no lo es).
El gate liga en el momento del **primer publish contra producción**, no en el
momento de escribir código. Todo el desarrollo va contra la base local de la Mac
(`data/bengochea.sqlite3` + el dev en `https://localhost:3000`), que ya tiene el
esquema del panel, dos usuarios y datos del fondo.

**El riesgo, en una frase:** que la base contra la que se aprieta Publicar la
primera vez tenga datos que no son reales. Publicar eso sería poner rendimientos
inventados de un fondo regulado por el BCU en el sitio público.

> ⚠️ **Corrección 2026-08-17.** Esta fase estaba escrita alrededor de una serie
> simulada de 666 cierres que —según una nota del 22-jul— vivía en la SQLite de
> `gestapp`. **El usuario confirmó que gestapp no tiene ningún papel en esta
> app**, así que ese escenario queda sin objeto. La *regla* sigue en pie, sólo
> que ahora apunta a la base de producción del panel, sea cual sea.

> **La base LOCAL está limpia** (verificado 2026-08-16): `fund_nav` en 0 filas
> ⇒ pre-lanzamiento honesto, igual que el sitio vivo; `fund_holdings_snapshot`
> con dos cortes reales (`2026-08-05` y `2026-08-13`, `source='admin'`, 9 líneas
> cada uno) que coinciden con lo que sirve D1. Si la base de producción sale de
> ésta, la fase **ya está hecha**.

1. **Identificar contra qué base va a publicar el panel en producción.** Es la
   pregunta abierta del plan (§9) y sin ella los pasos de abajo no tienen sujeto.
2. Mirar qué tiene: `SELECT COUNT(*), MIN(dia), MAX(dia) FROM fund_nav;` y lo
   mismo para `fund_benchmark`, `fund_holdings_snapshot`, `fund_holdings_item`.
   Cualquier fila simulada estaría marcada en la columna `nota`.
3. **Borrar lo que no sea real.** El `DELETE` está en `docs/RUNBOOK-fondo.md`.
   Sin filas, la página vuelve sola a "pre-lanzamiento honesto", que es lo que
   muestra el sitio vivo hoy.
4. **Traer lo real desde D1** mientras el worker siga vivo. Lo único con
   contenido en `bng-fondo` es `fund_holdings_snapshot`/`fund_holdings_item`
   (9 líneas, `asOf 2026-08-13`, el 45% en la fila "Otros") y `fund_benchmark`.
   Exportar con `wrangler d1 execute bng-fondo --remote --command "SELECT …" --json`.
5. **Verificación que cierra la fase:** `GET /api/fondo` desde esa SQLite y desde
   el sitio vivo tienen que devolver el mismo cuerpo. Es la prueba de que las dos
   rutas producen los mismos números. Si no coinciden, no se sigue.

#### Esta verificación ya se corrió una vez, y pasó

Local (Next + SQLite) contra el sitio vivo (`api.php` → worker → D1), 2026-08-16:

```
local (SQLite): 2232 bytes   |   vivo (D1): 2225 bytes

difieren SÓLO en:  benchCalendar, benchReturns
idénticos en:      status, asOf, latest, returns, calendar, stats, series, holdings
```

**Es el resultado que valida el plan**, en lo que el plan necesitaba: misma
estructura, mismas tenencias, mismo `status: "pre-launch"`. `respuestaFondo(db)`
no se entera de qué base tiene abajo, que era lo que había que demostrar.

> ⚠️ **CORRECCIÓN 2026-08-17.** Acá decía que la diferencia del benchmark era
> «staleness de datos, no divergencia de lógica», atribuyéndola a que la base
> local termina el 2026-07-28 y D1 el 2026-08-05. **La segunda mitad es cierta;
> la primera no.** Medido: de las 1255 fechas compartidas, **1249 tienen valores
> distintos**. No es una serie vieja y una nueva — son DOS SERIES DISTINTAS. Ver
> § 9bis.

Traducción operativa: la Fase 0 se reduce a **verificar que la base no tenga
datos inventados**. El motor da lo mismo mire la base que mire — pero los DATOS
del benchmark no son los mismos en las dos bases (§ 9bis), y eso es un problema
aparte que no bloquea publicar.

Sin esto, el resto del plan publica basura muy eficientemente.

### Fase 1a — El publicador y el receptor (en sombra) — ✅ CÓDIGO HECHO 2026-08-17

Se construye todo, pero **el sitio sigue leyendo el worker**. Lo publicado va a
un archivo que todavía nadie lee.

**En el panel (Next):**

- `lib/fondoPublicar.ts` — **nuevo**. Puro, sin I/O de red: arma el sobre
  (`{ v, generado, fondo, documentos }`) y lo firma con HMAC-SHA256 sobre el
  cuerpo canónico. Puro para que sea testeable con `tsx`, mismo criterio que
  `lib/panelCrypto.ts`.
- `app/api/admin/panel/fondo/publicar/route.ts` — **nuevo**.
  `requirePanelSession(req, "fondo")` en la primera línea; llama a
  `respuestaFondo(db)` y `respuestaDocumentos(db)`, firma, hace el POST, y
  escribe `admin_audit` **pase o falle** (una publicación fallida es información).
- PDFs: un POST por documento cuyo `content_len` difiera del publicado, leyendo
  del `FsBucket` con `getDocsBucket()`. No se re-suben los que no cambiaron.
- Estado de publicación: tabla `fondo_publicado` (`version`, `hash`, `at`,
  `by`) — migración nueva en `db/migrations/`. Sirve para lo de abajo.
- `components/admin/FondoAdmin.tsx` — pestaña **Publicar**: qué cambió desde la
  última publicación, el botón, y el resultado con hora. **Y un aviso persistente
  en las otras pestañas cuando hay cambios sin publicar** — sin eso, el modo de
  falla más probable de todo el sistema es que Adrián guarde, se vaya, y nadie
  se entere de que el sitio no se movió.

**La geografía (§5.1), que entra por el mismo canal — ✅ HECHA el 2026-08-16**
(sin commitear; verificación al pie de esta sección):

- Migración: fila única `geo_target` en una tabla de configuración del fondo, con
  los 5 pesos como JSON validado. **Un solo documento y no cinco filas** porque
  los pesos siempre se mueven juntos —tienen que sumar 100— y no hay consulta que
  quiera una región sola; una tabla de 5 filas cuyo único `UPDATE` válido es
  "borrar las 5 e insertar 5" es la forma equivocada de decir eso.
- `lib/panelSchemas.ts` — `GeoTargetSchema`: las 5 claves fijas del enum, enteros,
  **Σ = 100 exacto**. Mismo criterio que `HoldingsSchema` con sus 10000 bps.
- `app/api/admin/panel/fondo/geo/route.ts` — **nuevo**, calcado de `…/holdings`:
  `requirePanelSession(req, "fondo")`, upsert + `panelAuditStmt` en un `db.batch`.
- `components/admin/FondoAdmin.tsx` — pestaña **Geografía**: 5 campos y el total
  vivo al lado, en rojo mientras no dé 100.
- `lib/fondo.ts` — `FundSnapshot` gana `geo`, y `getFundSnapshot` lo lee. Con eso
  viaja solo en el JSON publicado: `lib/fondoApi.ts` no se toca.
- `components/institucional/FondoGeografia.tsx` — `REGIONES` se parte en dos
  (taxonomía const + pesos del snapshot), `MAX_PESO`/`COLOR_BY_REGION` pasan a
  `useMemo`, y entra `useFondo`. `PAIS_A_REGION` y `GRUPOS` **no se tocan**.
  El `aria-label` del mapa se arma con los pesos vivos.
- **Fallback explícito**: sin dato en la base, el bloque usa los pesos actuales
  (46/24/22/5/3) como línea de base, igual que `fondoDocsEstaticos` con los PDFs.
  Un fondo sin cargar no deja un agujero en la página.

#### Cómo quedó, y qué se verificó (2026-08-16)

Archivos: `lib/fondoGeo.ts`, `lib/fondoGeo.test.ts`,
`db/migrations/2026-08-16-fondo-geo.sql`,
`app/api/admin/panel/fondo/geo/route.ts` (nuevos) · `db/schema.sql`,
`lib/panelSchemas.ts`, `lib/fondoStore.ts`, `lib/fondo.ts`,
`components/admin/FondoAdmin.tsx`, `components/institucional/FondoGeografia.tsx`
(tocados).

Dos cosas que aparecieron al implementar y no estaban previstas:

1. **`GRUPOS` sí dependía de los pesos**, al revés de lo que dice §5.1: los
   PUNTOS son taxonomía, pero cada grupo llevaba además su `color`, que sale de
   los pesos. Se le sacó el color al grupo y se resuelve al pintar. Queda mejor
   que antes: el precómputo caro (2.554 puntos clasificados) sigue a nivel de
   módulo y aun así se repinta con pesos nuevos sin rehacerlo.
2. **La transición de color no era opcional.** La línea de base viaja en el
   deploy y queda vieja apenas se publica otra asignación, así que hasta el
   próximo build ese cambio ocurre **en cada carga**. Sin tween sería un salto
   de color en un frame, todas las veces. Se resolvió animando la POSICIÓN EN LA
   RAMPA (un escalar por grupo) sobre el rAF que ya existía para las opacidades
   del hover — mismo bucle, mismos 240 ms, mismo respeto por `reduced-motion`.

Verificado: `tsc` limpio · `eslint` limpio en los 8 archivos · **64/64 tests**
(10 nuevos) · y el bloque medido en la página real con Chrome headless, no sólo
en el DOM sino leyendo los píxeles del canvas:

| | |
|---|---|
| Con fila `{NA:30, EM:35, EU:20, AD:10, OT:5}` | leyenda `01 EM 35% · 02 NA 30% · …` (reordenó), y el canvas pinta 4 tonos que coinciden con los de la leyenda + el neutro de "sin exposición". `OT` no se pinta, que es lo correcto. |
| Sin fila | vuelve exacto a `46/24/22/5/3` en el orden NA·EM·EU·AD·OT — idéntico a antes del cambio. Además el `style` inline queda con el formato del SERVER, o sea que el cliente no tocó el DOM: **cero flash en el caso común**. |
| Valor corrupto (suma 194 / texto no-JSON) | `geo: null`, 200, y las tenencias intactas. Degrada a la línea de base sin llevarse el snapshot. |
| Ruta del panel sin sesión | `GET → 401 sin_sesion`, `POST → 403 forbidden`, cero escrituras. |

**Pendiente de despliegue** (no es código): aplicar
`db/migrations/2026-08-16-fondo-geo.sql` a la SQLite de producción del panel. La D1 de
Cloudflare **no la necesita** — `readGeoTarget` está envuelto en un `.catch`
justamente para eso, así que el sitio vivo sigue mostrando la línea de base
hasta que se apague el worker en la Fase 3. Y crear la cuenta de Adrián
(`editor`, perms = `fondo`).

**En cPanel:**

- `deploy/cpanel/publicar.php` — **nuevo**, ~70 líneas. Sólo POST. Valida el HMAC
  con `hash_equals` (timing-safe), rechaza timestamps de más de 5 minutos
  (anti-replay), tope de tamaño, valida que el JSON parsee y traiga las claves
  esperadas. Escritura atómica `tmp` + `rename()`. **Los nombres de archivo son
  fijos y no se derivan del payload** — el tipo de documento se valida contra la
  misma lista blanca cerrada que ya inyecta el build (`__TIPOS_DOC__`). El
  secreto vive **fuera de `public_html`** (`../.publicar-secret`, chmod 600), no
  en el PHP.

**En el build (`scripts/build-fondo.mts`):**

- Regla nueva del `.htaccess`, con la propiedad de que **un deploy no puede pisar
  lo publicado**:

  ```
  publicado/       ← lo escribe SÓLO publicar.php; nunca está en dist/
  _seed/           ← lo escribe SÓLO el build; la línea de base
  ```

  `/datos/fondo.json` se resuelve con `RewriteCond %{REQUEST_FILENAME} !-f`:
  sirve `publicado/fondo.json` si existe, y si no `_seed/fondo.json`. Lo mismo
  para los PDFs contra `lib/fondoDocsEstaticos.ts`. Así un deploy de UI nunca
  borra los datos de Adrián, y un deploy limpio nunca queda sin datos — sin que
  eso dependa de que alguien se acuerde de excluir una carpeta al subir.
- El `Cache-Control` del JSON: `public, max-age=0, must-revalidate`. Es el mismo
  razonamiento que ya está escrito en `lib/fondoApi.ts:54-61` — con `max-age`
  el navegador servía su copia y el dato nuevo no aparecía al recargar, lo cual
  es indistinguible de un bug.
- Un verificador más en `verificar()`: que `_seed/fondo.json` exista y parsee.

**Verificación de la fase:** publicar desde el panel y comprobar por `curl` que
`publicado/fondo.json` en el sitio vivo es idéntico al cuerpo de `/api/fondo` del
worker. Con eso, la conmutación de la Fase 2 es un cambio de una línea con
resultado ya conocido.

*Nota: la CSP no cambia. La página ya hace `fetch` same-origin y `connect-src`
es `'self'`.*

#### Cómo quedó, y qué se verificó (2026-08-17) — ✅ CÓDIGO HECHO

Nuevos: `lib/fondoPublicar.ts`, `lib/fondoPublicar.test.ts`,
`app/api/admin/panel/fondo/publicar/route.ts`, `deploy/cpanel/publicar.php`.
Tocados: `lib/fondoStore.ts` (helpers genéricos de `fund_config`),
`components/admin/FondoAdmin.tsx`, `scripts/build-fondo.mts`,
`docs/RUNBOOK-panel.md`.

**Sin migración nueva**: el registro de publicación es una fila `publicado` en
el `fund_config` que ya creó 1b. Y **el "¿hay cambios sin publicar?" se resuelve
por comparación de contenido**, no con una marca de sucio en cada camino de
escritura: una marca hay que acordarse de ponerla en cada ruta nueva, y el día
que alguien la olvide el panel diría "todo publicado" cuando no lo está.

Tres cosas que aparecieron al implementar:

1. **Todo el copy de éxito del panel mentía.** Seis mensajes decían "publicado
   en el sitio" / "subido y publicado" — cierto con el puente viejo (worker + D1
   en vivo), falso ahora. Reescritos a "guardado. Falta publicarlo". Es el mismo
   riesgo que el aviso de cambios pendientes, pero adentro de la pantalla donde
   se acaba de guardar.
2. **Los PDF se mandan ANTES que `documentos.json`.** Al revés habría una
   ventana de segundos con el índice ofreciendo descargas cuyos archivos todavía
   no llegaron. En este orden no hay ventana mala: un PDF que nadie referencia
   no molesta a nadie.
3. **`SetEnvIf Request_URI` no sirve para `/datos/`** (medido con Apache 2.4.66,
   no deducido). Esas URLs llegan por un rewrite interno, y cuando corren los
   `SetEnvIf` el `Request_URI` **ya es el reescrito** — la condición sobre
   `^/datos/` no matcheaba nunca y el JSON salía con `max-age=3600` en vez de
   revalidar. O sea: Adrián publicaba, recargaba, y veía el dato viejo hasta una
   hora. Se resolvió con `<FilesMatch>`, que mira el nombre del archivo
   **servido** y es el mismo por los dos caminos.

Verificado: `tsc` limpio · `eslint` limpio · **76/76 tests** (12 nuevos) ·
`npm run fondo:build` verde.

- **El acuerdo TS↔PHP, como test**: el HMAC que calcula el panel es byte a byte
  el que verifica `publicar.php`. Son dos lenguajes y una cadena canónica
  escrita a mano en cada lado — la clase de acuerdo que se rompe en silencio y
  aparece como un `403 firma` sin saber de qué lado está el error.
- **`publicar.php` corriendo de verdad** (PHP 8.5 local, hosting simulado con el
  secreto fuera de `public_html`): **16/16**. Camino feliz de los tres
  artefactos, y rechazo de firma inválida (403), timestamp viejo **y del
  futuro** (408), artefacto desconocido (400), tipo fuera del enum (400),
  path traversal en el tipo (400), JSON que no parsea o sin la clave esperada
  (422), PDF sin magic bytes (422), cuerpo vacío (413), GET (405), sin
  cabeceras (400) y sin secreto configurado (503, fail-closed). Cero `.tmp`
  huérfanos y nada escrito fuera de `publicado/`.
- **El `.htaccess` contra Apache real**: sin publicar sirve `_seed/`; apenas
  existe `publicado/fondo.json` gana ése; el PDF publicado gana sobre el del
  deploy; `/datos/otro.json` da 404. Cabeceras finales: JSON `max-age=0,
  must-revalidate`, PDF `max-age=3600`, HTML sin cambios.

**Pendiente, y es de infraestructura** (los tres pasos están en
`docs/RUNBOOK-panel.md` § "Guardar no publica"): las env `FONDO_PUBLISH_URL` /
`FONDO_PUBLISH_SECRET` en el server del panel, el `.publicar-secret` fuera de `public_html`
en el hosting, y subir `dist/fondo-cpanel/`. Hasta que estén, el panel muestra
"el publicador no está configurado" y no intenta nada.

**Lo único que no se pudo ejercitar en vivo** es el POST del panel al hosting de
punta a punta, porque exige esas env en el server del usuario y no se toca su
dev. Las dos mitades del puente sí están probadas por separado —la firma contra
el PHP real, y el PHP real contra todos los casos— así que lo que queda sin
cubrir es el `fetch`, que son cuatro líneas.

### Fase 2 — El sitio lee el JSON — ✅ HECHA 2026-08-17

- `lib/useFondo.ts:20` — el `fetch("/api/fondo")` pasa a resolverse por flag de
  build: `/datos/fondo.json` en el deploy estático, `/api/fondo` en el dev y en
  el panel (ahí las rutas de Next siguen andando contra la base local, que es lo
  que hace que la preview siga sirviendo). Es **el único punto** donde la página
  toma el snapshot — el hook cachea la promesa a nivel de módulo, así que no hay
  otro `fetch` que buscar.
- `components/institucional/FondoDocumentos.tsx:86,112` — igual, para la lista y
  para el href de descarga.
- `api.php` **queda en su lugar, sin uso**, como ventana de rollback. Volver
  atrás es revertir esas dos líneas y rebuildear.

**Verificación:** cargar la página, confirmar que los números son los mismos que
antes de la conmutación, y que la pestaña Red no muestra ninguna llamada a
`api.php` ni a `workers.dev`.

#### Cómo quedó, y qué se verificó (2026-08-17) — ✅ HECHA

Tocados: `lib/sitios.ts`, `lib/useFondo.ts`,
`components/institucional/FondoDocumentos.tsx`, `scripts/build-fondo.mts`.
`api.php` **queda en su lugar, sin uso**, como ventana de rollback.

**El flag pasó a `NEXT_PUBLIC_FONDO_STANDALONE`.** Antes era `FONDO_STANDALONE`
a secas, con un comentario que decía que deliberadamente no era público «porque
no lo necesita ningún componente de cliente». Eso dejó de ser cierto: quien
elige el origen de los datos es `useFondo`, que corre en el browser. Se movió el
flag existente en vez de agregar un segundo — son la misma pregunta y dos
nombres para una cosa se desincronizan. Un solo lugar lo leía por `process.env`,
así que el rename fue seguro.

**El hallazgo que obligó a rehacer una parte.** El primer intento importaba
`FONDO_STANDALONE` desde `lib/sitios`, y el build falló contra su propio
verificador: **el bundler no propaga la constante entre chunks**, así que el
ternario `ESTATICO ? "/datos/fondo.json" : "/api/fondo"` quedaba con las DOS
ramas. Eso no rompe nada en runtime —el valor es correcto— pero significa que
**el bundle sale idéntico esté el flag prendido o apagado**, y entonces no hay
nada que verificar. Leyendo `process.env.NEXT_PUBLIC_…` directo en `useFondo.ts`
Next lo inlinea ahí mismo, el minificador se come la rama muerta, y el origen
horneado pasa a ser comprobable. Es una duplicación deliberada del flag, y está
comentada como tal en los dos archivos.

**Guardarraíl nuevo en el build** (`verificarOrigenDatos`): corta si el bundle
no menciona `/datos/fondo.json`, si todavía menciona `/api/fondo`, o si falta
`_seed/fondo.json`. Es el modo de falla más silencioso que tiene este build —
sin el flag, el sitio ANDA (por el proxy PHP al worker) hasta el día que se
apague el worker, y ahí se queda sin datos sin que nadie haya tocado nada. Que
el verificador **ya falló una vez de verdad** (el ternario sin plegar) es la
prueba de que no es un no-op.

Verificado: `tsc` limpio · `eslint` limpio · **76/76 tests** ·
`npm run fondo:build` verde.

Con el deploy servido por **Apache real** y un `publicado/fondo.json` escrito a
mano simulando lo que dejaría el panel:

| | |
|---|---|
| Bundle | `/api/fondo` **desapareció**; `/datos/fondo.json` presente |
| Pedidos de la página | `200 /datos/fondo.json` · `200 /datos/documentos.json` — **ninguno a `/api/*`** |
| Qué renderizó | los pesos del archivo **publicado** (EM 60 · EU 15 · NA 10 · AD 10 · OT 5), no los de la semilla |
| Regresión del dev | `https://localhost:3000` sigue pidiendo `/api/fondo` y `/api/fondo/documentos`, y renderiza la línea de base |

O sea: la cadena entera —publicar → Apache → página— quedó ejercitada de punta a
punta. Lo único que no pasó por ahí es el POST del panel al hosting, que es lo
que sigue esperando las env (§ Fase 1a).

**Un detalle de UX que cambió y no es un bug:** en el deploy estático el PDF se
guarda como `reglamento.pdf` y no como `BNG-Seleccion-Global-Reglamento-de-gestion.pdf`.
Un asset servido por Apache no lleva `Content-Disposition`, que es lo que ponía
el proxy. Es el mismo trato que ya tenían los PDFs de `lib/fondoDocsEstaticos.ts`
y se acepta por la misma razón: no vale un proceso PHP por descarga sólo para
renombrar el archivo.

### Fase 3 — Desmantelar Cloudflare — 🟡 PARCIAL (2026-08-17)

**Se partió en dos por una razón de orden que no estaba en el plan original: el
sitio VIVO todavía sirve el build anterior**, el que pide `/api/fondo*`. Mientras
eso siga así, el worker desplegado, la D1 y `api.php` **son carga, no residuo** —
y además son el camino de vuelta si el build nuevo diera problema. Borrarlos hoy
no gana nada y pierde el rollback.

Así que se hizo todo lo que no toca el sistema en marcha, y quedó atado a una
condición lo que sí.

**Hecho — nada de esto afecta al sitio publicado:**

- ✅ **Respaldo de la D1**, exportado y **verificado restaurable** (se importó a
  una SQLite y se contaron las filas): `fund_benchmark` 1261 cierres
  (2021-07-28 → 2026-08-05), `fund_holdings_snapshot` 2, `fund_holdings_item` 18,
  `fund_nav` vacía. Ninguna tabla con datos personales tiene filas, así que el
  dump no es sensible. Queda en `backups/`, **agregado al `.gitignore`** — es la
  única copia y conviene sacarla de la máquina.
- ✅ Borrados `workers/fondo-site/` y `.github/workflows/fondo-deploy.yml`. Ese
  workflow era **ruido activo**: corría en cada push a `feat/institucional` y
  deployaba a un destino que ya no es producción.
- ✅ Borrados los scripts `fondo:dev` / `fondo:deploy` de `package.json`, que
  apuntaban al `wrangler.jsonc` que ya no existe.
- ✅ `docs/RUNBOOK-fondo-cloudflare.md` reescrito: pasó de 332 líneas
  describiendo una arquitectura muerta a un documento de **teardown** con lo que
  falta y cómo autenticarse contra esa cuenta.
- ✅ Actualizados los comentarios que quedaban mintiendo (la cabecera de
  `scripts/build-fondo.mts` y la de `lib/fondoApi.ts`, que explicaba su propia
  existencia por «el worker», razón que cambió pero no desapareció: ahora el
  segundo consumidor es el publicador).

**Atado a una condición, escrita en la cabecera de `deploy/cpanel/api.php`:**

- ⏳ borrar `api.php` y su RewriteRule;
- ⏳ `wrangler delete --name bng-fondo-site` y `wrangler d1 delete bng-fondo`;
- ⏳ cerrar la cuenta y borrar el runbook.

Las dos condiciones: que el build nuevo lleve ~una semana publicado y sano, y que
el worker esté apagado. Los pasos exactos, con comandos, en
`docs/RUNBOOK-fondo-cloudflare.md` § Teardown.

**Verificado tras las bajas:** `tsc` limpio · `eslint` limpio · 76/76 tests ·
`npm run fondo:build` verde (o sea que el build nunca necesitó el worker) ·
`php -l` sobre los dos PHP del deploy —importa porque se le agregó una cabecera
larga a `api.php` y `declare(strict_types=1)` tiene que seguir siendo la primera
sentencia— · y el deploy servido por Apache real: la página pide sólo `/datos/*`,
renderiza lo publicado, y `/api/fondo` **sigue contestando 200**, que es la
ventana de rollback en pie.

**`workers/nav-ingest/` NO se borra.** Queda en el repo, sin deployar, para
cuando llegue la ingesta automática (§7).

---

## 6bis. Qué falta hacer, en orden — la parte de infraestructura

> 📦 **Guía paso a paso, para seguir mientras se ejecuta** (con qué verificar en
> cada paso y qué hacer si falla):
> https://claude.ai/code/artifact/c49a8e3d-9ad0-4a2e-be44-dbed8011c86d
> Lo de abajo es el resumen; el razonamiento de cada decisión, el resto de este documento.

Todo el código está hecho. Lo que sigue son pasos de operación.

> **La clave para poder sacar Cloudflare YA:** no hace falta resolver dónde vive
> el panel en producción. Publicar es un **POST saliente**, así que alcanza con
> publicar una vez desde donde el panel corra hoy —la Mac— para que el sitio
> tenga sus datos y Cloudflare deje de hacer falta. Dónde queda el panel para que
> entre **Adrián** es una pregunta aparte (§B), y no bloquea ésta.

### A. Sacar Cloudflare (no depende de nada pendiente)

0. **Poner el benchmark local al día.** La SQLite de la Mac tiene el benchmark
   hasta el 2026-07-28 y D1 hasta el 2026-08-05: 6 cierres de diferencia. Salen
   del dump ya respaldado (`backups/bng-fondo-d1/`). Es lo único que queda de la
   Fase 0.
1. **Generar el secreto del publicador:** `openssl rand -base64 48`.
2. **En el hosting**, crear `.publicar-secret` **fuera de `public_html`** (al
   lado, en el home de la cuenta), con ese valor y `chmod 600`.
3. **Subir `dist/fondo-cpanel/` a `public_html`** (3,7 MB). Trae el `.htaccess`
   nuevo, `publicar.php`, `_seed/` y los dos PDF.
   ⚠️ **Si tu cliente FTP tiene "borrar lo que no esté en el origen", APAGALO.**
   La carpeta `publicado/` la crea el receptor y es donde van a vivir los datos
   de Adrián; un sync destructivo la borraría.
4. **Comprobar que el sitio sirve la semilla:**
   `curl -sI https://bengocheainversiones.com/datos/fondo.json` → `200` y
   `Cache-Control: public, max-age=0, must-revalidate`.
5. **Configurar el publicador** donde corra el panel (hoy: `.env.local` de la
   Mac). `FONDO_PUBLISH_URL=https://bengocheainversiones.com/publicar.php` y
   `FONDO_PUBLISH_SECRET=<el del paso 1>`.
6. **Aplicar la migración** a la base del panel:
   `sqlite3 data/bengochea.sqlite3 < db/migrations/2026-08-16-fondo-geo.sql`.
7. **Publicar**: `/admin/fondo` → pestaña Publicar → *Publicar cambios*.
8. **Verificar el sitio vivo**: que `/datos/fondo.json` traiga las tenencias
   reales y que la página las muestre.
9. **Dejarlo una semana.** Mientras tanto `api.php` y el worker siguen ahí como
   red.
10. **Matar Cloudflare**: `wrangler delete --name bng-fondo-site` y
    `wrangler d1 delete bng-fondo` (comandos en
    `docs/RUNBOOK-fondo-cloudflare.md` § Teardown), y cerrar la cuenta.
11. **Avisar** para sacar `api.php` y su RewriteRule del build, y volver a subir.

### B. Para que entre Adrián (independiente de A)

- **Preguntarle al proveedor de hosting si hay «Setup Node.js App»** (selector de
  Node por Passenger, típico de cPanel con CloudLinux), con cuánta RAM y cuántos
  procesos. Es la premisa que nadie confirmó nunca y decide si el panel puede
  vivir en el mismo cPanel o necesita otra casa. Lo que **no** va a un
  compartido igual: `/analisis` y el pico de 1,04 GB del build.
- Crear a Adrián: `editor`, permisos = `fondo` solamente.
- Antes de darle la cuenta, la puerta de red: `docs/plan-seguridad-panel.md`.

### C. Suelto, de la pasada anterior

- **Comprobar `mod_ratelimit`** en ese hosting: va dentro de un `<IfModule>`, así
  que si el módulo no está, el throttle de los PDF es un **no-op silencioso**. Se
  mide descargando el Reglamento: ~1,6 s = anda; ~0,09 s = no está y hay que
  pedirlo.

---

## 6ter. La serie del benchmark — ✅ ARREGLADA EN LA BASE LOCAL (2026-08-17)

Descubierto el 2026-08-17 comparando la base local contra D1. **No bloquea nada
de lo pendiente** —hoy esa serie no se muestra— pero hay que dejarlo resuelto
antes de que el fondo tenga su primer valor cuota.

### Qué pasó

`scripts/fondo-benchmark-proxy.ts` reconstruye el 60/40 con proxies ETF y
**normaliza la serie a 100 en su primer día**. Como la ventana arranca en
«hoy − 5 años», **cada corrida rebasea en un día distinto**: no extiende la
anterior, la reemplaza. Pero el SQL que emitía terminaba en un `ON CONFLICT DO
UPDATE`, y su propio encabezado decía «re-aplicarlo es seguro».

No lo es. Aplicado sobre una serie con otro día base, el UPSERT pisa lo que
solapa y **deja intactas las ruedas anteriores al nuevo día base**, con los
niveles de la corrida vieja. Eso es un escalón artificial en el empalme.

Es exactamente lo que tiene D1:

```
  2021-08-04   local 100.466982   D1 100.466982    ← idénticas
  2021-08-05   local 100.670126   D1 100.000000    ← salto de −0,67 %
  2021-08-06   local 100.303666   D1  99.722231
```

Seis ruedas huérfanas (2021-07-28 → 2021-08-04) pegadas a una serie que arranca
de nuevo en 100 el 2021-08-05. De ahí las 1261 filas contra 1255, y de ahí que
años YA CERRADOS dieran distinto (2024: +9,11 % contra +10,89 %).

### Cuál es la buena

**La del repo**: `db/seeds/fondo-benchmark.sql`, generada el 5-ago-2026, 1255
ruedas, 2021-08-05 → 2026-08-05, base 100 al 2021-08-05, composición actual
(ACWI 60 / AGG 40), acumulado 38,81 % · anualizado 6,78 %. El último nivel de D1
—138,81166— cuadra con ese 38,81 %: **el tramo nuevo de D1 es correcto; lo que
sobra es la cabeza vieja**.

La base local es otra cosa: es una corrida **anterior al 5-ago**, con la
composición vieja (hasta esa fecha la renta fija se partía 45/55 entre AGG y
BWX). Coherente consigo misma, pero desactualizada.

### Qué hacer, cuando se decida

✅ **Hecho el 2026-08-17 sobre la base local.** El seed NO se puede aplicar tal
cual —tiene día base 2021-08-05 y la local arrancaba el 2021-07-28, así que un
UPSERT pelado habría reproducido exactamente la corrupción de D1—. Se hizo:

```sql
DELETE FROM fund_benchmark WHERE source = 'etf_proxy';
-- y recién entonces:  sqlite3 data/bengochea.sqlite3 < db/seeds/fondo-benchmark.sql
```

Respaldo previo consistente (`.backup`, no copia de archivo: la base está abierta
por el dev y con WAL una copia cruda pierde lo que no bajó del log) en
`backups/local/`.

**Verificación:** 1255 ruedas, 2021-08-05 → 2026-08-05, base exacta 100,0, final
138,81166 ⇒ acumulado **38,81 %** y anualizado **6,78 %**, que es lo que declara
el encabezado del seed. Cero ruedas anteriores al día base. Los cinco
movimientos diarios más grandes son días de mercado reconocibles (+5,37 % el
9-abr-2025, +4,08 % el 10-nov-2022), no artefactos de empalme.

Y la prueba que cierra: **`GET /api/fondo` local quedó byte a byte igual al del
sitio vivo**, con la única diferencia del campo `geo` —que es la funcionalidad
nueva y el worker viejo no conoce—. Los años calendario pasaron de estar todos
mal a coincidir:

| Año | antes | ahora | sitio vivo |
|---|---|---|---|
| 2026 | +5,29 | **+8,55** | +8,55 |
| 2025 | +16,68 | **+16,49** | +16,49 |
| 2024 | +9,11 | **+10,89** | +10,89 |
| 2023 | +15,45 | **+15,58** | +15,58 |
| 2022 | −17,33 | **−15,82** | −15,82 |

**Ya arreglado en el generador** (2026-08-17): el SQL que emite de ahora en más
empieza con ese `DELETE`, y el encabezado del script explica por qué —decía
«idempotente» y no lo era—. El seed que está hoy en el repo es de antes del
arreglo: sus datos son correctos, sus instrucciones no.

Y sigue en pie lo de siempre: todo esto es una **aproximación** con ETFs, a
reemplazar por los niveles reales en cuanto el administrador pase el export
(`source='administrator'`). Ver [[project_fondo_benchmark]].

### Por qué no corre apuro

Hoy nadie ve esa serie:

- la fila del benchmark en la tabla de rendimientos está detrás de
  `{hasBench && …}` con `hasBench = live && …`, y `live` exige
  `status === "live"` — el fondo está en pre-lanzamiento;
- el bloque de backtest muestra números de referencia, pero salen de **su propio
  JSON estático** (`/fondo/backtest-estrategia.json`), no de `fund_benchmark`;
- y en pre-lanzamiento `respuestaFondo` recorta los puntos de la serie.

Publicar desde la base local no cambia un número en la página. Pero el día del
primer valor cuota esa tabla aparece, con el índice **nombrado** (60% MSCI ACWI /
40% Bloomberg Global Aggregate) en el sitio de un fondo regulado por el BCU.

---

## 7. Que no cierre la puerta a la ingesta automática

El día que el valor cuota entre solo por mail, la regla es una sola:

> **La ingesta escribe en la base del panel, no en una segunda base.**

Dos formas, ninguna de las cuales obliga a deshacer nada de este plan:

- un lector IMAP en el server del panel (cron) que use `lib/fondoIngest.ts` —la validación
  ya está escrita y testeada, 17/17— y escriba la SQLite; o
- el Email Worker de Cloudflare tal como está, pero haciendo POST autenticado a
  un endpoint del panel en vez de escribir D1. (Esto reabre una cuenta de CF
  sólo para recibir mails; la primera opción no.)

En los dos casos, la ingesta llama al **mismo publicador** de la Fase 1 al
terminar, y el paso "Publicar" se vuelve automático para el NAV mientras sigue
siendo manual para tenencias y documentos. El publicador no se toca.

---

## 8. Adrián: cuenta y operación

- Crearlo como `editor` con **perms = `fondo`** solamente. Nada de `admin`.
- El flujo ya existe: clave temporal → primer acceso en scope `setup` → contraseña
  propia → enrolamiento TOTP con QR. Ver `docs/RUNBOOK-panel.md`.
- Agregar al RUNBOOK una sección corta para él: qué carga, con qué frecuencia,
  y qué significa el botón Publicar (que guardar **no** publica).
- El panel vive detrás del Funnel de Tailscale, que está **expuesto a internet**
  (incluido `/admin/login`). Con TOTP obligatorio y lockouts durables eso es
  defendible, pero es un hecho a saber, no a descubrir.

---

## 9. Riesgos y lo que no está verificado

| | |
|---|---|
| **Base de producción del panel sin verificar** | El riesgo #1. Mitigado por la Fase 0, que es un gate, no un paso. |
| **Panel caído** | El sitio no se entera; sólo no se puede publicar. Aceptable. |
| **Guardar ≠ publicar** | El modo de falla humano más probable. Mitigado por el aviso persistente de cambios sin publicar. |
| **Endpoint de escritura en el sitio público** | HMAC + ventana de 5 min + tope de tamaño + nombres de archivo fijos + secreto fuera de `public_html`. |
| **Dónde corre el panel en producción** | SIN CONFIRMAR. gestapp quedó descartado por el usuario el 2026-08-17. Decide dónde van las env del publicador y dónde se aplican las migraciones. |
| **«cPanel no corre Node»** | Sigue **sin confirmar** — sale de un comentario de `api.php`, nadie se lo preguntó al proveedor. No bloquea este plan (que no necesita Node ahí), pero si la respuesta fuera "sí, con Passenger y RAM holgada", habría un plan más simple que este y conviene saberlo antes de construir. Es una pregunta al hosting. |
| **`mod_ratelimit`** | Pendiente de la pasada anterior: va dentro de un `<IfModule>`, así que si el módulo no está en ese hosting el throttle de los PDF es un no-op silencioso. Se mide descargando el Reglamento: ~1,6 s = anda; ~0,09 s = no está. |

## 10. Orden y tamaño

| Fase | Qué es | Tamaño |
|---|---|---|
| ~~5.1~~ | ~~Decidir geografía~~ | resuelto 2026-08-16: objetivo del mandato |
| ~~0~~ | ~~Reconciliar bases~~ | ✅ **hecha 2026-08-17** — benchmark local reparado con el seed; `/api/fondo` local == sitio vivo |
| ~~1a~~ | ~~Publicador + receptor, en sombra~~ | ✅ **código hecho 2026-08-17** — 4 nuevos, 4 tocados, sin migración. Faltan 3 pasos de infraestructura |
| ~~1b~~ | ~~Geografía editable~~ | ✅ **hecha 2026-08-16** — 4 archivos nuevos, 6 tocados, 1 migración |
| ~~2~~ | ~~Conmutar el sitio~~ | ✅ **hecha 2026-08-17** — 4 archivos tocados + un guardarraíl nuevo en el build |
| 🟡 3 | Desmantelar CF | **parcial 2026-08-17** — respaldo + worker + workflow + docs hechos; borrar la D1 y `api.php` espera a que el build nuevo lleve una semana |

1a y 1b no dependen entre sí: la geografía se puede construir y probar antes de
que exista el publicador, y viaja sola cuando el publicador aparezca. Si querés
ver algo funcionando rápido, 1b es lo más chico que le cambia el día a Adrián.

**Dónde se construye cada cosa.** Todo el desarrollo va contra la Mac — el dev en
`https://localhost:3000` (que ya levanta los bindings de SQLite solo) y
`data/bengochea.sqlite3`. `publicar.php` se prueba contra el PHP 8.5 local que
quedó instalado en la pasada de endurecimiento. **Nada de esto necesita el server
de producción del panel**: hace falta sólo para los tres pasos de infraestructura
del publicador y para aplicar las migraciones, los dos al final.

Nada de esto se commitea sin pedido explícito.
