// BNG Selección Global — armado del SITIO ESTÁTICO que se sube a Cloudflare.
//
// POR QUÉ EL SITIO DEL FONDO NO ES UN DEPLOY DE NEXT
// La página del fondo no renderiza ni un dato en el server: valor cuota,
// tenencias y documentos los pide el cliente por `/api/fondo*` (ver
// lib/useFondo.ts y FondoDocumentos). Lo único que la hacía dinámica era leer el
// `Host` para decidir si los links a la casa son absolutos o relativos, y en su
// propio dominio esa respuesta es constante — de ahí el flag FONDO_STANDALONE
// (lib/sitios.ts).
//
// O sea que el server de Next no aporta NADA en producción, y hacerlo correr
// igual se paga caro: en Workers todo HTML pasaría por el worker, con el
// impuesto del adaptador en cada request. Servido como asset estático, en cambio,
// Cloudflare responde sin invocar código —"if a requested URL matches a file in
// the static assets directory, that file will be served — without invoking Worker
// code"— y esos requests no se facturan. El worker queda sólo para los tres
// endpoints de datos (workers/fondo-site), que es para lo que sirve un worker.
//
// EL BUILD CORRE EN UNA COPIA DEL REPO, A PROPÓSITO
// `next build` escribe en `.next/`, que es exactamente donde el `next dev` del
// desarrollador tiene su estado: buildear en el working tree le voltea el dev
// server. Por eso se rsyncea a un directorio temporal y se buildea allá.
// node_modules se clona con copy-on-write (`cp -c` en APFS, hardlinks en Linux):
// es instantáneo y no ocupa disco. No sirve symlinkearlo — Turbopack rechaza un
// node_modules que apunta fuera de la raíz del proyecto.
//
// USO
//   npm run fondo:build              # copia + build + armado
//   npm run fondo:build -- --rearmar # sólo el armado, reusando el último build
//
// SALIDA: dist/fondo/ — index.html, _next/static/*, los assets de public que la
// página realmente usa, robots.txt, sitemap.xml, 404.html, _headers, _redirects.

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SALIDA = path.join(REPO, "dist", "fondo");
const COPIA = process.env.FONDO_BUILD_DIR ?? path.join(os.tmpdir(), "bng-fondo-build");

// Ruta FÍSICA de la página dentro de la app. Se sirve en la raíz del dominio del
// fondo, así que su HTML termina siendo el index.html del deploy.
const RUTA = "bng-seleccion-global";

