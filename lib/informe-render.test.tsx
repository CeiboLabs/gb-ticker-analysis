// Render smoke-tests: los bloques de datos que autocompleta el semanal (LRM,
// mini-tabla dólar/UI, retornos con "s/d") pasados por sus renderers reales →
// HTML. Cierra el seam data→UI sin depender del panel ni de auth. Determinista
// (bloques sintéticos, sin red). Los renderers sólo tienen imports de tipo `@/`
// (se borran en runtime), así que renderizan fuera de Next.

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { RetornosGrid } from "../components/institucional/informe/RetornosGrid";
import { TablaDatos } from "../components/institucional/informe/TablaDatos";
import { LineaTiempo } from "../components/institucional/informe/LineaTiempo";

const h = React.createElement;

describe("render · bloques de datos (data → HTML)", () => {
  it("RetornosGrid muestra los faltantes como «s/d» y NO los esconde", () => {
    const html = renderToStaticMarkup(
      h(RetornosGrid, {
        titulo: "Retornos · región",
        grupos: [
          { nombre: "Índices", datos: [{ etiqueta: "IPC MEX", valor: 0.53 }], faltantes: ["CHILE SLCT", "COLOM COL"] },
        ],
        nota: "Variación semanal. «s/d» = sin fuente automática; completar a mano.",
      }),
    );
    assert.match(html, /IPC MEX/);
    assert.match(html, /\+0,53/); // valor con signo y coma decimal
    assert.match(html, /CHILE SLCT/); // el faltante aparece…
    assert.match(html, /COLOM COL/);
    assert.match(html, /s\/d/); // …marcado s/d, no descartado
  });

  it("TablaDatos (LRM) renderiza plazo y tasa con sufijo %", () => {
    const html = renderToStaticMarkup(
      h(TablaDatos, {
        titulo: "Tasas de corte · LRM",
        columnas: [{ titulo: "Plazo (días)" }, { titulo: "Tasa", sufijo: " %" }],
        filas: [
          [34, 5.8],
          [161, 5.9],
        ],
      }),
    );
    assert.match(html, /Tasas de corte · LRM/);
    assert.match(html, />34</); // plazo entero, sin decimales ni sufijo
    assert.match(html, /5,80 %/); // tasa con coma + sufijo
  });

  it("TablaDatos (dólar/UI) colorea los delta y deja pasar «s/d» como texto", () => {
    const html = renderToStaticMarkup(
      h(TablaDatos, {
        titulo: "Dólar y Unidad Indexada · retorno",
        columnas: [{ titulo: "Ventana" }, { titulo: "USD", delta: true }, { titulo: "UI", delta: true }],
        filas: [
          ["Período", -0.24, 9.03],
          ["1 año", "s/d", 3.96],
        ],
      }),
    );
    assert.match(html, /Período/);
    assert.match(html, /0,24 %/); // delta USD negativo formateado
    assert.match(html, /9,03 %/);
    assert.match(html, /s\/d/); // string en columna delta pasa tal cual
  });

  it("LineaTiempo emite un SVG con path para la serie", () => {
    const puntos = Array.from({ length: 40 }, (_, i) => ({
      t: `2026-0${1 + Math.floor(i / 20)}-${String((i % 20) + 1).padStart(2, "0")}`,
      v: 100 + Math.sin(i / 3) * 5,
    }));
    const html = renderToStaticMarkup(
      h(LineaTiempo, { titulo: "USD", lineas: [{ nombre: "USD", enfasis: "primaria", puntos }] }),
    );
    assert.match(html, /<svg/);
    assert.match(html, /<path/);
  });
});
