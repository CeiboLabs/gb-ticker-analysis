// Rate limiter: los gates que NO se pueden saltear.
//
// Lo que se fija acá es el comportamiento SIN IP, que es el que se rompió solo:
// `trustedClientIp` sólo confía en `cf-connecting-ip`, así que fuera de
// Cloudflare devuelve null — y con null, `checkPublicGetLimit` y
// `checkFailedAuthLimit` devolvían allowed:true, o sea que el límite entero
// desaparecía en silencio justo donde más falta hace (el home server: Tailscale
// Funnel ni siquiera expone la IP pública del visitante al backend,
// tailscale/tailscale#12972). Un test que sólo probara el camino CON IP habría
// pasado en verde con el agujero abierto.
//
// Sin binding de D1, `checkDurable` cae al contador en memoria: alcanza para
// probar la lógica de ventanas y de baldes, que es lo que se está fijando.

import { test } from "node:test";
import assert from "node:assert/strict";

// Los límites se leen a nivel de módulo, así que el env va ANTES del import —
// y el import tiene que ser DIFERIDO: tsx transforma a CJS y ahí el await de
// nivel superior no compila. Estas asignaciones corren al cargar el archivo,
// mucho antes de que el primer test dispare el import().
process.env.RATE_LIMIT_DOWNLOAD_IP_MAX = "3";
process.env.RATE_LIMIT_DOWNLOAD_GLOBAL_MAX = "5";
process.env.RATE_LIMIT_NOIP_AUTH_MAX = "4";
process.env.PUBLIC_LIMIT_NOIP_FACTOR = "2";

let modulo: typeof import("./rateLimiter") | null = null;
async function rl() {
  modulo ??= await import("./rateLimiter");
  return modulo;
}

test("checkPublicGetLimit sin IP ya no es barra libre: cae al balde compartido", async () => {
  const { checkPublicGetLimit } = await rl();
  // max 2 × factor 2 = 4 permitidos, el quinto rebota.
  const pedir = () => checkPublicGetLimit("t-noip", null, 2);
  for (let i = 1; i <= 4; i++) {
    assert.equal(pedir().allowed, true, `el pedido ${i} tendría que pasar`);
  }
  const rebotado = pedir();
  assert.equal(rebotado.allowed, false, "sin IP el gate TIENE que terminar cortando");
  assert.ok(rebotado.retryAfter > 0, "un 429 sin Retry-After no le sirve a nadie");
});

test("checkPublicGetLimit con IP usa el cupo individual, no el compartido", async () => {
  const { checkPublicGetLimit } = await rl();
  const pedir = () => checkPublicGetLimit("t-conip", "203.0.113.7", 2);
  assert.equal(pedir().allowed, true);
  assert.equal(pedir().allowed, true);
  assert.equal(pedir().allowed, false, "con IP el techo es `max`, sin multiplicar");
});

test("checkPublicGetLimit reparte por IP: una IP quemada no arrastra a la otra", async () => {
  const { checkPublicGetLimit } = await rl();
  assert.equal(checkPublicGetLimit("t-reparto", "198.51.100.1", 1).allowed, true);
  assert.equal(checkPublicGetLimit("t-reparto", "198.51.100.1", 1).allowed, false);
  assert.equal(
    checkPublicGetLimit("t-reparto", "198.51.100.2", 1).allowed,
    true,
    "el balde es por IP; el vecino no tiene por qué pagar",
  );
});

test("checkFailedAuthLimit sin IP ya no deja el lockout apagado", async () => {
  const { checkFailedAuthLimit } = await rl();
  const pedir = () => checkFailedAuthLimit(null, 999, "t-auth");
  for (let i = 1; i <= 4; i++) {
    assert.equal((await pedir()).allowed, true, `el intento ${i} tendría que pasar`);
  }
  assert.equal(
    (await pedir()).allowed,
    false,
    "sin IP el gate cae al balde compartido, no a allowed:true",
  );
});

test("checkDownloadLimit: techo por IP, techo global, y el rebotado no paga el global", async () => {
  // Un solo test para los dos techos porque comparten el contador `dl:all`:
  // partirlo en varios los haría depender del orden de ejecución.
  //
  // Config: 3 por IP, 5 global.
  const { checkDownloadLimit } = await rl();
  const a = "192.0.2.10";
  const b = "192.0.2.20";

  for (let i = 1; i <= 3; i++) {
    const g = await checkDownloadLimit("t-dl", a);
    assert.equal(g.allowed, true, `descarga ${i} de la IP a`);
  }

  // La 4ª de `a` rebota por su propio cupo — y NO tiene que consumir global.
  const cuarta = await checkDownloadLimit("t-dl", a);
  assert.equal(cuarta.allowed, false, "la 4ª de la misma IP rebota");
  assert.equal(cuarta.global, false, "rebotó por cupo propio, no por el techo global");

  // Global lleva 3 consumidos. Si el rebote de arriba lo hubiera consumido,
  // `b` sólo llegaría a una descarga antes de tropezar: éste es el assert que
  // prueba que el global se consulta DESPUÉS del gate por IP.
  assert.equal((await checkDownloadLimit("t-dl", b)).allowed, true, "b, descarga 1 (global 4)");
  assert.equal((await checkDownloadLimit("t-dl", b)).allowed, true, "b, descarga 2 (global 5)");

  const saturado = await checkDownloadLimit("t-dl", b);
  assert.equal(saturado.allowed, false, "al llegar a 5 corta el techo global");
  assert.equal(
    saturado.global,
    true,
    "tiene que marcarse como global para que el caller responda 503 y no 429",
  );
});

test("checkDownloadLimit sin IP se apoya sólo en el techo global", async () => {
  // `dl:all` ya está saturado por el test anterior, que es justamente la
  // situación a fijar: sin IP no hay balde propio donde refugiarse.
  const { checkDownloadLimit } = await rl();
  const g = await checkDownloadLimit("t-dl-noip", null);
  assert.equal(g.allowed, false);
  assert.equal(g.global, true, "sin IP el único techo posible es el global");
});
