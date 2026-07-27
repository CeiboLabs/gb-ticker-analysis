// Pruebas de la capa 1 de validación de correo (lógica pura, sin red).
//   npm test
//
// El foco está en los FALSOS POSITIVOS del corrector de typos: decirle a alguien
// que su propia dirección está mal escrita es peor que dejar pasar un typo, así
// que la mitad de los casos de acá son direcciones legítimas que NO se deben
// tocar.

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isDisposableDomain, splitEmail, suggestEmailTypo } from "./emailValidation";

describe("splitEmail", () => {
  it("separa local y dominio, normalizando el dominio", () => {
    assert.deepEqual(splitEmail("Pepe@GMAIL.com"), { local: "Pepe", domain: "gmail.com" });
  });

  it("tolera un + en la parte local y arrobas en el local citado", () => {
    assert.deepEqual(splitEmail("pepe+bolsa@gmail.com"), { local: "pepe+bolsa", domain: "gmail.com" });
  });

  it("devuelve null si no tiene forma de dirección", () => {
    for (const malo of ["pepe", "@gmail.com", "pepe@", ""]) {
      assert.equal(splitEmail(malo), null, malo);
    }
  });
});

describe("isDisposableDomain", () => {
  it("reconoce los desechables comunes, sin importar mayúsculas", () => {
    assert.ok(isDisposableDomain("mailinator.com"));
    assert.ok(isDisposableDomain("YOPMAIL.com"));
    assert.ok(isDisposableDomain("guerrillamail.net"));
  });

  it("no marca dominios legítimos", () => {
    for (const d of ["gmail.com", "adinet.com.uy", "gbengochea.com.uy", "santander.com.uy"]) {
      assert.equal(isDisposableDomain(d), false, d);
    }
  });
});

describe("suggestEmailTypo — corrige", () => {
  const casos: [string, string][] = [
    ["pepe@gmial.com", "pepe@gmail.com"],
    ["pepe@gmai.com", "pepe@gmail.com"],
    ["pepe@gmail.co", "pepe@gmail.com"],
    ["pepe@gmail.con", "pepe@gmail.com"],
    ["pepe@hotmial.com", "pepe@hotmail.com"],
    ["pepe@hotmai.com", "pepe@hotmail.com"],
    ["pepe@outlok.com", "pepe@outlook.com"],
    ["pepe@yahooo.com", "pepe@yahoo.com"],
    ["pepe@adinet.com.py", "pepe@adinet.com.uy"],
  ];
  for (const [entrada, esperado] of casos) {
    it(`${entrada} → ${esperado}`, () => {
      assert.equal(suggestEmailTypo(entrada), esperado);
    });
  }

  it("conserva la parte local tal cual", () => {
    assert.equal(suggestEmailTypo("Maria.Perez+bng@gmial.com"), "Maria.Perez+bng@gmail.com");
  });
});

describe("suggestEmailTypo — NO toca lo que está bien", () => {
  it("deja pasar los dominios frecuentes", () => {
    for (const d of ["gmail.com", "hotmail.com", "outlook.com", "adinet.com.uy", "icloud.com"]) {
      assert.equal(suggestEmailTypo(`pepe@${d}`), null, d);
    }
  });

  it("no confunde vecinos legítimos entre sí", () => {
    // A un dígito de gmail.com / a dos de icloud.com: son proveedores reales y
    // sugerirles corrección sería decirles que su dirección está mal.
    for (const d of ["mail.com", "ymail.com", "me.com", "aol.com", "zoho.com"]) {
      assert.equal(suggestEmailTypo(`pepe@${d}`), null, d);
    }
  });

  it("no toca dominios corporativos o desconocidos", () => {
    for (const d of ["gbengochea.com.uy", "bcu.gub.uy", "empresa-rara.io", "acme.com"]) {
      assert.equal(suggestEmailTypo(`pepe@${d}`), null, d);
    }
  });

  it("no propone corrección para un desechable (ése se rechaza, no se corrige)", () => {
    assert.equal(suggestEmailTypo("pepe@mailinator.com"), null);
  });

  it("no rompe con entradas basura", () => {
    for (const malo of ["", "pepe", "pepe@", "@gmail.com"]) {
      assert.equal(suggestEmailTypo(malo), null, malo);
    }
  });
});
