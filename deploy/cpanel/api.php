<?php
// ⚠️ DADO DE BAJA EL 17-ago-2026 — VENTANA DE ROLLBACK, NO CÓDIGO VIVO.
//
// Desde la Fase 2 del plan (docs/plan-consolidacion-fondo.md) la página NO pide
// más `/api/fondo*`: lee `/datos/*.json`, que son archivos estáticos que publica
// el panel de empleados. Nada del sitio nuevo entra por acá.
//
// SIGUE VIAJANDO EN EL DEPLOY A PROPÓSITO, y esto es lo que decide cuándo se
// borra de verdad: el sitio VIVO todavía sirve el build anterior, que sí pide
// `/api/fondo*`. Mientras eso siga así, este archivo y su regla del `.htaccess`
// son la red que sostiene la versión publicada — y también el camino de vuelta
// si el build nuevo tuviera un problema.
//
// BORRAR (junto con la RewriteRule de `htaccess()` en scripts/build-fondo.mts,
// y este archivo del repo) CUANDO SE CUMPLAN LAS DOS:
//   1. el build nuevo lleva ~una semana publicado y sano en el hosting;
//   2. se apagó el worker `bng-fondo-site` y se borró la D1 `bng-fondo`
//      (respaldo en backups/bng-fondo-d1/, verificado restaurable).
// Mientras el worker siga arriba, borrar esto no gana nada y pierde el rollback.
//
// ── Lo que sigue describe cómo funcionaba, y vale mientras esté en pie ───────
//
// POR QUÉ ESTO ES UN PROXY Y NO UNA REIMPLEMENTACIÓN
// La página es HTML estático, pero el valor cuota, las tenencias y los documentos
// salen de la base del fondo (D1 en Cloudflare), que es donde escriben el panel de
// empleados y la ingesta diaria por mail. Este hosting no tiene Node, así que la
// única forma de calcular el snapshot acá sería reescribir en PHP la lógica de
// lib/fondo.ts — rendimientos, estadísticas, alineación con el benchmark. Eso es
// duplicar lógica financiera en un segundo lenguaje, con la garantía de que un día
// los dos números difieren. En vez de eso se consulta al worker, que ya la ejecuta.
//
// El navegador ve todo en el MISMO origen: sin CORS y sin tocar la CSP.
//
// RESILIENCIA
// La respuesta se cachea en disco. Si el upstream falla o tarda, se sirve la copia
// guardada aunque esté vencida — para una página de un fondo, un valor cuota de
// hace unas horas es infinitamente mejor que un error. Sólo si no hay ninguna copia
// se devuelve el error.

declare(strict_types=1);

const UPSTREAM   = 'https://bng-fondo-site.emirod1955.workers.dev';
const CACHE_DIR  = __DIR__ . '/../.cache-fondo';
const TTL_JSON   = 300;   // 5 min, igual que el s-maxage del worker
const TTL_PDF    = 3600;  // los documentos cambian mucho menos
const TIMEOUT    = 8;     // segundos; si tarda más, se sirve lo cacheado

// Los cinco tipos de documento, en lista blanca CERRADA.
//
// ⚠️ ANTES ERA UN REGEX `[a-z0-9-]{1,40}` que delegaba la validación al worker,
// y eso convertía este proxy en un amplificador: cada tipo inventado
// (`/api/fondo/documentos/aaaa`, `aaab`, …) es una clave de caché distinta ⇒
// cache miss ⇒ una consulta saliente NUEVA al worker, con 8 s de timeout. Y como
// sólo se cachean los 200, el 404 del worker no queda guardado y el siguiente
// intento vuelve a salir. O sea: pedidos ilimitados contra el worker de
// Cloudflare —justo el recurso cuyo agotamiento causó el incidente de prod— y
// procesos PHP tomados hasta 8 s cada uno, que en un hosting compartido es el
// cuello de verdad. Con la lista cerrada, un tipo que no existe muere acá.
//
// La lista la reescribe `scripts/build-fondo.mts` desde FONDO_DOC_TIPOS
// (lib/panelSchemas.ts) al armar el deploy, y corta el build si no encuentra el
// marcador: no puede quedar desincronizada del enum.
const TIPOS_DOC = ['ficha-tecnica', 'datos-fundamentales', 'reglamento', 'autorizacion-bcu', 'informe-cartera']; // __TIPOS_DOC__

