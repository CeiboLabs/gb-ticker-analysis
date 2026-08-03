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
- **Documentos del fondo**: subir el PDF por tipo → queda publicado; la
  sección del sitio los muestra sólo con el flag `fondo_documentos` prendido.
  Sin archivo/flag ⇒ el sitio lista el documento marcado "Próximamente", sin acción.
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