// ── Env ──────────────────────────────────────────────────────────────────────
// `next build` levanta `.env.local` solo; este script no. Lo carga con la MISMA
// precedencia (lo que ya está en el entorno gana) para que los flags de build
// —NEXT_PUBLIC_FONDO_URL, SEO_INDEXABLE— salgan idénticos en el HTML y en los
// archivos que se generan acá abajo. Sin esto el sitemap podía apuntar a un
// dominio y el canonical del HTML a otro.
function cargarEnvLocal() {
  const archivo = path.join(REPO, ".env.local");
  if (!fs.existsSync(archivo)) return;
  for (const linea of fs.readFileSync(archivo, "utf8").split("\n")) {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(linea);
    if (!m || linea.trimStart().startsWith("#")) continue;
    const [, clave, crudo] = m;
    if (process.env[clave] !== undefined) continue;
    process.env[clave] = crudo.trim().replace(/^(['"])(.*)\1$/, "$2");
  }
}
cargarEnvLocal();

const { SITIO_CASA_URL, SITIO_FONDO_URL, RUTA_FONDO } = await import("../lib/sitios");
const { SEO_INDEXABLE, OG_FONDO } = await import("../lib/seo");
const { headersSeguridad } = await import("../lib/headersSeguridad");
const { DOCS_ESTATICOS } = await import("../lib/fondoDocsEstaticos");

// ── Copia del repo + build ───────────────────────────────────────────────────

function prepararCopia() {
  fs.mkdirSync(COPIA, { recursive: true });
  // `.env.local` NO viaja: ya lo cargó `cargarEnvLocal()` en este proceso y de acá
  // pasa entero al `next build` por el env del hijo. Si además viajara el archivo,
  // Next lo releería en la copia y repondría las variables que `correrBuild()`
  // saca a propósito (FONDO_DEMO) — las variables reales tienen precedencia sobre
  // un .env, pero una variable BORRADA no es una variable. Así este proceso es la
  // única puerta por la que entra el entorno del build.
  const excluir = [
    ".git", "node_modules", ".next", ".vercel", ".wrangler", ".cache",
    ".lapicera-backup", "tsconfig.tsbuildinfo", "data", "certificates",
    "dist", ".DS_Store", ".env.local",
  ];
  execFileSync(
    "rsync",
    ["-a", "--delete", ...excluir.flatMap((e) => ["--exclude", e]), `${REPO}/`, `${COPIA}/`],
    { stdio: "inherit" },
  );

  // node_modules: se clona una sola vez y después se reusa. `cp -c` usa clonefile
  // de APFS (copy-on-write: instantáneo y sin ocupar disco); en Linux el
  // equivalente barato son hardlinks. Si el árbol de dependencias cambia, se
  // borra el directorio de build y se vuelve a clonar.
  const destino = path.join(COPIA, "node_modules");
  if (!fs.existsSync(destino)) {
    const flags = process.platform === "darwin" ? ["-Rc"] : ["-al"];
    console.log("· clonando node_modules…");
    execFileSync("cp", [...flags, path.join(REPO, "node_modules"), destino], { stdio: "inherit" });
  }
}

function correrBuild() {
  const next = path.join(COPIA, "node_modules", ".bin", "next");

  // FONDO_DEMO se SACA del build, aunque esté en el `.env.local` del desarrollador
  // (donde tiene todo el sentido: es el modo que deja ver la página con un valor
  // cuota simulado antes de que haya datos). Este build no arma un dev: arma el
  // sitio PÚBLICO. Hoy la página no renderiza ningún dato en el server y por eso
  // el flag no cambia el HTML — pero el día que algo se prerenderice, la máquina
  // que tenga el flag prendido publicaría números inventados, y la que no, no.
  // La misma razón por la que el worker no lo declara (workers/fondo-site).
  // De paso, iguala el build de acá con el de CI, que nunca va a tener .env.local.
  // La anotación NO sobra: el spread de `process.env` PIERDE su índice de string
  // —TS no lo propaga— y sin ella `env.FONDO_DEMO` no compila. Y esto lo type-chequea
  // el propio `next build`, que barre `scripts/` (el error aparece recién ahí).
  const env: NodeJS.ProcessEnv = { ...process.env, FONDO_STANDALONE: "1" };
  if (env.FONDO_DEMO) {
    console.log("  (FONDO_DEMO ignorado — el sitio público nunca se buildea en modo demo)");
    delete env.FONDO_DEMO;
  }

  execFileSync(next, ["build"], { cwd: COPIA, stdio: "inherit", env });
}

// ── Recolección de assets ────────────────────────────────────────────────────
// Se copia SÓLO lo que la página usa, no `.next/static` entero: ese directorio
// tiene también los bundles de cliente del panel de empleados y del analizador,
// y no hay ninguna razón para publicarlos en el dominio del fondo.
//
// El barrido es transitivo pero con DOS reglas distintas, y la diferencia
// importa:
//
//   · los chunks (`/_next/static/…`) se siguen por el grafo de código — del HTML
//     salen los de entrada y de cada uno los que él referencia, hasta el punto
//     fijo. Así no queda afuera un chunk cargado en segundo grado;
//   · los assets de public salen SÓLO del HTML y de los CSS, o sea de lo que la
//     página de verdad renderiza. Seguirlos desde el JS traía basura: los chunks
//     son compartidos con el sitio institucional, y por el navbar de la casa
//     —que acá no se monta— se colaban 2,1 MB de imágenes que nadie pide.
//
// El corolario: si algún día una imagen de esta página apareciera recién después
// de una interacción (no en el render inicial), habría que sumarla a mano. Hoy
// no hay ninguna — todo lo que la página muestra sale del server render.

const RE_NEXT = /\/_next\/static\/[A-Za-z0-9._~/-]+/g;
// ⚠️ Los chunks diferidos NO aparecen con el prefijo del HTML: el runtime de
// Turbopack los guarda relativos —`"static/chunks/12ie_z10jiv-~.js"`— y les pone
// `/_next/` recién al pedirlos. Buscar sólo la forma absoluta dejaba afuera todo
// lo cargado en segundo grado, y la página quedaba con un ChunkLoadError y el
// módulo de performance sin dibujar. Se normalizan a la forma absoluta.
const RE_NEXT_REL = /static\/(?:chunks|media)\/[A-Za-z0-9._~/-]+/g;
// `pdf` está en la lista por los documentos del fondo que viajan en el deploy
// (lib/fondoDocsEstaticos.ts): el Reglamento y la autorización del BCU se
// linkean desde el HTML y hay que copiarlos como cualquier otro asset. No barre
// de más: los PDFs regulatorios del pie viven en el sitio viejo, y una ruta que
// no exista en `public/` la descarta `fuenteDe`.
const RE_PUBLIC =
  /\/(?:[A-Za-z0-9._~-]+\/)*[A-Za-z0-9._~-]+\.(?:svg|png|jpe?g|webp|avif|gif|ico|mp4|webm|woff2?|pdf)(?![A-Za-z0-9])/g;
const TEXTO = new Set([".js", ".css", ".json", ".mjs"]);
/** De estos archivos también se leen los assets de public (ver arriba). */
const CON_ASSETS = new Set([".css"]);

/** Ruta en disco de una referencia absoluta, o null si no existe como archivo. */
function fuenteDe(ref: string): string | null {
  const p = ref.startsWith("/_next/")
    ? path.join(COPIA, ".next", ref.slice("/_next/".length))
    : path.join(REPO, "public", ref);
  return fs.existsSync(p) && fs.statSync(p).isFile() ? p : null;
}

function copiar(ref: string, fuente: string) {
  const destino = path.join(SALIDA, ref);
  fs.mkdirSync(path.dirname(destino), { recursive: true });
  fs.copyFileSync(fuente, destino);
}

function recolectar(html: string): string[] {
  const vistos = new Set<string>();
  const copiados: string[] = [];
  const pendientes: string[] = [];

  const encolar = (texto: string, conAssets: boolean) => {
    const regexes = conAssets ? [RE_NEXT, RE_NEXT_REL, RE_PUBLIC] : [RE_NEXT, RE_NEXT_REL];
    for (const re of regexes) {
      for (const bruto of texto.match(re) ?? []) {
        // El payload de RSC va escapado dentro del HTML: las referencias llegan
        // con comillas y barras invertidas pegadas. El charset del regex ya las
        // corta, pero un `.js\` residual rompería el existsSync.
        const limpio = bruto.replace(/\\+$/, "");
        const ref = limpio.startsWith("static/") ? `/_next/${limpio}` : limpio;
        if (!vistos.has(ref)) {
          vistos.add(ref);
          pendientes.push(ref);
        }
      }
    }
  };

  encolar(html, true);
  while (pendientes.length) {
    const ref = pendientes.shift()!;
    const fuente = fuenteDe(ref);
    if (!fuente) continue; // falso positivo del regex (una cadena que parecía path)
    copiar(ref, fuente);
    copiados.push(ref);
    const ext = path.extname(ref);
    if (TEXTO.has(ext)) encolar(fs.readFileSync(fuente, "utf8"), CON_ASSETS.has(ext));
  }
  return copiados;
}

// ── Links que SALEN hacia el sitio institucional ─────────────────────────────
//
// ⚠️ TEMPORAL — se borra el día que el institucional nuevo reemplace al sitio
// PHP en gbengochea.com.uy.
//
// El sitio del fondo linkea `/contacto`, `/equipo` e `/informes`, que son las
// rutas de la app. Pero hoy ese dominio sirve el sitio VIEJO, y ahí esas rutas
// no existen: verificado, devuelven 404. Publicar el fondo así dejaba su CTA
// principal —"Hablar con un asesor"— cayendo en una página de error.
//
// Se traducen a las URLs que el sitio viejo sí tiene (`nosotros.php` es la
// página de equipo: su encabezado es "Nuestro equipo"). Va acá y no en los
// componentes a propósito: es una condición del ENTORNO, no del producto, y
// mezclarla con el código dejaría rastros de un sitio muerto en archivos que le
// van a sobrevivir. Cuando salga el institucional nuevo, se vacía este objeto.
const CASA_LEGACY: Record<string, string> = {
  "/contacto": "/contacto.php",
  "/equipo": "/nosotros.php",
  "/informes": "/informes.php",
};

function reescribirLinksALaCasa(html: string): { html: string; cambios: number } {
  let cambios = 0;
  let salida = html;
  for (const [nuevo, viejo] of Object.entries(CASA_LEGACY)) {
    // El lookahead evita pisar una ruta más larga que empiece igual
    // (`/informes/algo`) y sirve para las dos formas en que la URL aparece en el
    // HTML: entre comillas y escapada dentro del payload de RSC.
    const re = new RegExp(
      `${SITIO_CASA_URL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}${nuevo}(?![A-Za-z0-9./-])`,
      "g",
    );
    salida = salida.replace(re, () => {
      cambios++;
      return `${SITIO_CASA_URL}${viejo}`;
    });
  }
  return { html: salida, cambios };
}

// ── Archivos propios del deploy ──────────────────────────────────────────────

function robotsTxt(): string {
  // Mismo kill-switch que app/robots.ts: sin SEO_INDEXABLE=1 no se indexa nada.
  // Acá NO hace falta el truco de `Allow: /$` que usa el build compartido —ahí
  // convivían los dos sitios en un host y había que publicar sólo la raíz—:
  // este deploy sirve una sola página y sus datos.
  if (!SEO_INDEXABLE) return "User-agent: *\nDisallow: /\n";
  return [
    "User-agent: *",
    "Allow: /",
    "Disallow: /api/",
    "",
    `Sitemap: ${SITIO_FONDO_URL}/sitemap.xml`,
    "",
  ].join("\n");
}

function sitemapXml(): string {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    "  <url>",
    `    <loc>${SITIO_FONDO_URL}/</loc>`,
    "    <changefreq>weekly</changefreq>",
    "    <priority>1.0</priority>",
    "  </url>",
    "</urlset>",
    "",
  ].join("\n");
}

function headersFile(): string {
  const lineas = ["# Generado por scripts/build-fondo.mts — no editar a mano.", "/*"];
  for (const { key, value } of headersSeguridad({ dev: false })) {
    lineas.push(`  ${key}: ${value}`);
  }
  // Los assets de Next llevan hash de contenido en el nombre: son inmutables y
  // conviene decirlo, porque el asset server de Cloudflare por defecto los
  // revalida en cada visita.
  lineas.push("", "/_next/static/*", "  Cache-Control: public, max-age=31536000, immutable", "");
  return lineas.join("\n");
}

function redirectsFile(): string {
  // El path físico de la página colapsa a la raíz, igual que hace next.config.ts
  // en el dominio del fondo.
  //
  // 308 (permanente) desde 2026-08-06. Antes era 307 porque el dominio todavía
  // se estaba definiendo y un permanente queda clavado en el browser; ya está
  // definido y publicado. El permanente es además el que corresponde por SEO:
  // es la señal con la que Google CONSOLIDA las dos URLs en una —el temporal le
  // dice lo contrario, que la de origen puede volver a ser válida—, y acá el
  // colapso es definitivo por diseño (el canonical horneado en el HTML es la
  // raíz). 308 y no 301 para preservar el método, que es lo que corresponde en
  // el formato de Cloudflare; el equivalente de Apache va en htaccess().
  return [
    "# Generado por scripts/build-fondo.mts — no editar a mano.",
    `${RUTA_FONDO} / 308`,
    `${RUTA_FONDO}/ / 308`,
    "",
  ].join("\n");
}

/**
 * Manifest propio del sitio del fondo.
 *
 * El `<link rel="manifest">` lo emite el layout raíz, así que el archivo TIENE
 * que existir o queda un 404 en cada carga. No se copia el de la app
 * (`app/manifest.ts`): ése se llama "Gastón Bengochea & Cía." y en este dominio
 * el sitio es el del fondo — instalarlo mostraría el nombre de la casa. Mismo
 * navy y mismo ícono, que son de la casa y acá también corresponden.
 *
 * ⚠️ EL ÍCONO DE 180 NO SE LISTA ACÁ, y el motivo es medible: Chrome baja los
 * íconos del manifest en la carga normal, con prioridad alta, y ése pesa 15,3 KB
 * — más que el HTML comprimido de la página entera. Probado quitándolo de un
 * lado y del otro: sacarlo del manifest elimina el pedido; sacar el
 * `<link rel="apple-touch-icon">` del HTML no lo elimina, o sea que el que lo
 * dispara es este archivo. Ver docs/rendimiento-fondo.md §6.4.
 *
 * No se pierde el ícono grande donde se usa: en iOS lo toma el apple-touch-icon
 * del HTML, que sigue declarado. Lo único que queda con el de 96 es el instalable
 * de Android, y este sitio no lo es — no hay service worker.
 */
function manifestJson(): string {
  return `${JSON.stringify(
    {
      name: "BNG Selección Global",
      short_name: "BNG Selección Global",
      description:
        "Fondo de inversión con exposición global a renta variable y renta fija, domiciliado en Uruguay.",
      lang: "es-UY",
      start_url: "/",
      display: "standalone",
      background_color: "#ffffff",
      theme_color: "#0f2249",
      icons: [{ src: "/favicon-96x96.png", sizes: "96x96", type: "image/png" }],
    },
    null,
    2,
  )}\n`;
}

/**
 * El favicon.ico no vive en public/: es una metadata route de Next
 * (`app/favicon.ico`), y el build deja sus bytes en un archivo `.body`. Sin esto
 * el sitio queda sin favicon, que en un dominio nuevo es justo lo que se nota.
 */
function copiarFavicon() {
  const body = path.join(COPIA, ".next", "server", "app", "favicon.ico.body");
  if (fs.existsSync(body)) fs.copyFileSync(body, path.join(SALIDA, "favicon.ico"));
}

/**
 * La card OG del fondo, por el mismo mecanismo `.body` que el favicon.
 *
 * `app/(fondo)/bng-seleccion-global/opengraph-image.tsx` es una metadata route:
 * Next la resuelve en build —no tiene datos dinámicos— y deja el PNG en
 * `.next/server/app/<ruta>/opengraph-image-<hash>.body`. Ese hash CAMBIA de build
 * en build, así que no se puede cablear: se busca por prefijo y se copia al
 * nombre fijo que `fondoMetadata()` publica en `og:image` (lib/seo.ts · OG_FONDO).
 *
 * Corta el build si no lo encuentra, y es a propósito: el HTML ya salió
 * prometiendo esa URL, así que un faltante no degrada —deja la card rota en cada
 * link compartido—, y es exactamente la regresión silenciosa que tuvo el sitio
 * hasta agosto de 2026 (se publicó sin ninguna imagen OG y no lo dijo nadie).
 */
/**
 * Backtest de la estrategia — el JSON que dibuja el gráfico mientras el Fondo no
 * publique valor cuota (lib/fondoBacktest.ts · FondoBacktest.tsx).
 *
 * Va copiado A MANO porque el barrido de assets no lo puede ver: sale del HTML y
 * de los CSS —o sea, de lo que la página renderiza— y esto se pide por `fetch`
 * en tiempo de ejecución. Es exactamente el caso que anticipa el comentario de
 * «Recolección de assets»: un asset que aparece recién después del render
 * inicial hay que sumarlo acá.
 *
 * La ruta está escrita dos veces —acá y en BACKTEST_URL— a propósito: importar
 * lib/fondoBacktest.ts arrastraría React a este script. La guarda de abajo se
 * encarga de que las dos no se separen.
 */
const BACKTEST = "/fondo/backtest-estrategia.json";

function copiarBacktest() {
  const fuente = path.join(REPO, "public", BACKTEST.slice(1));
  if (!fs.existsSync(fuente)) {
    console.error(
      `\n✘ Falta ${path.relative(REPO, fuente)}.\n` +
        "  Lo genera scripts/fondo-backtest.mts a partir del Excel del cliente:\n" +
        "    npx tsx scripts/fondo-backtest.mts <archivo.xlsx>\n" +
        "  Sin él, el módulo de performance cae al aviso de «Próximamente» sin gráfico.\n",
    );
    process.exit(1);
  }
  copiar(BACKTEST, fuente);
}

/**
 * Que el archivo esté copiado no alcanza: si alguien renombra BACKTEST_URL en
 * lib/fondoBacktest.ts, el deploy seguiría llevando el JSON en la ruta vieja y
 * la página pediría la nueva — 404, y el bloque simplemente no aparece. Nadie se
 * entera, porque el fallback de ese bloque es el aviso de siempre. Así que se
 * exige que la ruta esté ADEMÁS en el bundle que se copió.
 */
function verificarBacktest(): string | null {
  if (!fs.existsSync(path.join(SALIDA, BACKTEST))) return `${BACKTEST} no llegó al deploy`;
  const chunks = path.join(SALIDA, "_next", "static", "chunks");
  const pedido = fs.existsSync(chunks)
    && fs.readdirSync(chunks, { recursive: true, encoding: "utf8" }).some((f) => {
      const p = path.join(chunks, f);
      return fs.statSync(p).isFile()
        && path.extname(p) === ".js"
        && fs.readFileSync(p, "utf8").includes(BACKTEST);
    });
  return pedido ? null : `ningún chunk pide ${BACKTEST} — ¿cambió BACKTEST_URL en lib/fondoBacktest.ts?`;
}

function copiarOg() {
  const dir = path.join(COPIA, ".next", "server", "app", RUTA);
  const archivo = fs.existsSync(dir)
    ? fs.readdirSync(dir).find((f) => f.startsWith("opengraph-image") && f.endsWith(".body"))
    : undefined;

  if (!archivo) {
    console.error(
      `\n✘ No se encontró la card OG generada en ${dir}.\n` +
        "  La espera app/(fondo)/bng-seleccion-global/opengraph-image.tsx y la publica\n" +
        `  fondoMetadata() como ${OG_FONDO}: sin el archivo, todo link compartido queda\n` +
        "  con la tarjeta rota. Revisá que esa metadata route siga prerenderizándose.\n",
    );
    process.exit(1);
  }

  fs.copyFileSync(path.join(dir, archivo), path.join(SALIDA, OG_FONDO));
}

function notFoundHtml(): string {
  // 404 mínima y autosuficiente: sin fuentes ni chunks, para que no dependa de
  // ningún asset con hash. El 404 de la app no sirve acá — trae la cáscara del
  // sitio institucional, que en este dominio es otro sitio.
  return `<!doctype html>
<html lang="es-UY">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Página no encontrada · BNG Selección Global</title>
<style>
  body { margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center;
         font-family: Arial, Helvetica, sans-serif; color: #0f2249; background: #fff; }
  main { max-width: 34em; padding: 32px; }
  h1 { font-size: 22px; font-weight: 600; margin: 0 0 12px; }
  p { font-size: 15px; line-height: 1.6; color: #4a5568; margin: 0 0 24px; }
  a { color: #0f2249; font-size: 14px; letter-spacing: 0.02em; }
</style>
</head>
<body>
<main>
  <h1>Esta página no existe.</h1>
  <p>El enlace que seguiste no corresponde a ninguna sección de BNG Selección Global.</p>
  <a href="/">Volver al inicio</a>
</main>
</body>
</html>
`;
}

// ── Armado ───────────────────────────────────────────────────────────────────

function armar() {
  const html = path.join(COPIA, ".next", "server", "app", `${RUTA}.html`);
  if (!fs.existsSync(html)) {
    console.error(
      `\n✘ No hay HTML prerenderizado en ${html}.\n` +
        "  La página quedó dinámica: revisá que el build haya corrido con FONDO_STANDALONE=1\n" +
        "  y que nada del árbol del fondo llame a headers()/cookies().\n",
    );
    process.exit(1);
  }

  fs.rmSync(SALIDA, { recursive: true, force: true });
  fs.mkdirSync(SALIDA, { recursive: true });

  const crudo = fs.readFileSync(html, "utf8");
  const { html: contenido, cambios } = reescribirLinksALaCasa(crudo);
  if (cambios) console.log(`  ${cambios} links al institucional reescritos a las URLs del sitio viejo`);
  fs.writeFileSync(path.join(SALIDA, "index.html"), contenido);
  const assets = recolectar(contenido);

  // Los manifests del build son chicos y el runtime de Next puede pedirlos sin
  // que aparezcan como path literal en el HTML: van completos.
  const estatico = path.join(COPIA, ".next", "static");
  for (const dir of fs.readdirSync(estatico)) {
    if (dir === "chunks" || dir === "media") continue;
    fs.cpSync(path.join(estatico, dir), path.join(SALIDA, "_next", "static", dir), { recursive: true });
  }

  copiarFavicon();
  copiarOg();
  copiarBacktest();
  fs.writeFileSync(path.join(SALIDA, "manifest.webmanifest"), manifestJson());
  fs.writeFileSync(path.join(SALIDA, "robots.txt"), robotsTxt());
  fs.writeFileSync(path.join(SALIDA, "sitemap.xml"), sitemapXml());
  fs.writeFileSync(path.join(SALIDA, "404.html"), notFoundHtml());
  fs.writeFileSync(path.join(SALIDA, "_headers"), headersFile());
  fs.writeFileSync(path.join(SALIDA, "_redirects"), redirectsFile());

  return assets;
}

/**
 * Guarda contra el modo de falla propio de este armado: que quede afuera un
 * chunk y la página cargue igual pero con un módulo muerto.
 *
 * Ya pasó una vez —los chunks diferidos se referencian relativos y el barrido
 * sólo miraba la forma absoluta—: la página se veía entera, y sin embargo el
 * módulo de performance no dibujaba y en la consola había un ChunkLoadError.
 * Un deploy no puede depender de que alguien abra la consola. Acá se recorre lo
 * que SE COPIÓ y se exige que cada referencia resuelva a un archivo del deploy.
 */
function verificar(): string[] {
  const faltantes = new Set<string>();
  const recorrer = (dir: string) => {
    for (const entrada of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entrada.name);
      if (entrada.isDirectory()) {
        recorrer(p);
        continue;
      }
      if (!TEXTO.has(path.extname(p)) && path.extname(p) !== ".html") continue;
      const texto = fs.readFileSync(p, "utf8");
      for (const re of [RE_NEXT, RE_NEXT_REL]) {
        for (const bruto of texto.match(re) ?? []) {
          const limpio = bruto.replace(/\\+$/, "");
          const ref = limpio.startsWith("static/") ? `/_next/${limpio}` : limpio;
          if (!fs.existsSync(path.join(SALIDA, ref))) faltantes.add(ref);
        }
      }
    }
  };
  recorrer(SALIDA);
  return [...faltantes];
}

/**
 * Guarda de los documentos que viajan en el deploy (lib/fondoDocsEstaticos.ts).
 *
 * Tienen DOS modos de falla silenciosa, y los dos terminan en una página que
 * miente sin que nadie se entere:
 *
 *   · que el PDF se reemplace y la lista quede con el `bytes` viejo — la fila
 *     anuncia un tamaño que no es el del archivo. El tamaño es justo lo que
 *     delata que el archivo cambió y la lista no, así que se compara;
 *   · que el archivo no haya llegado al deploy — la fila dice "Descargar" y el
 *     link da 404. Pasa si alguien saca el href del render inicial: el barrido
 *     de assets sale del HTML, y lo que no está en el HTML no se copia.
 *
 * Por eso se verifica en la fuente Y en la salida.
 */
function verificarDocs(): string[] {
  const problemas: string[] = [];
  for (const doc of DOCS_ESTATICOS) {
    const fuente = path.join(REPO, "public", doc.archivo);
    if (!fs.existsSync(fuente)) {
      problemas.push(`${doc.archivo} — no existe en public/`);
      continue;
    }
    const bytes = fs.statSync(fuente).size;
    if (bytes !== doc.bytes) {
      problemas.push(`${doc.archivo} — el archivo pesa ${bytes} y la lista dice ${doc.bytes}`);
    }
    if (!fs.existsSync(path.join(SALIDA, doc.archivo))) {
      problemas.push(`${doc.archivo} — no llegó al deploy (la página no lo linkea en el render inicial)`);
    }
  }
  return problemas;
}

// ── Variante para el hosting cPanel ──────────────────────────────────────────
//
// El sitio se publica en el hosting del cliente (Apache + PHP, sin Node). Cambia
// sólo la cáscara: los mismos archivos estáticos, pero lo que en Cloudflare vivía
// en `_headers` y `_redirects` acá va en un `.htaccess`, y los tres endpoints de
// datos los sirve `deploy/cpanel/api.php`, que consulta al worker (ver el
// comentario largo de ese archivo).

const SALIDA_CPANEL = path.join(REPO, "dist", "fondo-cpanel");

function htaccess(): string {
  const l: string[] = [
    "# Generado por scripts/build-fondo.mts — no editar a mano.",
    "# Reemplaza a _headers y _redirects, que son formato de Cloudflare.",
    "",
    "Options -Indexes",
    "ErrorDocument 404 /404.html",
    "",
    "<IfModule mod_rewrite.c>",
    "  RewriteEngine On",
    "",
    "  # Los tres endpoints de datos, al proxy PHP.",
    "  RewriteRule ^api/fondo(/.*)?$ api.php [L,QSA]",
    "",
    "  # El path físico de la página colapsa a la raíz: una sola URL por página.",
    "  # 301 (permanente): es la señal con la que Google consolida las dos URLs en",
    "  # una. Un temporal le dice lo contrario —que la de origen puede volver a ser",
    "  # válida— y deja las dos compitiendo en el índice. Ver docs/SEO-fondo.md.",
    "  RewriteRule ^bng-seleccion-global/?$ / [R=301,L]",
    "",
    "  # HTTPS y sin www — el canonical horneado en el HTML es el apex.",
    "  # ⚠️ Si AutoSSL todavía no emitió el certificado, comentar estas tres líneas:",
    "  # forzar HTTPS antes de tener certificado deja el sitio con advertencia.",
    "  RewriteCond %{HTTPS} !=on [OR]",
    "  RewriteCond %{HTTP_HOST} ^www\\. [NC]",
    `  RewriteRule ^ ${SITIO_FONDO_URL}%{REQUEST_URI} [R=301,L]`,
    "</IfModule>",
    "",
    "<IfModule mod_headers.c>",
  ];

  for (const { key, value } of headersSeguridad({ dev: false })) {
    l.push(`  Header always set ${key} "${value.replace(/"/g, '\\"')}"`);
  }

  l.push(
    "",
    "  # Los assets de Next llevan hash de contenido en el nombre: inmutables.",
    "  # El HTML, en cambio, revalida siempre — si no, un deploy nuevo no se ve.",
    '  SetEnvIf Request_URI "^/_next/static/" FONDO_INMUTABLE=1',
    '  Header always set Cache-Control "public, max-age=31536000, immutable" env=FONDO_INMUTABLE',
    '  Header always set Cache-Control "public, max-age=0, must-revalidate" "expr=%{ENV:FONDO_INMUTABLE} != \'1\' && %{CONTENT_TYPE} =~ m#^text/html#"',
    "</IfModule>",
    "",
    "  # Compresión. Brotli primero: sobre este payload —HTML de ~370 KB más los",
    "  # chunks de Next— rinde bastante mejor que gzip sobre el mismo contenido.",
    "  #",
    "  # ⚠️ Los dos bloques son EXCLUYENTES a propósito. `AddOutputFilterByType`",
    "  # encadena filtros: si mod_brotli y mod_deflate estuvieran los dos activos",
    "  # sobre el mismo tipo, la respuesta saldría comprimida dos veces y ningún",
    "  # navegador podría leerla. De ahí el `<IfModule !mod_brotli.c>` — y de ahí",
    "  # también que esto sea seguro aunque el hosting no tenga Brotli compilado:",
    "  # sin el módulo, el primer bloque es inerte y queda gzip como hasta ahora.",
    "<IfModule mod_brotli.c>",
    "  AddOutputFilterByType BROTLI_COMPRESS text/html text/plain text/css text/xml \\",
    "    application/javascript application/json application/xml image/svg+xml",
    "</IfModule>",
    "<IfModule !mod_brotli.c>",
    "  <IfModule mod_deflate.c>",
    "    AddOutputFilterByType DEFLATE text/html text/plain text/css text/xml \\",
    "      application/javascript application/json application/xml image/svg+xml",
    "  </IfModule>",
    "</IfModule>",
    "",
  );
  return l.join("\n");
}

function armarCpanel(): number {
  fs.rmSync(SALIDA_CPANEL, { recursive: true, force: true });
  fs.cpSync(SALIDA, SALIDA_CPANEL, { recursive: true });

  // Formato de Cloudflare: en Apache no hacen nada y sólo quedarían expuestos.
  for (const f of ["_headers", "_redirects"]) {
    fs.rmSync(path.join(SALIDA_CPANEL, f), { force: true });
  }

  fs.writeFileSync(path.join(SALIDA_CPANEL, ".htaccess"), htaccess());
  fs.copyFileSync(
    path.join(REPO, "deploy", "cpanel", "api.php"),
    path.join(SALIDA_CPANEL, "api.php"),
  );
  return pesar(SALIDA_CPANEL).archivos;
}

function pesar(dir: string): { archivos: number; bytes: number } {
  let archivos = 0;
  let bytes = 0;
  for (const entrada of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entrada.name);
    if (entrada.isDirectory()) {
      const sub = pesar(p);
      archivos += sub.archivos;
      bytes += sub.bytes;
    } else {
      archivos++;
      bytes += fs.statSync(p).size;
    }
  }
  return { archivos, bytes };
}

