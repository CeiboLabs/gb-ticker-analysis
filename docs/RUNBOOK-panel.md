# RUNBOOK — Panel de administración de empleados (/admin)

Panel con login propio (email + contraseña + **TOTP obligatorio**) y permisos
por sección para que los empleados de Bengochea gestionen contenido del sitio
sin tocar código: **Informes** (lista pública + PDFs), **Fondo BNG** (valor
cuota, backfill, correcciones, tenencias, documentos) y **Secciones**
(mostrar/ocultar módulos). El rol `admin` además gestiona usuarios.

Piezas: tablas `admin_users` / `admin_sessions` / `admin_audit` / `site_flags` /
`informes` / `fondo_documentos` en la base (SQLite en el home server); PDFs en
el storage de documentos (binding `DOCS` — carpeta local en el home server);
rutas `/api/admin/panel/*` (cookie de sesión `__Host-bng_panel`); crypto pura
en `lib/panelCrypto.ts`, gates en `lib/panelAuth.ts`. **No hay middleware**:
cada page y route handler se protege solo (defensa por request).

---

## Puesta en marcha

**El hosting vive en `docs/RUNBOOK-home.md`** (home server con Docker o Node
pelado; ahí están el pepper, el ADMIN_TOKEN, TLS y los datos). Con el server
arriba, el alta del panel es:

1. **Primer administrador**: entrar a `/admin/setup`, pegar el `ADMIN_TOKEN`
   y crear la cuenta. La página se auto-deshabilita en cuanto existe un
   usuario (INSERT atómico ⇒ 409).

2. **Primer login**: `/admin/login` con email+contraseña → el flujo obliga a
   enrolar la app autenticadora (QR + clave manual) y recién ahí abre el panel.

⚠️ **Rotar `PANEL_PEPPER` invalida TODAS las contraseñas y secretos TOTP**
(firma los hashes y cifra los seeds). Sólo rotarlo asumiendo re-setup completo
de credenciales.

## 🔒 El panel está CERRADO (desde 2026-08-17)

Mientras no se termine de pulir, **`/admin` y `/api/admin/panel/*` devuelven 404**
— páginas y API, incluido el login. No es una pantalla de «prohibido»: es un 404
del sitio, para no confirmar que ahí hay algo.

**Para abrirlo**: `PANEL_HABILITADO=1` en el env **y reiniciar** el server (o
rebuildear). Cualquier otro valor, o la variable sin definir, lo deja cerrado.

**Fail-closed a propósito.** El default no es «abierto salvo que lo apaguen»: es
al revés, así que un deploy nuevo, una máquina sin configurar o un `.env` que no
viajó dejan el panel cerrado en vez de expuesto. Olvidarse de la variable no
puede publicar un panel a medio hacer.

Son **dos capas que leen la misma constante** (`PANEL_HABILITADO` en
`lib/sitios.ts`, el único módulo que alcanzan los dos mundos):

| Capa | Dónde | Qué hace | Cuándo se evalúa |
|---|---|---|---|
| Ruteo | `next.config.ts` → `rewrites().beforeFiles` | Reescribe `/admin*` y `/api/admin/panel/*` a una ruta inexistente ⇒ 404 | al arrancar el server |
| Gate | `lib/panelAuth.ts` → `requirePanelSession` / `getPanelUser` | Corta antes de mirar sesión, DB o permisos | en cada request |

La segunda existe porque la primera es de ruteo: si alguien borra la regla, monta
una ruta nueva en otro lado o deploya sin el rewrite, el gate sigue cerrado. Y
como leen la misma constante no pueden opinar distinto — si alguna vez
difirieran, el desacuerdo falla **cerrado**.

`login` y `setup` son las dos únicas rutas que no pasan por
`requirePanelSession` (no hay sesión todavía, que es justo la superficie de
credenciales), así que llevan la guarda escrita a mano.

**Verificado el 2026-08-17** contra un server real, en las dos direcciones:
cerrado ⇒ 404 en las 7 páginas, las 6 rutas de API y el POST de login, con el
resto del sitio en 200; con `PANEL_HABILITADO=1` ⇒ `/admin/login` vuelve a 200 y
`/admin/fondo` al 307 de siempre.

## Operación

- **Alta de empleado** (`/admin/usuarios`, rol admin): nombre, email, rol
  (`editor` + secciones, o `admin`), y una **clave temporal** generada que se
  entrega en mano. Su primer login exige cambiarla y enrolar TOTP.
- **Informes** (`/admin/informes`): crear (nace **oculto**) → subir el PDF
  (queda en R2, key versionada por timestamp) → **Publicar**. Ocultar informe
  = desaparece de la lista y su PDF da 404 (nunca se borra). El `videoId` de
  YouTube va sólo en mensuales. Publicar exige PDF (propio o URL histórica de
  gbengochea.com.uy — otros hosts se rechazan).
  - Los **artículos curados** siguen en código (`lib/informeContenido/`): al
    curar uno nuevo, además de la fila del panel hay que agregar la entrada en
    `lib/informes.ts` (metadata de la página estática) y el contenido en
    `lib/informeContenido/` + redeploy.
