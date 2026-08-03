# Runbook — los dos sitios de la casa (institucional + fondo)

Decisión del equipo, **2026-07-29**: BNG Selección Global deja de ser una sección
del sitio institucional y pasa a ser un **sitio propio** — dominio, navbar y pie
propios. Sigue siendo **un solo repo y un solo deploy**.

## Por qué un deploy y no dos proyectos

El fondo comparte con la casa los tokens de `globals.css`, los componentes de
movimiento (`Reveal`, `SplitText`, iconos), el gesto de arrastrar-para-medir y
—sobre todo— el **panel de empleados**, que publica los documentos y el valor
cuota del fondo contra la misma base. Separar el repo obligaba a duplicar todo
eso, empezando por el panel.

## Cómo se reparte

| Qué | Dónde se decide |
| --- | --- |
| La **cáscara** (navbar + pie) | El route group: `app/(institucional)/` vs `app/(fondo)/`, cada uno con su `layout.tsx`. Estructura de archivos, cero lógica en runtime. |
| El **dominio** | `next.config.ts`: matchea el `Host` y reescribe la raíz del dominio del fondo a la página del fondo. |
| Los **orígenes** | `lib/sitios.ts` — única fuente de verdad, por env. |

`lib/seo.ts` reexporta el origen institucional como `SITE_URL` (que es lo que usa
todo el sitio); la definición vive en `lib/sitios.ts` porque `next.config.ts`
también la necesita.

### Env

| Var | Default (placeholder) | Qué es |
| --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | `https://gbengochea.com.uy` | Sitio institucional |
| `NEXT_PUBLIC_FONDO_URL` | `https://fondos.gbengochea.com.uy` | Sitio del fondo |

Los dos son **flags de build**: los rewrites y redirects se hornean en el build,
así que cambiarlos exige `build` + restart. Un restart solo no alcanza.

### Las tres reglas de ruteo (`next.config.ts`)

1. `Host` = dominio del fondo + `/` → **rewrite interno** a `/bng-seleccion-global`.
   Se reescribe **sólo la raíz**: así `/_next/*`, `/api/*` y los assets siguen
   derecho y el mismo build sirve los dos sitios.
2. `Host` = dominio de la casa + `/bng-seleccion-global` → **307** a la raíz del
   sitio del fondo. Es lo que hace que el usuario que entra por el navbar
   institucional termine con el dominio del fondo en la barra de direcciones.
3. `Host` = dominio del fondo + `/bng-seleccion-global` → **307** a `/`. Una sola
   URL por página también adentro de ese host.

307 y no 308 en las dos: el dominio está TBD (decisión D1 de `SEO-plan.md`) y un
permanente queda cacheado en el browser del cliente.

## Cómo se prueba sin DNS

**En el dev.** Los navegadores resuelven cualquier `*.localhost` a 127.0.0.1:

```
https://fondos.localhost:3000/     → el sitio del fondo
https://localhost:3000/            → el sitio institucional
```

El certificado de `next dev --experimental-https` cubre sólo `localhost`, así que
Chrome advierte por el nombre en el primero. Es esperado: se acepta y sigue.

**Sin browser** (no necesita ni el alias):

```bash
curl -sk -H "Host: fondos.localhost" https://localhost:3000/ | grep -o "<title>[^<]*"
curl -sk -o /dev/null -w "%{http_code} -> %{redirect_url}\n" \
     -H "Host: gbengochea.com.uy" https://localhost:3000/bng-seleccion-global
```

**En el home server.** `gestapp` se publica por Tailscale con **un solo
hostname**, así que ahí no matchea ninguna de las tres reglas y los dos sitios
quedan accesibles por path: `/` la casa y `/bng-seleccion-global` el fondo, cada
uno con su cáscara. Es deliberado — es la única forma de que el cliente revise el
sitio del fondo donde no hay subdominios. Por eso la página **sigue viviendo** en
`app/(fondo)/bng-seleccion-global/` y no en la raíz del route group.

## Links entre sitios

