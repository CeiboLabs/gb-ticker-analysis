<?php
// Receptor de publicaciones de BNG Selección Global.
//
// QUÉ HACE
// El panel de empleados (home server) manda acá los datos del fondo ya
// calculados, firmados con HMAC. Esto los escribe como archivos estáticos que
// después sirve Apache sin levantar un solo proceso PHP. Reemplaza al proxy
// `api.php`, que consultaba en vivo a un worker de Cloudflare en CADA visita.
//
// La diferencia que importa: acá el PHP corre cuando PUBLICA Adrián —dos o tres
// veces por semana—, no cuando entra un visitante.
//
// POR QUÉ ES SEGURO TENER UN ENDPOINT DE ESCRITURA EN EL SITIO PÚBLICO
// Es la única concesión del diseño, y se acota por capas:
//   · HMAC-SHA256 sobre (timestamp + artefacto + hash del cuerpo), comparado con
//     hash_equals (tiempo constante);
//   · ventana de 5 minutos: un POST capturado no sirve mañana;
//   · el artefacto entra por CABECERA y se valida contra una lista CERRADA. El
//     nombre del archivo destino sale de esa lista, NUNCA del cuerpo ni de un
//     parámetro — no hay camino de un payload a una ruta de disco;
//   · tope de tamaño, y el JSON tiene que parsear antes de tocar el disco;
//   · el secreto vive FUERA de public_html.
//
// ESCRITURA ATÓMICA
// tmp + rename(): un visitante nunca puede leer medio archivo. Si el POST se
// corta, el archivo viejo sigue entero — que es exactamente lo que se quiere de
// un valor cuota.

declare(strict_types=1);

// El secreto, FUERA de public_html. Un archivo de una línea, chmod 600. Si el
// hosting expusiera .php como texto por una mala config, acá no hay nada.
const SECRETO_ARCHIVO = __DIR__ . '/../.publicar-secret';

// Dónde aterriza lo publicado. NUNCA está en dist/ — así una subida del sitio no
// puede pisar los datos que cargó Adrián. El .htaccess sirve de acá si existe y
// cae a _seed/ (que sí viaja en el deploy) si no.
const DESTINO   = __DIR__ . '/publicado';
const MAX_BYTES = 16 * 1024 * 1024;  // el tope de PDF del panel es 15 MB
const VENTANA   = 300;               // segundos de tolerancia del timestamp

// Los cinco tipos de documento, en lista blanca CERRADA. La reescribe
// `scripts/build-fondo.mts` desde FONDO_DOC_TIPOS (lib/panelSchemas.ts) al armar
// el deploy, y corta el build si no encuentra el marcador.
const TIPOS_DOC = ['ficha-tecnica', 'datos-fundamentales', 'reglamento', 'autorizacion-bcu', 'informe-cartera']; // __TIPOS_DOC__

/** Responde y corta. */
function fin(int $codigo, string $error = ''): never {
    http_response_code($codigo);
    header('Content-Type: application/json');
    header('Cache-Control: no-store');
    echo $error === '' ? '{"ok":true}' : json_encode(['error' => $error]);
    exit;
}

/**
 * Ruta destino del artefacto, o null si no está en la lista.
 *
 * ⚠️ ACÁ SE DECIDE EL NOMBRE DEL ARCHIVO, y por eso no acepta nada que no sea
 * un literal conocido: `doc:<tipo>` sólo pasa si <tipo> está en TIPOS_DOC. No
 * hay concatenación de entrada del usuario en una ruta.
 */
function destinoDe(string $art): ?string {
    if ($art === 'fondo')      return DESTINO . '/fondo.json';
    if ($art === 'documentos') return DESTINO . '/documentos.json';
    if (str_starts_with($art, 'doc:')) {
        $tipo = substr($art, 4);
        if (in_array($tipo, TIPOS_DOC, true)) return DESTINO . '/docs/' . $tipo . '.pdf';
    }
    return null;
}

/** Escritura atómica: tmp en el MISMO directorio (rename cruzando fs no es atómico) + rename. */
function escribirAtomico(string $destino, string $contenido): bool {
    $dir = dirname($destino);
    if (!is_dir($dir) && !@mkdir($dir, 0755, true) && !is_dir($dir)) return false;
    $tmp = $destino . '.tmp' . bin2hex(random_bytes(6));
    if (@file_put_contents($tmp, $contenido, LOCK_EX) !== strlen($contenido)) {
        @unlink($tmp);
        return false;
    }
    @chmod($tmp, 0644);
    if (!@rename($tmp, $destino)) {
        @unlink($tmp);
        return false;
    }
    return true;
}

// ── main ─────────────────────────────────────────────────────────────────────

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
    header('Allow: POST');
    fin(405, 'metodo');
}

// Fail-closed: sin secreto configurado no se publica nada. Un receptor que
// aceptara cualquier cosa porque le falta la config es peor que uno caído.
$secreto = is_readable(SECRETO_ARCHIVO) ? trim((string) file_get_contents(SECRETO_ARCHIVO)) : '';
if (strlen($secreto) < 32) fin(503, 'sin_secreto');

$ts  = (int) ($_SERVER['HTTP_X_BNG_TS']  ?? 0);
$art = (string) ($_SERVER['HTTP_X_BNG_ART'] ?? '');
$sig = (string) ($_SERVER['HTTP_X_BNG_SIG'] ?? '');
if ($ts <= 0 || $art === '' || $sig === '') fin(400, 'cabeceras');

// Ventana en LOS DOS SENTIDOS: un reloj adelantado en el emisor no puede
// fabricarse una firma con validez extendida hacia el futuro.
if (abs(time() - $ts) > VENTANA) fin(408, 'ts_fuera_de_ventana');

$destino = destinoDe($art);
if ($destino === null) fin(400, 'artefacto');

$cuerpo = (string) file_get_contents('php://input');
if ($cuerpo === '' || strlen($cuerpo) > MAX_BYTES) fin(413, 'cuerpo');

// La firma cubre el artefacto: una firma válida sirve para UN destino y no para
// otro. El orden importa — se verifica ANTES de mirar el contenido.
$esperada = hash_hmac('sha256', $ts . "\n" . $art . "\n" . hash('sha256', $cuerpo), $secreto);
if (!hash_equals($esperada, $sig)) fin(403, 'firma');

// Recién con la firma verificada se mira qué es. Los JSON tienen que parsear:
// publicar un fondo.json roto dejaría la página sin datos hasta la próxima
// publicación, y eso se detecta acá o no se detecta nunca.
if ($art === 'fondo' || $art === 'documentos') {
    $json = json_decode($cuerpo, true);
    if (!is_array($json)) fin(422, 'json_invalido');
    if ($art === 'fondo' && !array_key_exists('status', $json)) fin(422, 'json_sin_status');
    if ($art === 'documentos' && !array_key_exists('documentos', $json)) fin(422, 'json_sin_documentos');
} else {
    // PDF: se comprueba el magic number, igual que hace lib/pdfUpload.ts al
    // recibirlo en el panel. Que haya pasado por dos validaciones no sobra —
    // esta es la que protege al archivo que descarga el visitante.
    if (substr($cuerpo, 0, 5) !== '%PDF-') fin(422, 'pdf_invalido');
}

if (!escribirAtomico($destino, $cuerpo)) fin(500, 'escritura');

fin(200);
