// Publicador del fondo: firma, huella del estado y decisión de qué re-subir.
//
// La prueba que de verdad importa es la ÚLTIMA: que el HMAC que calcula el
// panel en TypeScript sea byte a byte el que verifica `publicar.php`. Son dos
// lenguajes, dos librerías de crypto y una cadena canónica escrita a mano en
// cada lado — exactamente la clase de acuerdo que se rompe en silencio y sólo
// se descubre en producción, con el panel diciendo "403 firma" y nadie sabiendo
// de qué lado está el error.

import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  artefactoDoc,
  cabecerasPublicacion,
  cadenaFirma,
  docsASubir,
  hmacHex,
  huellaDoc,
  huellaEstado,
  parseRegistro,
  sha256Bytes,
  type EstadoPublicable,
} from "./fondoPublicar";

const SECRETO = "un-secreto-de-prueba-de-al-menos-32-caracteres";
const te = new TextEncoder();

test("la cadena firmada incluye el artefacto, no sólo el cuerpo", () => {
  // Si el artefacto no entrara, una firma válida para un PDF serviría para
  // escribir ese mismo cuerpo en cualquier otro destino.
  const a = cadenaFirma(1000, "fondo", "abc");
  const b = cadenaFirma(1000, "documentos", "abc");
  assert.notEqual(a, b);
  assert.equal(a, "1000\nfondo\nabc");
});

test("artefactoDoc arma el id del documento", () => {
  assert.equal(artefactoDoc("reglamento"), "doc:reglamento");
});

test("cabecerasPublicacion firma el cuerpo que se manda", async () => {
  const cuerpo = te.encode('{"status":"pre-launch"}');
  const h = await cabecerasPublicacion(SECRETO, "fondo", cuerpo, 1700000000);
  assert.equal(h["X-BNG-Ts"], "1700000000");
  assert.equal(h["X-BNG-Art"], "fondo");
  assert.equal(h["Content-Type"], "application/json");
  assert.equal(h["X-BNG-Sig"], await hmacHex(SECRETO, cadenaFirma(1700000000, "fondo", await sha256Bytes(cuerpo))));
});

test("un PDF viaja como application/pdf", async () => {
  const h = await cabecerasPublicacion(SECRETO, artefactoDoc("reglamento"), te.encode("%PDF-1.7"), 1);
  assert.equal(h["Content-Type"], "application/pdf");
});

// ── Huella del estado ────────────────────────────────────────────────────────

const ESTADO: EstadoPublicable = {
  fondo: '{"status":"pre-launch"}',
  documentos: '{"documentos":[]}',
  docs: { reglamento: huellaDoc("reglamento", 1234, 999) },
};

test("la huella cambia si cambia cualquiera de las partes", async () => {
  const base = await huellaEstado(ESTADO);
  assert.notEqual(base, await huellaEstado({ ...ESTADO, fondo: '{"status":"live"}' }));
  assert.notEqual(base, await huellaEstado({ ...ESTADO, documentos: '{"documentos":[1]}' }));
  assert.notEqual(
    base,
    await huellaEstado({ ...ESTADO, docs: { reglamento: huellaDoc("reglamento", 1235, 999) } }),
  );
});

test("la huella NO depende del orden de las claves de docs", async () => {
  // Si dependiera, el panel diría "hay cambios sin publicar" cada vez que la
  // base devolviera los documentos en otro orden.
  const a = await huellaEstado({ ...ESTADO, docs: { a: "1", b: "2" } });
  const b = await huellaEstado({ ...ESTADO, docs: { b: "2", a: "1" } });
  assert.equal(a, b);
});

test("huellaDoc cambia con el largo y con la fecha", () => {
  assert.notEqual(huellaDoc("x", 10, 1), huellaDoc("x", 11, 1));
  assert.notEqual(huellaDoc("x", 10, 1), huellaDoc("x", 10, 2));
});

// ── Qué se re-sube ───────────────────────────────────────────────────────────

test("sólo se re-suben los PDF que cambiaron", () => {
  const actual = { a: "a:1:1", b: "b:2:2", c: "c:3:3" };
  const publicado = { a: "a:1:1", b: "b:9:9" };
  // `a` está igual ⇒ no viaja. `b` cambió y `c` nunca se subió ⇒ viajan.
  assert.deepEqual(docsASubir(actual, publicado), ["b", "c"]);
});

test("sin nada publicado, viajan todos", () => {
  assert.deepEqual(docsASubir({ a: "1", b: "2" }, {}), ["a", "b"]);
});

// ── Registro de la última publicación ────────────────────────────────────────

test("parseRegistro acepta lo que escribe el publicador", () => {
  const r = parseRegistro('{"version":3,"huella":"abc","docs":{"reglamento":"reglamento:1:2"}}');
  assert.deepEqual(r, { version: 3, huella: "abc", docs: { reglamento: "reglamento:1:2" } });
});

test("parseRegistro devuelve null con basura en vez de tirar", () => {
  // Lo mismo que parseGeoTarget: esto sale de la base y no puede voltear el panel.
  for (const b of [null, "", "{", "[]", 42, {}, '{"version":"3","huella":"a"}', '{"huella":"a"}']) {
    assert.equal(parseRegistro(b), null, `debería ser null: ${JSON.stringify(b)}`);
  }
});

// ── El acuerdo con el PHP ────────────────────────────────────────────────────

function hayPhp(): boolean {
  try {
    execFileSync("php", ["-v"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

test(
  "el HMAC de TypeScript es el que verifica publicar.php",
  { skip: hayPhp() ? false : "php no está instalado en esta máquina" },
  async () => {
    const ts = 1700000000;
    const cuerpo = te.encode('{"status":"pre-launch","holdings":null}');
    const art = "doc:reglamento";

    const enTs = (await cabecerasPublicacion(SECRETO, art, cuerpo, ts))["X-BNG-Sig"];

    // La MISMA expresión que está en publicar.php, línea por línea. Si alguien
    // cambia la cadena canónica de un lado, esto se pone rojo.
    const php = `<?php
      $cuerpo = file_get_contents('php://stdin');
      echo hash_hmac('sha256', ${ts} . "\\n" . ${JSON.stringify(art)} . "\\n" . hash('sha256', $cuerpo), ${JSON.stringify(SECRETO)});`;
    const enPhp = execFileSync("php", ["-r", php.replace(/^\s*<\?php\s*/, "")], {
      input: Buffer.from(cuerpo),
      encoding: "utf8",
    });

    assert.equal(enTs, enPhp.trim());
  },
);