- **Fondo** (`/admin/fondo`): misma validación que la ingesta por mail
  (bandas de cordura, fechas, conflictos). Un día ya publicado con otro valor
  **no se pisa** desde la carga normal: va por **Corregir** (motivo
  obligatorio, queda `superseded` en `fund_audit` con el valor previo). El
  backfill exige confirmación expresa si el rango pisa cierres existentes.
  Tenencias: pesos en bps, Σ≈10000±100, `asset_class` ∈ `RV`/`RF`/`ALT`. El
  rezago anti front-running (`HOLDINGS_LAG_DAYS`, lib/fondoStore.ts) está en
  **0** mientras el Fondo no opere: el snapshot se publica el mismo día.
  ⚠️ **Volver a 30 cuando el Fondo empiece a operar.**
  - **Geografía**: los cinco pesos de la asignación **objetivo** del mandato
    (Σ = 100 exacto). ⚠️ Es el objetivo, **no** la exposición efectiva medida:
    si algún día se carga la efectiva hay que ponerle fecha de corte y
    reescribir el pie del bloque, que pasó por legales el 3-ago-2026. Sin
    cargar nada, el sitio usa la línea de base de `lib/fondoGeo.ts`.
- **Documentos del fondo**: subir el PDF por tipo → queda cargado; la
  sección del sitio los muestra sólo con el flag `fondo_documentos` prendido.
  Sin archivo/flag ⇒ el sitio lista el documento marcado "Próximamente", sin acción.

### ⚠️ Guardar no publica

En el sitio del fondo, **guardar en el panel no cambia el sitio**. Los datos
viven en la base del panel y viajan al hosting cuando alguien aprieta
**Publicar** (`/admin/fondo` → pestaña Publicar). Mientras haya cambios sin
publicar, todas las pestañas del fondo muestran un aviso arriba.

Publicar manda `fondo.json`, `documentos.json` y los PDF **que cambiaron** al
receptor del hosting, firmado con HMAC. Es idempotente: volver a publicar sin
cambios es inofensivo y es la salida cuando el archivo del hosting se perdió.

Para que funcione hacen falta **tres cosas de infraestructura**, una vez:

1. En el server del panel (`.env.local` de gestapp):
   - `FONDO_PUBLISH_URL=https://bengocheainversiones.com/publicar.php`
   - `FONDO_PUBLISH_SECRET=<32+ chars aleatorios>`
2. En el hosting, **fuera de `public_html`**: un archivo `.publicar-secret` con
   ese mismo valor, `chmod 600`. Fuera de `public_html` a propósito — si el
   hosting alguna vez sirviera `.php` como texto, ahí no hay nada que leer.
3. Subir `dist/fondo-cpanel/` (trae `publicar.php`, el `.htaccess` nuevo y
   `_seed/`). **`publicado/` no se sube y no se borra**: lo crea el receptor y
   es donde viven los datos de Adrián. El `.htaccess` prefiere `publicado/` y
   cae a `_seed/` sólo si no existe, así que una subida no puede pisar nada.

Sin (1) el panel avisa que el publicador no está configurado; sin (2) el
hosting responde `503 sin_secreto`. Los dos son fail-closed a propósito.
- **Secciones** (`/admin/secciones`): toggles de `videos_casa` (módulo de
  YouTube al pie de /informes), `instagram_feed` (novedades en la home — deja
  OFF hasta desplegar el worker de Instagram) y `fondo_documentos`. El cambio
  tarda ≤5 min (cache de los data-APIs). Default de todo: **OFF**.
- **Mi seguridad**: cambio de contraseña (pide la actual + código TOTP; revoca
  las otras sesiones) y "cerrar las demás sesiones".

## Recuperación de acceso

| Situación | Solución |
|---|---|
| Empleado olvidó la contraseña | Otro admin → Usuarios → **Reset clave** (temporal + cambio obligatorio; revoca sus sesiones) |
| Empleado perdió el teléfono/TOTP | Otro admin → Usuarios → **Reset 2FA** (el próximo login re-enrola) |
| El ÚNICO admin perdió el TOTP | SQL directo contra la base del server (ver RUNBOOK-home §Operación): |

```bash
sqlite3 data/bengochea.sqlite3 "UPDATE admin_users SET totp_secret=NULL, totp_pending_secret=NULL, totp_last_step=0 WHERE email='<email>'; UPDATE admin_sessions SET revoked_at=strftime('%s','now')*1000 WHERE user_id=(SELECT id FROM admin_users WHERE email='<email>') AND revoked_at IS NULL;"
```

| El ÚNICO admin perdió la contraseña | Generar hash offline con el pepper del server y aplicar el UPDATE que imprime: |

```bash
PANEL_PEPPER='<pepper del server>' npx tsx scripts/panel-hash-password.mts '<contraseña nueva>'
```

(Último recurso: `DELETE FROM admin_users;` y volver a `/admin/setup`.)

## Ajustes y problemas conocidos

- **Lockout**: 30 intentos/h por IP y 10 fallas/h por cuenta (tabla
  `rate_limits`, prefijos `panelfail`/`panelfailu`/`panelsetup`). Se libera
  solo al cerrar la ventana horaria. En el home server el lockout por IP
  requiere `TRUSTED_PROXY=1` detrás de un reverse proxy propio (ver
  RUNBOOK-home §TLS); el de por-cuenta funciona siempre.
- **Costo del hash**: `PANEL_PBKDF2_ITERS` (default 100000) se puede subir o
  bajar sin migrar nada — el hash guarda sus parámetros y se re-hashea en el
  próximo login. En un server propio no hay límite de CPU.
- **Auditoría**: TODA mutación y todo intento de login queda en `admin_audit`
  (visible en `/admin` para admins, o por SQL). Las cargas del fondo escriben
  además `fund_audit`, en el MISMO batch atómico que el dato.

## Desarrollo local

`npm run dev` (https://localhost:3000) levanta los bindings locales solo
(instrumentation.ts): el panel funciona en dev directo, con la base en
`./data`. Tests del núcleo: `npx tsx scripts/dev-tests/test-panel-auth.ts`;
códigos TOTP de prueba: `npx tsx scripts/dev-tests/totp-code.ts <SECRET>`.