// Rate limit por IP. Acá REMOTE_ADDR SÍ es la IP real del visitante —Apache es
// el borde, sin CDN delante (verificado 2026-08-13)—, así que a diferencia de la
// app de Next este límite reparte de verdad. Por eso mismo NO se mira
// X-Forwarded-For: sin un proxy propio adelante, ese header lo pone el cliente y
// sería un balde nuevo por pedido.
const RL_DIR     = CACHE_DIR . '/rl';
const RL_MAX     = 120;   // pedidos/hora por IP; una carga de la página usa 2
const RL_VENTANA = 3600;

/** Ruta pedida, normalizada y validada contra la lista blanca de endpoints. */
function rutaPedida(): ?string {
    $path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
    $path = rtrim($path, '/');
    if ($path === '/api/fondo' || $path === '/api/fondo/documentos') {
        return $path;
    }
    if (preg_match('#^/api/fondo/documentos/([a-z0-9-]{1,40})$#', $path, $m) === 1
        && in_array($m[1], TIPOS_DOC, true)) {
        return $path;
    }
    return null;
}

/**
 * Ventana fija por IP, en disco. Devuelve true si hay que rebotar.
 *
 * FAIL-OPEN a propósito: si no se puede abrir o bloquear el archivo, deja pasar.
 * Un limitador que no puede contar no tiene por qué dejar la página del fondo
 * sin valor cuota — el techo de verdad contra el gasto lo pone la caché en
 * disco, esto sólo saca de encima al que martilla.
 */
function limiteExcedido(): bool {
    if (!is_dir(RL_DIR) && !@mkdir(RL_DIR, 0755, true) && !is_dir(RL_DIR)) {
        return false;
    }
    $ip = (string) ($_SERVER['REMOTE_ADDR'] ?? '');
    if ($ip === '') return false;

    $fh = @fopen(RL_DIR . '/' . sha1($ip) . '.rl', 'c+');
    if ($fh === false) return false;
    if (!flock($fh, LOCK_EX)) { fclose($fh); return false; }

    $ahora = time();
    [$inicio, $cuenta] = array_pad(explode(':', trim((string) stream_get_contents($fh))), 2, '0');
    $inicio = (int) $inicio;
    $cuenta = (int) $cuenta;
    if ($ahora - $inicio >= RL_VENTANA) { $inicio = $ahora; $cuenta = 0; }
    $cuenta++;

    ftruncate($fh, 0);
    rewind($fh);
    fwrite($fh, $inicio . ':' . $cuenta);
    fflush($fh);
    flock($fh, LOCK_UN);
    fclose($fh);

    // Barrido oportunista: un pedido de cada 500 limpia los contadores muertos,
    // así el directorio no crece sin techo. Sin cron, que acá no hay.
    if (random_int(1, 500) === 1) {
        foreach (glob(RL_DIR . '/*.rl') ?: [] as $viejo) {
            if ((int) @filemtime($viejo) < $ahora - 2 * RL_VENTANA) @unlink($viejo);
        }
    }

    return $cuenta > RL_MAX;
}

function archivoCache(string $ruta): string {
    return CACHE_DIR . '/' . sha1($ruta) . '.cache';
}

