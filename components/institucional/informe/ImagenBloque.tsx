// Imagen embebida de un informe (gráfico de terceros del mensual, con fuente).
// Same-origin (CSP img-src 'self'); enmarcada on-brand con caption + fuente en el
// mismo lenguaje que los demás bloques de datos. Estilos .inf-imagen en
// ArticuloInforme. Se usa <img> plano (como el resto del sitio institucional).

export function ImagenBloque({
  src,
  alt,
  titulo,
  fuente,
}: {
  src: string;
  alt: string;
  titulo?: string;
  fuente?: string;
}) {
  return (
    <figure className="inf-imagen inf-data">
      {titulo && <figcaption className="inf-datacap">{titulo}</figcaption>}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} className="inf-imagen-img" loading="lazy" decoding="async" />
      {fuente && <p className="inf-datanota">Fuente: {fuente}</p>}
    </figure>
  );
}