// ── main ─────────────────────────────────────────────────────────────────────

const rearmar = process.argv.includes("--rearmar");

console.log("BNG Selección Global — sitio estático");
console.log(`· dominio del fondo : ${SITIO_FONDO_URL}`);
console.log(`· dominio de la casa: ${SITIO_CASA_URL}   (destino de los links que salen)`);
console.log(`· indexable         : ${SEO_INDEXABLE ? "sí" : "NO (SEO_INDEXABLE≠1 ⇒ robots.txt bloquea todo)"}`);
console.log(`· build             : ${COPIA}`);

if (!rearmar) {
  console.log("\n▸ copiando el repo…");
  prepararCopia();
  console.log("\n▸ next build (FONDO_STANDALONE=1)…\n");
  correrBuild();
}

console.log("\n▸ armando dist/fondo…");
const assets = armar();

const faltantes = verificar();
if (faltantes.length) {
  console.error("\n✘ Quedaron referencias sin archivo en el deploy:");
  for (const f of faltantes) console.error(`   ${f}`);
  console.error("\n  La página cargaría con módulos muertos. Revisá el barrido de assets.\n");
  process.exit(1);
}

const backtestRoto = verificarBacktest();
if (backtestRoto) {
  console.error(`\n✘ Backtest de la estrategia: ${backtestRoto}\n`);
  process.exit(1);
}

const docsRotos = verificarDocs();
if (docsRotos.length) {
  console.error("\n✘ Documentos del fondo mal publicados:");
  for (const d of docsRotos) console.error(`   ${d}`);
  console.error("\n  Revisá lib/fondoDocsEstaticos.ts contra los archivos de public/documentos/.\n");
  process.exit(1);
}

const { archivos, bytes } = pesar(SALIDA);
console.log(`\n✔ ${SALIDA}`);
console.log(`  ${archivos} archivos · ${(bytes / 1024 / 1024).toFixed(2)} MB`);
console.log(`  ${assets.length} assets referenciados por la página`);

const nCpanel = armarCpanel();
console.log(`\n✔ ${SALIDA_CPANEL}`);
console.log(`  ${nCpanel} archivos · .htaccess + api.php, listo para subir a public_html`);
console.log(
  `  documentos en el deploy: ${DOCS_ESTATICOS.map((d) => d.tipo).join(", ") || "ninguno"}`,
);