/** Trae la respuesta del worker. Devuelve null si no se pudo. */
function consultarUpstream(string $ruta): ?array {
    $url = UPSTREAM . $ruta;

    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => TIMEOUT,
            CURLOPT_CONNECTTIMEOUT => 5,
            CURLOPT_FOLLOWLOCATION => false,
            CURLOPT_HTTPHEADER     => ['Accept: */*'],
            CURLOPT_HEADER         => true,
        ]);
        $bruto  = curl_exec($ch);
        $codigo = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        $largo  = (int) curl_getinfo($ch, CURLINFO_HEADER_SIZE);
        curl_close($ch);
        if ($bruto === false || $codigo === 0) return null;
        $cabeceras = substr($bruto, 0, $largo);
        $cuerpo    = substr($bruto, $largo);
        preg_match('/^content-type:\s*(.+)$/im', $cabeceras, $m);
        return ['codigo' => $codigo, 'tipo' => trim($m[1] ?? 'application/json'), 'cuerpo' => $cuerpo];
    }

    // Sin curl: fallback a streams. Requiere allow_url_fopen.
    $ctx = stream_context_create(['http' => [
        'timeout' => TIMEOUT,
        'ignore_errors' => true,
        'header' => "Accept: */*\r\n",
    ]]);
    $cuerpo = @file_get_contents($url, false, $ctx);
    if ($cuerpo === false) return null;
    $codigo = 200;
    $tipo = 'application/json';
    foreach ($http_response_header ?? [] as $h) {
        if (preg_match('#^HTTP/\S+\s+(\d{3})#', $h, $m)) $codigo = (int) $m[1];
        if (preg_match('/^content-type:\s*(.+)$/i', $h, $m)) $tipo = trim($m[1]);
    }
    return ['codigo' => $codigo, 'tipo' => $tipo, 'cuerpo' => $cuerpo];
}

function responder(int $codigo, string $tipo, string $cuerpo, int $ttl, bool $stale): void {
    http_response_code($codigo);
    header('Content-Type: ' . $tipo);
    header('Cache-Control: public, max-age=0, s-maxage=' . $ttl . ', stale-while-revalidate=600');
    header('X-Content-Type-Options: nosniff');
    header('Referrer-Policy: strict-origin-when-cross-origin');
    // Rastro para diagnosticar sin abrir logs: si dice stale, el upstream falló.
    header('X-Fondo-Cache: ' . ($stale ? 'stale' : 'fresh'));
    echo $cuerpo;
}

// ── main ─────────────────────────────────────────────────────────────────────

$ruta = rutaPedida();
if ($ruta === null) {
    http_response_code(404);
    header('Content-Type: text/plain; charset=utf-8');
    echo 'No encontrado';
    exit;
}

$metodo = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if ($metodo !== 'GET' && $metodo !== 'HEAD') {
    http_response_code(405);
    header('Allow: GET, HEAD');
    exit;
}

// Después del 404/405 a propósito: la ruta inválida es la respuesta más barata
// que hay y no toca disco; hacerle además una escritura con lock la volvería
// cara justo en el camino que un atacante puede pedir gratis.
if (limiteExcedido()) {
    http_response_code(429);
    header('Retry-After: ' . RL_VENTANA);
    header('Cache-Control: no-store');
    header('Content-Type: application/json');
    echo '{"error":"rate_limited"}';
    exit;
}

$esPdf = str_starts_with($ruta, '/api/fondo/documentos/');
$ttl   = $esPdf ? TTL_PDF : TTL_JSON;
$cache = archivoCache($ruta);

// Copia vigente ⇒ ni se consulta al upstream.
if (is_readable($cache) && (time() - filemtime($cache)) < $ttl) {
    $guardado = unserialize((string) file_get_contents($cache));
    if (is_array($guardado)) {
        responder($guardado['codigo'], $guardado['tipo'], $guardado['cuerpo'], $ttl, false);
        exit;
    }
}

$resp = consultarUpstream($ruta);

// Sólo se cachean las respuestas buenas: un 404 del worker (documento sin
// publicar) no debe quedar congelado cuando el cliente lo publique.
if ($resp !== null && $resp['codigo'] === 200) {
    if (!is_dir(CACHE_DIR)) @mkdir(CACHE_DIR, 0755, true);
    @file_put_contents($cache, serialize($resp), LOCK_EX);
    responder(200, $resp['tipo'], $resp['cuerpo'], $ttl, false);
    exit;
}

// El upstream no respondió o falló: se sirve la copia vencida si existe.
if (is_readable($cache)) {
    $guardado = unserialize((string) file_get_contents($cache));
    if (is_array($guardado)) {
        responder($guardado['codigo'], $guardado['tipo'], $guardado['cuerpo'], 60, true);
        exit;
    }
}

if ($resp !== null) {
    responder($resp['codigo'], $resp['tipo'], $resp['cuerpo'], 60, false);
    exit;
}

http_response_code(503);
header('Content-Type: application/json');
header('Cache-Control: no-store');
echo '{"error":"upstream_unavailable"}';
