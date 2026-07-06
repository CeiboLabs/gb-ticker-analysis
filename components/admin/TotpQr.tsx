"use client";

// QR del enrolamiento TOTP, dibujado 100% con React: uqr (pure JS, cero
// dependencias) devuelve la matriz de módulos y acá se convierte en un único
// <path> SVG — sin dangerouslySetInnerHTML ni imágenes remotas (la CSP queda
// intacta). El contenido codificado jamás se interpreta como markup.

import { useMemo } from "react";
import { encode } from "uqr";

export default function TotpQr({ otpauth }: { otpauth: string }) {
  const { size, d } = useMemo(() => {
    const qr = encode(otpauth, { ecc: "M", border: 2 });
    // Un subpath rectangular de 1×1 por módulo oscuro.
    let path = "";
    for (let y = 0; y < qr.size; y++) {
      for (let x = 0; x < qr.size; x++) {
        if (qr.data[y][x]) path += `M${x} ${y}h1v1h-1z`;
      }
    }
    return { size: qr.size, d: path };
  }, [otpauth]);

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      className="adm-qr"
      role="img"
      aria-label="Código QR para la app autenticadora"
      shapeRendering="crispEdges"
    >
      <path d={d} fill="#0f2249" />
    </svg>
  );
}
