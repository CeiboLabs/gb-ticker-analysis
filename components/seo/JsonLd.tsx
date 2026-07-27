// Renderer de JSON-LD (datos estructurados). Server component. La CSP del sitio
// permite inline scripts (script-src 'unsafe-inline'), así que el bloque va
// inline sin nonce. Se escapa `<` a < para que ningún string (títulos que
// vienen de D1/panel) pueda cerrar el <script> con "</script>". Ver docs/SEO-plan.md.

export function JsonLd({ data }: { data: object | object[] }) {
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}
