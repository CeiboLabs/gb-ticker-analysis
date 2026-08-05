<?php
// Endpoints de datos de BNG Selección Global, servidos desde el hosting cPanel.
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

/** Ruta pedida, normalizada y validada contra la lista blanca de endpoints. */
function rutaPedida(): ?string {
    $path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
    $path = rtrim($path, '/');
    if ($path === '/api/fondo' || $path === '/api/fondo/documentos') {
        return $path;
    }
    // /api/fondo/documentos/<tipo> — el tipo lo valida el worker contra su enum;
    // acá sólo se acota la forma para no reenviar cualquier cosa.
    if (preg_match('#^/api/fondo/documentos/[a-z0-9-]{1,40}$#', $path) === 1) {
        return $path;
    }
    return null;
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
