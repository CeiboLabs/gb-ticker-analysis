"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { AnalisisLanding } from "./AnalisisLanding";
import { AnalisisReporte } from "./AnalisisReporte";

/**
 * /analisis es UNA sola ruta con dos caras, según haya `?ticker=`:
 *   ·  sin ticker  → la landing (marketing, indexable)
 *   ·  con ticker  → el reporte por-acción (noindex, lo marca generateMetadata)
 *
 * El reporte se monta/desmonta al aparecer/desaparecer el ticker en la URL, así
 * queda aislado de la landing y arranca limpio en cada acción nueva. Los cambios
 * de ticker DENTRO del reporte usan history.pushState propio (no tocan este
 * switch), de modo que no remontan el árbol — sólo la transición landing↔reporte
 * lo hace. useSearchParams exige un Suspense boundary (ver docs de Next).
 */
function AnalisisSwitchInner() {
  const ticker = useSearchParams().get("ticker");
  return ticker ? <AnalisisReporte /> : <AnalisisLanding />;
}

export function AnalisisSwitch() {
  return (
    <Suspense fallback={<div style={{ paddingTop: "var(--nav-h)" }} />}>
      <AnalisisSwitchInner />
    </Suspense>
  );
}
