# Runbook — Cloudflare en el sitio del fondo (DADO DE BAJA)

> 🔴 **Retirado el 17-ago-2026.** El sitio de BNG Selección Global ya no usa
> Cloudflare para nada. Este documento describía un worker (`bng-fondo-site`) y
> una D1 (`bng-fondo`) que servían los datos del fondo; el worker se sacó del
> repo y la base queda pendiente de borrar (§ Teardown).
>
> **Dónde está ahora lo que importa:**
> · cómo se arma y publica el sitio → `scripts/build-fondo.mts` y su cabecera;
> · cómo llegan los datos → `docs/plan-consolidacion-fondo.md` y
>   `docs/RUNBOOK-panel.md` § «Guardar no publica»;
> · operación del fondo → `docs/RUNBOOK-fondo.md`.
>
> Esto se conserva sólo por el **teardown pendiente** y por dos cosas que siguen
> siendo ciertas (el dominio y cómo autenticarse contra esa cuenta). Cuando la
> cuenta esté cerrada, este archivo se borra entero.

## Por qué se dio de baja

El sitio es HTML estático en un hosting cPanel. Los datos —valor cuota,
tenencias, geografía, documentos— vivían en una D1 de Cloudflare que un worker
exponía como `/api/fondo*`, y `deploy/cpanel/api.php` proxeaba desde el hosting.

Ese arreglo tenía sentido mientras los datos se empujaran a mano con SQL. Dejó
de tenerlo cuando el panel de empleados pasó a ser quien los carga: el ciclo real
es *Adrián guarda → Publicar*, y el publicador deja los mismos bytes como
archivos estáticos que Apache sirve sin ejecutar nada. La base en la nube no
compraba nada que el publicador no dé, y sí costaba una cuenta, una D1 y 240
líneas de PHP en el camino de **cada visita**.

Lo que se sacó, y lo que quedó:

| | |
|---|---|
| `workers/fondo-site/` | **borrado** del repo (17-ago-2026) |
| `.github/workflows/fondo-deploy.yml` | **borrado** — deployaba a un destino que ya no era producción |
| scripts `fondo:dev` / `fondo:deploy` | **borrados** de package.json |
| `deploy/cpanel/api.php` + su RewriteRule | **sigue viajando**, como ventana de rollback. La condición para borrarlo está en la cabecera del archivo |
| worker `bng-fondo-site` desplegado | **sigue arriba** — lo usa el build anterior, que es el que está publicado |
| D1 `bng-fondo` | **sigue arriba**, respaldada (§ Teardown) |
| `workers/nav-ingest/` | **se conserva**, sin deployar: es la ingesta del NAV por mail, para cuando llegue |

## Teardown pendiente

Los dos primeros pasos ya están hechos.

1. ✅ **Respaldo de la D1**, verificado restaurable el 17-ago-2026:

   ```bash
   set -a; . ~/.config/bng-fondo-cf.env; set +a
   npx -y wrangler@4.118.0 d1 export bng-fondo --remote \
     --output backups/bng-fondo-d1/bng-fondo-2026-08-17.sql
   ```

   Queda en `backups/`, que está gitignoreado: **es la única copia**. Guardala
   fuera de la máquina antes de borrar nada. Contenido real: `fund_benchmark`
   (1261 cierres, 2021-07-28 → 2026-08-05), `fund_holdings_snapshot` (2) y
   `fund_holdings_item` (18). `fund_nav` vacía —el fondo está en
   pre-lanzamiento— y ninguna tabla con datos personales tiene filas.

2. ✅ Código del worker y automatización, fuera del repo.

3. ⏳ **Subir el build nuevo** (`dist/fondo-cpanel/`) y dejarlo ~una semana sano.
   Hasta que eso pase, el worker y `api.php` siguen siendo carga.

4. ⏳ **Apagar el worker y borrar la base.** Recién después de (3):

   ```bash
   set -a; . ~/.config/bng-fondo-cf.env; set +a
   npx -y wrangler@4.118.0 delete --name bng-fondo-site
   npx -y wrangler@4.118.0 d1 delete bng-fondo
   ```

5. ⏳ **Sacar `api.php`** del repo y su RewriteRule de `htaccess()` en
   `scripts/build-fondo.mts`, y volver a subir.

6. ⏳ **Cerrar la cuenta de Cloudflare del fondo** y borrar este archivo.

## Autenticarse contra esa cuenta (mientras exista)

`wrangler login` guarda **un solo** token OAuth en
`~/Library/Preferences/.wrangler/`: loguearse con la cuenta del fondo reemplaza
el de la cuenta de `main`. Para no pisarla se usa un **API token por variable de
entorno**, que tiene precedencia y no toca nada guardado:

```bash
set -a; . ~/.config/bng-fondo-cf.env; set +a   # chmod 600, fuera del repo
npx wrangler whoami                            # confirmar que dice la cuenta del fondo
```

El archivo define `CLOUDFLARE_API_TOKEN` y `CLOUDFLARE_ACCOUNT_ID`. Para el
teardown alcanza con permisos `Workers Scripts:Edit` y `D1:Edit`.

## Dominio — esto NO cambió

**El fondo se sirve en la RAÍZ de `bengocheainversiones.com`** (decidido
2026-07-31) y el institucional se conserva en `gbengochea.com.uy`. El dominio
está horneado como default en `lib/sitios.ts`.

Hoy lo resuelve el hosting cPanel directamente; Cloudflare nunca llegó a estar
en el camino del DNS. Queda anotado el motivo por el que en su momento no se
pudo colgar el fondo de `gbengochea.com.uy`, porque puede volver a preguntarse:
un Custom Domain de Cloudflare exige la zona en la misma cuenta, ese dominio
resuelve en Antel, y Cloudflare **sólo delega subdominios sueltos en plan
Enterprise** — habría que mudar la zona entera, mail incluido.
