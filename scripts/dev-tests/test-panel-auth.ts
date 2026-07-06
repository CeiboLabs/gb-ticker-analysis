// Tests del núcleo criptográfico del panel (lib/panelCrypto).
// Correr:  npx tsx scripts/dev-tests/test-panel-auth.ts
// Puro, sin red ni D1 — WebCrypto es global en Node 20, igual que en el edge.

// El pepper se setea ANTES de usar cualquier función (el módulo lo lee lazy,
// por llamada — no en el init — así que el hoisting del import no molesta).
process.env.PANEL_PEPPER = "test-pepper-0123456789abcdef";
process.env.PANEL_PBKDF2_ITERS = "50000"; // barato para el test, formato idéntico

import {
  b64u,
  b64uDecode,
  base32Encode,
  base32Decode,
  totpCode,
  verifyTotp,
  TOTP_STEP_MS,
  hashPassword,
  verifyPassword,
  needsRehash,
  dummyPasswordHash,
  encryptSecret,
  decryptSecret,
  timingSafeEqual,
} from "../../lib/panelCrypto";

let pass = 0;
let fail = 0;
function check(name: string, cond: boolean) {
  if (cond) { pass++; }
  else { fail++; console.error(`  ✗ ${name}`); }
}

async function main() {
  // ── base64url / base32 ─────────────────────────────────────────────────────
  {
    const bytes = new Uint8Array([0, 1, 2, 250, 251, 252, 253, 254, 255]);
    const back = b64uDecode(b64u(bytes));
    check("b64u roundtrip", !!back && back.length === bytes.length && back.every((v, i) => v === bytes[i]));
    check("b64u sin padding ni +/", !/[+/=]/.test(b64u(bytes)));
  }
  {
    const ascii = new TextEncoder().encode("12345678901234567890");
    check("base32 vector RFC (secret de prueba)", base32Encode(ascii) === "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ");
    const back = base32Decode("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ");
    check("base32 roundtrip", !!back && new TextDecoder().decode(back) === "12345678901234567890");
    check("base32 rechaza alfabeto inválido", base32Decode("ABC018") === null);
  }

  // ── TOTP: vectores oficiales RFC 6238 Apéndice B (SHA-1, 6 dígitos) ───────
  {
    const SECRET = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
    const vectors: Array<[number, string]> = [
      [59, "287082"],
      [1111111109, "081804"],
      [1111111111, "050471"],
      [1234567890, "005924"],
      [2000000000, "279037"],
      [20000000000, "353130"],
    ];
    for (const [tSec, expected] of vectors) {
      const step = Math.floor((tSec * 1000) / TOTP_STEP_MS);
      check(`totp vector T=${tSec}`, (await totpCode(SECRET, step)) === expected);
    }

    // Ventana y anti-replay.
    const nowMs = 1111111111 * 1000; // step 37037037 → código 050471
    check("verifyTotp acepta código vigente", (await verifyTotp(SECRET, "050471", 0, nowMs)).ok);
    {
      const prev = await verifyTotp(SECRET, "081804", 0, nowMs); // step 37037036 (−1)
      check("verifyTotp acepta step −1 (skew)", prev.ok && prev.step === 37037036);
    }
    {
      const next = await totpCode(SECRET, 37037038);
      check("verifyTotp acepta step +1 (skew)", (await verifyTotp(SECRET, next, 0, nowMs)).ok);
    }
    {
      const old = await totpCode(SECRET, 37037035); // step −2, fuera de ventana
      check("verifyTotp rechaza fuera de ventana", !(await verifyTotp(SECRET, old, 0, nowMs)).ok);
    }
    {
      // ANTI-REPLAY: el mismo código no entra dos veces (lastUsedStep avanzó).
      const first = await verifyTotp(SECRET, "050471", 0, nowMs);
      const replay = first.ok ? await verifyTotp(SECRET, "050471", first.step, nowMs) : { ok: true as const, step: 0 };
      check("verifyTotp rechaza replay del mismo step", first.ok && !replay.ok);
    }
    check("verifyTotp rechaza formato no-6-dígitos", !(await verifyTotp(SECRET, "05047", 0, nowMs)).ok);
    check("verifyTotp rechaza código con letras", !(await verifyTotp(SECRET, "05047a", 0, nowMs)).ok);
  }

  // ── Contraseñas: PBKDF2 + pepper ───────────────────────────────────────────
  {
    const hash = await hashPassword("correcto caballo batería grapa");
    check("hash con formato autodescriptivo", hash.startsWith("pbkdf2-sha256$50000$"));
    check("verify acepta la contraseña correcta", await verifyPassword("correcto caballo batería grapa", hash));
    check("verify rechaza contraseña incorrecta", !(await verifyPassword("otra contraseña", hash)));
    check("verify rechaza hash truncado", !(await verifyPassword("x", "pbkdf2-sha256$50000$abc")));
    check("verify rechaza algoritmo desconocido", !(await verifyPassword("x", hash.replace("pbkdf2-sha256", "md5"))));
    check("needsRehash=false para hash fresco", !needsRehash(hash));

    const legacy = await hashPassword("correcto caballo batería grapa", 20_000);
    check("verify acepta hash con iteraciones viejas (params de la fila)", await verifyPassword("correcto caballo batería grapa", legacy));
    check("needsRehash=true si difiere del costo objetivo", needsRehash(legacy));

    // El pepper participa de verdad: con otro pepper, el mismo hash no verifica.
    const before = process.env.PANEL_PEPPER;
    process.env.PANEL_PEPPER = "otro-pepper-9876543210fedcba";
    check("verify falla con pepper rotado", !(await verifyPassword("correcto caballo batería grapa", hash)));
    process.env.PANEL_PEPPER = before;

    const dummy = await dummyPasswordHash();
    check("hash señuelo nunca verifica", !(await verifyPassword("cualquier cosa", dummy)));
  }

  // ── Cifrado at-rest del secret TOTP ────────────────────────────────────────
  {
    const enc = await encryptSecret("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ");
    check("encrypt con formato enc$iv$ct", enc.startsWith("enc$"));
    check("decrypt roundtrip", (await decryptSecret(enc)) === "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ");
    const enc2 = await encryptSecret("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ");
    check("IV aleatorio (dos cifrados difieren)", enc !== enc2);

    const tampered = enc.slice(0, -2) + (enc.endsWith("aa") ? "bb" : "aa");
    check("decrypt rechaza ciphertext adulterado (GCM)", (await decryptSecret(tampered)) === null);
    check("decrypt rechaza formato inválido", (await decryptSecret("no-es-un-secret")) === null);

    const before = process.env.PANEL_PEPPER;
    process.env.PANEL_PEPPER = "otro-pepper-9876543210fedcba";
    check("decrypt devuelve null con pepper rotado", (await decryptSecret(enc)) === null);
    process.env.PANEL_PEPPER = before;
  }

  // ── Comparación constant-time (sanidad funcional) ──────────────────────────
  {
    check("timingSafeEqual iguales", timingSafeEqual("123456", "123456"));
    check("timingSafeEqual distintos", !timingSafeEqual("123456", "123457"));
    check("timingSafeEqual largos distintos", !timingSafeEqual("123456", "12345"));
  }

  // ── Fail-closed sin pepper ─────────────────────────────────────────────────
  {
    const before = process.env.PANEL_PEPPER;
    delete process.env.PANEL_PEPPER;
    let threw = false;
    try {
      await hashPassword("lo que sea");
    } catch {
      threw = true;
    }
    check("hashPassword lanza sin PANEL_PEPPER (fail-closed)", threw);
    process.env.PANEL_PEPPER = before;
  }

  console.log(`\n${pass} ok, ${fail} fallas`);
  if (fail > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