- **Casa → fondo** (navbar, pie, `/historia`, salida al pie de cada informe): `<a>`
  en la misma pestaña con el path **relativo** (`RUTA_FONDO`), no `<Link>`. En
  producción el 307 lo manda al dominio del fondo; donde hay un solo hostname
  entra derecho. Con `<Link>`, el router tendría que descubrir a mitad de una
  navegación de cliente que el redirect sale a otro origen, y encima
  prefetchearía una página de otro sitio para nada. La marca en el código es
  `otroSitio: true`.
- **Fondo → casa** (contacto, equipo, informes): el origen se resuelve **por
  request** en `app/(fondo)/layout.tsx` con `origenCasa(host)` y baja por props.
  Absoluto sólo si el request entró por el dominio del fondo; relativo si los dos
  sitios comparten hostname. Hardcodear el absoluto dejaría links al dominio de
  producción desde el dev y desde staging, donde ese dominio todavía no existe.
  Costo: el subárbol del fondo se renderiza por request (`headers()`). Los datos
  vivos de esa página ya venían del cliente por API, así que no agrega consultas.

## SEO

- El canonical del fondo apunta a la **raíz de su dominio** (`fondoMetadata()` en
  `lib/seo.ts`), no al path — si no, la misma página competiría consigo misma en
  dos URLs.
- `og:site_name` del fondo es «BNG Selección Global», no el de la casa.
- `robots.ts` y `sitemap.ts` responden **según el Host**: el sitemap del fondo
  lista una sola URL (su raíz) y el de la casa ya no lista el fondo.
- En el dominio del fondo, el robots permite **sólo la raíz** (`Allow: /$` +
  `/_next/`, `Disallow: /`): el resto de las rutas de la app responde también en
  ese host, así que sin eso el sitio institucional entero quedaría publicado dos
  veces.
- Nada de esto se ve hasta prender `SEO_INDEXABLE=1` (hoy el robots devuelve
  `Disallow: /` en los dos dominios).

## Pendiente para publicar

1. **Definir el dominio** del fondo y setear `NEXT_PUBLIC_FONDO_URL` (+ el DNS
   apuntando al mismo server que la casa).
2. **Certificado** que cubra el subdominio (o wildcard) en el reverse proxy.
3. Verificar que el reverse proxy **pase el `Host` original** (nginx:
   `proxy_set_header Host $host`). El ruteo por dominio se apoya en ese header:
   si el proxy lo pisa, el sitio del fondo no aparece.
4. Decidir si contacto vive también en el sitio del fondo. Hoy es una página
   sola y contacto se resuelve en la casa.
5. OG propia del fondo (`app/(fondo)/bng-seleccion-global/opengraph-image.tsx`).
   Medido: hoy el fondo **no emite `og:image`** — pero no es algo que haya
   cambiado con la mudanza. El `app/opengraph-image.tsx` de la raíz sólo sale en
   la home institucional; `/equipo`, `/informes` y `/analisis` tampoco emiten
   imagen (el comentario de `lib/seo.ts` que dice «site-wide» está de más). Al
   ser sitio propio, al fondo le corresponde la suya.

## Gotchas

- **El ruteo por dominio NO puede ir en `proxy.ts`** (el middleware de Next 16).
  Ya falló en este server para otra cosa: detrás del reverse proxy llega
  `X-Forwarded-Proto: https` y el `new URL(path, request.url)` del rewrite apunta
  a `https://localhost:<puerto HTTP>` ⇒ 500 (EPROTO). Ver el comentario largo de
  `lib/paginasOcultas.ts`. Los rewrites de `next.config.ts` se resuelven adentro
  del router, sin construir URLs a partir del request.
- **El `value` de `has: {type:"host"}` es un regex anclado** (`^valor$`) y en un
  regex el `|` tiene la precedencia más baja: `^a|b$` significa `(^a)|(b$)`. Sin
  un grupo que envuelva la alternancia, el matcher acepta cualquier host que
  *empiece* con el dominio o que *termine* con el alias. Va `(?: )` sin captura
  (Next vuelca los grupos nombrados en los params del destino). El `Host` llega
  sin puerto y en minúsculas.
- **El offset de las anclas cambió**: en el sitio del fondo no hay navbar fijo
  encima (la barra de marca scrollea con la página), así que el
  `scroll-margin-top` de las secciones es sólo el alto de la barra sticky (58 px,
  medido 55 + 3 de aire). Sumarle el `--nav-h` de antes dejaba un hueco muerto en
  cada salto.
