"use client";

import { useEffect, useState } from "react";
import type { UltimoInforme } from "@/lib/ultimoInforme";

// Lectura de /api/informes/ultimo para el destacado de "Research" del navbar.
// Cachea la promesa a nivel de módulo, como useFondo/useYoutube.
//
// Devuelve `UltimoInforme | null` en vez del state union de sus hermanos porque
// acá cargando, error y sin-informes se ven IGUAL: la carta queda con su texto
// de archivo ("Lecturas de la mesa"). Nada que distinguir.

let cached: Promise<UltimoInforme | null> | null = null;

function load(): Promise<UltimoInforme | null> {
  if (!cached) {
    cached = fetch("/api/informes/ultimo", { headers: { Accept: "application/json" } })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("bad status"))))
      .then((d: { informe: UltimoInforme | null }) => d.informe ?? null)
      .catch((e) => {
        cached = null; // permitir reintento en el próximo montaje
        throw e;
      });
  }
  return cached;
}

export function useUltimoInforme(): UltimoInforme | null {
  const [informe, setInforme] = useState<UltimoInforme | null>(null);
  useEffect(() => {
    let alive = true;
    load()
      .then((d) => { if (alive) setInforme(d); })
      .catch(() => { /* la carta se queda con su texto de archivo */ });
    return () => { alive = false; };
  }, []);
  return informe;
}
